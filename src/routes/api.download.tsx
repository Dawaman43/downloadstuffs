import { createFileRoute } from '@tanstack/react-router'


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

async function handler({ request }: { request: Request }) {
  const url = new URL(request.url)
  const id = url.searchParams.get('id')?.trim()
  const file = url.searchParams.get('file')?.trim()

  if (!id || !file) {
    return new Response('Missing id or file', { status: 400 })
  }

  if (isUnsafePathSegment(id) || isUnsafePathSegment(file)) {
    return new Response('Invalid id or file', { status: 400 })
  }

  const upstreamUrl = `https://archive.org/download/${encodeURIComponent(id)}/${encodeURIComponent(file)}`
  const range = request.headers.get('range')
  const upstreamRes = await fetch(upstreamUrl, {
    headers: range ? { range } : undefined,
  })

  if (!upstreamRes.ok || !upstreamRes.body) {
    const text = await upstreamRes.text().catch(() => '')
    return new Response(text || upstreamRes.statusText, {
      status: upstreamRes.status,
      headers: {
        'content-type':
          upstreamRes.headers.get('content-type') ??
          'text/plain; charset=utf-8',
      },
    })
  }

  const headers = new Headers()
  const passthroughHeaders = [
    'content-type',
    'content-length',
    'accept-ranges',
    'content-range',
    'etag',
    'last-modified',
    'cache-control',
  ]

  for (const name of passthroughHeaders) {
    const value = upstreamRes.headers.get(name)
    if (value) headers.set(name, value)
  }

  headers.set('content-disposition', contentDispositionFilename(file))

  return new Response(upstreamRes.body, {
    status: upstreamRes.status,
    headers,
  })
}

export const Route = createFileRoute('/api/download')({
  server: {
    handlers: {
      GET: handler,
    },
  },
})
