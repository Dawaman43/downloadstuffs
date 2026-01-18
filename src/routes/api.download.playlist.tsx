import { createFileRoute } from '@tanstack/react-router'

import archiver from 'archiver'
import { Readable } from 'node:stream'

import { recordDownload, recordDownloadError } from '@/server/metrics'

function isUnsafePathSegment(value: string) {
  const v = value.trim()
  return (
    v.length === 0 ||
    v.includes('..') ||
    v.includes('/') ||
    v.includes('\\') ||
    v.startsWith('.') ||
    v.startsWith('~')
  )
}

function contentDispositionFilename(filename: string) {
  const encoded = encodeURIComponent(filename)
  return `attachment; filename*=UTF-8''${encoded}`
}

function getTimeoutMs() {
  const raw = process.env.ARCHIVE_UPSTREAM_TIMEOUT_MS
  const n = raw ? Number(raw) : Number.NaN
  if (Number.isFinite(n) && n > 0) return Math.floor(n)
  return 20_000
}

type ArchiveFile = {
  name?: string
  source?: string
  private?: string
}

function extOf(name: string) {
  const idx = name.lastIndexOf('.')
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : ''
}

function isVideoName(name: string) {
  return ['mp4', 'mkv', 'webm', 'avi', 'mov', 'm4v'].includes(extOf(name))
}

function isAudioName(name: string) {
  return ['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac'].includes(extOf(name))
}

async function handler({ request }: { request: Request }) {
  const url = new URL(request.url)
  const id = url.searchParams.get('id')?.trim()
  const kindRaw = url.searchParams.get('kind')?.trim().toLowerCase()
  const sourceRaw = url.searchParams.get('source')?.trim().toLowerCase()
  const maxRaw = url.searchParams.get('max')?.trim()

  if (!id) return new Response('Missing id', { status: 400 })
  if (isUnsafePathSegment(id)) return new Response('Invalid id', { status: 400 })

  const kind = ((): 'playlist' | 'video' | 'audio' | 'all' => {
    if (kindRaw === 'video') return 'video'
    if (kindRaw === 'audio') return 'audio'
    if (kindRaw === 'all') return 'all'
    return 'playlist'
  })()

  const sourceFilter = ((): 'original' | 'all' => {
    if (sourceRaw === 'all') return 'all'
    return 'original'
  })()

  const maxFiles = (() => {
    const n = maxRaw ? Number.parseInt(maxRaw, 10) : Number.NaN
    if (Number.isFinite(n) && n > 0) return Math.min(400, Math.floor(n))
    return 200
  })()

  const metaUrl = `https://archive.org/metadata/${encodeURIComponent(id)}`
  let metaRes: Response
  try {
    const controller = new AbortController()
    const timeoutMs = getTimeoutMs()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    metaRes = await fetch(metaUrl, { signal: controller.signal })
    clearTimeout(timer)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const status = message.toLowerCase().includes('abort') ? 504 : 502
    recordDownloadError({ id, file: 'playlist.zip', status, message }, request)
    return new Response(`Upstream metadata fetch failed (${status}).\n\nURL: ${metaUrl}\nError: ${message}`, {
      status,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })
  }

  if (!metaRes.ok) {
    const text = await metaRes.text().catch(() => '')
    recordDownloadError({ id, file: 'playlist.zip', status: metaRes.status }, request)
    return new Response(text || metaRes.statusText, {
      status: metaRes.status,
      headers: {
        'content-type': metaRes.headers.get('content-type') ?? 'text/plain; charset=utf-8',
      },
    })
  }

  const meta = await metaRes.json().catch(() => null)
  const files: Array<ArchiveFile> = Array.isArray(meta?.files) ? meta.files : []

  const publicFiles = files.filter((f) => {
    const nameOk = typeof f?.name === 'string' && f.name.trim().length > 0
    const isPublic = f?.private !== 'true'
    if (!nameOk || !isPublic) return false
    if (sourceFilter === 'original' && f.source !== 'original') return false
    return true
  })

  const video = publicFiles.filter((f) => typeof f.name === 'string' && isVideoName(f.name))
  const audio = publicFiles.filter((f) => typeof f.name === 'string' && isAudioName(f.name))

  const selected = (() => {
    if (kind === 'video') return video
    if (kind === 'audio') return audio
    if (kind === 'all') return publicFiles

    // playlist: prefer video, else audio, else everything
    if (video.length > 0) return video
    if (audio.length > 0) return audio
    return publicFiles
  })()

  if (selected.length === 0) {
    return new Response('No files matched for zip.', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })
  }

  if (selected.length > maxFiles) {
    return new Response(`Too many files to zip (${selected.length}). Use ?max=${maxFiles} or narrower filters.`, {
      status: 413,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })
  }

  // natural-ish sort by filename
  selected.sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { numeric: true, sensitivity: 'base' }))

  const zipName = `${id}-playlist.zip`
  const archive = archiver('zip', { zlib: { level: 9 } })

  const errors: Array<string> = []

  // Kick off appending in the background; archive is a stream.
  ;(async () => {
    for (const f of selected) {
      const name = typeof f.name === 'string' ? f.name : ''
      if (!name) continue

      const upstreamUrl = `https://archive.org/download/${encodeURIComponent(id)}/${encodeURIComponent(name)}`
      try {
        const controller = new AbortController()
        const timeoutMs = getTimeoutMs()
        const timer = setTimeout(() => controller.abort(), timeoutMs)
        const upstreamRes = await fetch(upstreamUrl, { signal: controller.signal })
        clearTimeout(timer)

        if (!upstreamRes.ok || !upstreamRes.body) {
          errors.push(`${name}: upstream status ${upstreamRes.status}`)
          continue
        }

        const nodeStream = Readable.fromWeb(upstreamRes.body as any)
        archive.append(nodeStream, { name })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        errors.push(`${name}: ${message}`)
      }
    }

    if (errors.length > 0) {
      archive.append(errors.join('\n') + '\n', { name: '_errors.txt' })
    }

    archive.finalize().catch(() => {})
  })().catch(() => {
    archive.finalize().catch(() => {})
  })

  const headers = new Headers({
    'content-type': 'application/zip',
    'content-disposition': contentDispositionFilename(zipName),
  })

  recordDownload({ id, file: zipName, count: selected.length }, request)

  return new Response(Readable.toWeb(archive) as unknown as ReadableStream, {
    status: 200,
    headers,
  })
}

export const Route = createFileRoute('/api/download/playlist')({
  server: {
    handlers: {
      GET: handler,
    },
  },
})
