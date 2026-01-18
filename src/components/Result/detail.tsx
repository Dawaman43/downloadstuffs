import * as React from 'react'
import { Link, useParams, useSearch } from '@tanstack/react-router'
import {
  ArrowLeft,
  Copy,
  Download,
  ExternalLink,
  FileAudio,
  FileImage,
  FileText,
  FileVideo,
  User,
} from 'lucide-react'
import VideoPlayer from '@/components/Result/VideoPlayer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// ── Helpers (unchanged) ────────────────────────────────────────────────────
function stripHtml(input: unknown) {
  if (input == null) return ''
  const text = Array.isArray(input)
    ? input.filter((v) => typeof v === 'string' && v.trim()).join(' ')
    : typeof input === 'string' ? input : String(input)
  return text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function asArray(value?: string | Array<string>) {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

type ArchiveFile = {
  name?: string
  source?: string
  format?: string
  private?: string
  size?: string
}

const isPublicFile = (f: ArchiveFile) => !!f.name && f.private !== 'true'

const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  if (['mp4','mkv','webm','avi','mov','m4v'].includes(ext)) return <FileVideo className="w-4 h-4" />
  if (['mp3','wav','flac','ogg','m4a','aac'].includes(ext)) return <FileAudio className="w-4 h-4" />
  if (['jpg','jpeg','png','gif','webp'].includes(ext)) return <FileImage className="w-4 h-4" />
  return <FileText className="w-4 h-4" />
}

const formatBytes = (bytes?: string | number) => {
  if (!bytes) return ''
  const num = typeof bytes === 'string' ? Number.parseInt(bytes, 10) : bytes
  if (!Number.isFinite(num) || num <= 0) return ''

  const units = ['B','KB','MB','GB','TB']
  let value = num, i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[i]}`
}

const extOf = (name: string) => name.split('.').pop()?.toLowerCase() ?? ''

const isVideo = (name: string) => ['mp4','mkv','webm','avi','mov','m4v'].includes(extOf(name))
const isAudio = (name: string) => ['mp3','wav','flac','ogg','m4a','aac'].includes(extOf(name))

const naturalCompare = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })

// ────────────────────────────────────────────────────────────────────────────

export default function ResultDetails({ item }: { item: any }) {
  const { id } = useParams({ from: '/result/$id' })
  const search = useSearch({ from: '/result/$id' })

  const MEDIA_TYPES = ['all', 'audio', 'movies', 'software', 'texts', 'image', 'data', 'collection'] as const
  type MediaType = (typeof MEDIA_TYPES)[number]
  const SORTS = ['relevance', 'downloads', 'recent', 'views'] as const
  type SortOption = (typeof SORTS)[number]

  const rawBackType = String(search.fromType).trim().toLowerCase()
  const rawBackSort = String(search.fromSort).trim().toLowerCase()

  const backType: MediaType = MEDIA_TYPES.includes(rawBackType as MediaType) ? (rawBackType as MediaType) : 'all'
  const backSort: SortOption = SORTS.includes(rawBackSort as SortOption) ? (rawBackSort as SortOption) : 'relevance'

  const back = {
    q: typeof search.fromQ === 'string' ? search.fromQ : '',
    type: backType,
    sort: backSort,
    page: Number.isFinite(Number(search.fromPage)) ? Math.max(1, Number(search.fromPage)) : 1
  }

  const [fallback, setFallback] = React.useState<any>(null)
  const [loadingFallback, setLoadingFallback] = React.useState(false)

  React.useEffect(() => {
    if (item?.metadata || !id) return
    let cancelled = false
    setLoadingFallback(true)

    fetch(`https://archive.org/metadata/${encodeURIComponent(id)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => !cancelled && setFallback(data))
      .catch(() => !cancelled && setFallback(null))
      .finally(() => !cancelled && setLoadingFallback(false))

    return () => { cancelled = true }
  }, [id, item?.metadata])

  const data = item?.metadata ? item : fallback
  if (!data?.metadata) {
    return (
      <div className="p-12 text-center space-y-5">
        <div className="text-xl font-medium">
          {loadingFallback ? 'Loading...' : 'Item not found'}
        </div>
        {id && (
          <a
            href={`https://archive.org/details/${id}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-primary hover:underline"
          >
            View on archive.org <ExternalLink size={16} />
          </a>
        )}
      </div>
    )
  }

  const meta = data.metadata
  const files: Array<ArchiveFile> = Array.isArray(data.files) ? data.files : []
  const publicFiles = files.filter(isPublicFile)

  const thumb = `https://archive.org/services/img/${id}`

  // ── Media detection ───────────────────────────────────────────────────────
  const bestVideo = publicFiles.find(f => f.source === 'original' && isVideo(f.name!)) ||
                    publicFiles.find(f => isVideo(f.name!))

  const bestAudio = bestVideo ? undefined :
                    publicFiles.find(f => f.source === 'original' && isAudio(f.name!)) ||
                    publicFiles.find(f => isAudio(f.name!))

  const images = publicFiles
    .filter(f => ['jpg','jpeg','png','webp'].some(e => f.name?.toLowerCase().endsWith(e)))
    .slice(0, 12)

  const originals = publicFiles.filter(f => f.source === 'original' && !/\.(xml|sqlite)$/i.test(f.name ?? ''))

  const preferredFile = bestVideo?.name ?? bestAudio?.name ?? originals[0]?.name ?? ''

  const playlist = (bestVideo ? publicFiles.filter(f => isVideo(f.name!)) : publicFiles.filter(f => isAudio(f.name!)))
    .sort((a,b) => naturalCompare(a.name!, b.name!))

  const [activeFileName, setActiveFileName] = React.useState<string>(() => bestVideo?.name ?? bestAudio?.name ?? playlist[0]?.name ?? preferredFile)

  const selectedFile = publicFiles.find(f => f.name === activeFileName)
  const isPlayingVideo = selectedFile ? isVideo(selectedFile.name!) : false
  const isPlayingAudio = selectedFile ? isAudio(selectedFile.name!) : false

  const queue = playlist.map(f => ({
    src: `https://archive.org/download/${id}/${encodeURIComponent(f.name!)}`,
    label: f.name!,
    name: f.name!
  }))

  const currentIndex = queue.findIndex(q => q.name === activeFileName)

  const playlistKind = React.useMemo(() => {
    const first = playlist[0]?.name
    if (!first) return 'playlist'
    if (isVideo(first)) return 'video'
    if (isAudio(first)) return 'audio'
    return 'playlist'
  }, [playlist])

  const [theaterMode, setTheaterMode] = React.useState(false)
  const [showFullDescription, setShowFullDescription] = React.useState(false)
  const [copiedKind, setCopiedKind] = React.useState<null | 'page' | 'stream' | 'download'>(null)

  const copyToClipboard = React.useCallback(async (kind: 'page' | 'stream' | 'download', text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKind(kind)
      window.setTimeout(() => setCopiedKind((k) => (k === kind ? null : k)), 1400)
    } catch {
      // ignore
    }
  }, [])

  const [fileSearch, setFileSearch] = React.useState('')
  const [sourceView, setSourceView] = React.useState<'original' | 'all' | 'derivative'>('original')

  const visibleFiles = publicFiles.filter(f => {
    const name = f.name ?? ''
    if (!name) return false
    if (sourceView === 'original' && f.source !== 'original') return false
    if (sourceView === 'derivative' && f.source === 'original') return false
    return !fileSearch || name.toLowerCase().includes(fileSearch.toLowerCase())
  })

  const groupedFiles = React.useMemo(() => {
    const map = new Map<string, Array<ArchiveFile>>()
    visibleFiles.forEach(f => {
      const key = (f.format?.trim() || extOf(f.name ?? '') || 'other').toLowerCase()
      const arr = map.get(key) ?? []
      arr.push(f)
      map.set(key, arr)
    })
    return Array.from(map.entries()).sort((a,b) => a[0].localeCompare(b[0]))
  }, [visibleFiles])

  // ── Render ─────────────────────────────────────────────────────────────────
  const pageUrl = typeof window !== 'undefined' ? window.location.href : `https://archive.org/details/${id}`
  const streamUrl = `https://archive.org/download/${id}/${encodeURIComponent(activeFileName)}`
  const downloadUrl = `/api/download?id=${id}&file=${encodeURIComponent(activeFileName || preferredFile)}`

  const infoPanel = (
    <div className="bg-card/70 backdrop-blur-sm border rounded-xl p-6 shadow-sm">
      <div className="flex flex-wrap gap-2 mb-4">
        <Badge className="bg-primary/10 hover:bg-primary/15 text-primary rounded-full px-3">
          {meta.mediatype}
        </Badge>
        {meta.year && (
          <Badge variant="outline" className="rounded-full px-3 border-primary/20">
            {meta.year}
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-2.5 text-muted-foreground mb-4">
        <User size={16} />
        <span className="font-medium">{meta.creator || meta.uploader || '—'}</span>
      </div>

      {asArray(meta.subject).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {asArray(meta.subject).slice(0, 10).map((t, i) => (
            <span key={i} className="text-xs px-2.5 py-1 bg-secondary/60 rounded-full">
              #{t}
            </span>
          ))}
        </div>
      )}
    </div>
  )

  const aboutPanel = meta.description ? (
    <div className="bg-card/60 backdrop-blur border rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="font-semibold">About</h3>
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setShowFullDescription((v) => !v)}
        >
          {showFullDescription ? 'Show less' : 'Show more'}
        </button>
      </div>
      <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground/90">
        {(showFullDescription
          ? stripHtml(meta.description)
          : stripHtml(meta.description).slice(0, 700) + (stripHtml(meta.description).length > 700 ? '…' : '')
        )
          .split('\n')
          .filter(Boolean)
          .map((p, i) => (
            <p key={i}>{p}</p>
          ))}
      </div>
    </div>
  ) : null

  const playlistPanel = playlist.length > 1 ? (
    <div className="bg-card/60 backdrop-blur border rounded-xl overflow-hidden shadow-sm">
      <div className="p-5 border-b flex items-center justify-between gap-3">
        <h3 className="font-semibold">Playlist • {playlist.length}</h3>
        <Button variant="ghost" size="sm" className="rounded-full h-9 px-3" asChild>
          <a href={`/api/download/playlist?id=${id}&kind=${playlistKind}&source=original`}>Playlist .zip</a>
        </Button>
      </div>
      <div className="p-3 space-y-1.5">
        {playlist.map((f, idx) => {
          const name = f.name ?? ''
          if (!name) return null
          const active = name === activeFileName
          return (
            <button
              key={name}
              type="button"
              onClick={() => setActiveFileName(name)}
              className={
                'w-full flex items-center justify-between gap-3 p-2.5 rounded-md text-sm transition-colors ' +
                (active ? 'bg-primary/10 text-primary' : 'hover:bg-muted')
              }
              title={name}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-7 shrink-0 text-xs tabular-nums text-muted-foreground text-right">{idx + 1}</span>
                {getFileIcon(name)}
                <div className="min-w-0">
                  <div className="truncate font-medium">{name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {formatBytes(f.size) ? `${formatBytes(f.size)} • ` : ''}
                    {f.source || '?'}
                    {f.format ? ` • ${f.format}` : ''}
                  </div>
                </div>
              </div>
              <a
                href={`/api/download?id=${id}&file=${encodeURIComponent(name)}`}
                onClick={(e) => e.stopPropagation()}
                className="p-2 hover:text-primary transition-colors"
                aria-label="Download"
              >
                <Download size={16} />
              </a>
            </button>
          )
        })}
      </div>
    </div>
  ) : null

  const filesPanel = (
    <div className="bg-card/60 backdrop-blur border rounded-xl overflow-hidden shadow-sm">
      <div className="p-5 border-b">
        <h3 className="font-semibold mb-3.5">Files • {publicFiles.length}</h3>

        <div className="flex gap-1.5 mb-3.5 flex-wrap">
          {(['original', 'all', 'derivative'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setSourceView(v)}
              className={`px-3.5 py-1.5 text-sm rounded-lg transition-colors ${
                sourceView === v
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'hover:bg-muted'
              }`}
            >
              {v === 'original' ? 'Originals' : v === 'derivative' ? 'Derivatives' : 'All'}
            </button>
          ))}
        </div>

        <Input
          placeholder="Filter files..."
          value={fileSearch}
          onChange={(e) => setFileSearch(e.target.value)}
          className="bg-background/60"
        />
      </div>

      <div className="p-3 space-y-1.5">
        {groupedFiles.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            No files match current filter
          </div>
        ) : (
          groupedFiles.map(([groupName, items]) => {
            const sorted = [...items].sort((a, b) => naturalCompare(a.name!, b.name!))
            const label = groupName === 'other' ? 'Other' : groupName.toUpperCase()

            return (
              <details key={groupName} className="group">
                <summary className="flex justify-between items-center px-4 py-2.5 cursor-pointer hover:bg-muted/40 rounded-md select-none">
                  <span className="font-medium capitalize">{label}</span>
                  <span className="text-xs text-muted-foreground">{sorted.length}</span>
                </summary>
                <div className="px-2 pb-3 pt-1">
                  {sorted.map((f) => {
                    const name = f.name ?? ''
                    if (!name) return null
                    const active = name === activeFileName
                    const playable = isVideo(name) || isAudio(name)
                    const size = formatBytes(f.size)

                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => playable && setActiveFileName(name)}
                        className={`w-full flex items-center justify-between gap-3 p-2.5 rounded-md text-sm transition-colors ${
                          playable
                            ? active
                              ? 'bg-primary/10 text-primary'
                              : 'hover:bg-muted'
                            : 'opacity-70 cursor-default'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {getFileIcon(name)}
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">{name}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {size && `${size} • `}
                              {f.source || '?'}
                              {f.format && ` • ${f.format}`}
                            </div>
                          </div>
                        </div>

                        <a
                          href={`/api/download?id=${id}&file=${encodeURIComponent(name)}`}
                          onClick={(e) => e.stopPropagation()}
                          className="p-2 hover:text-primary transition-colors"
                          aria-label="Download"
                        >
                          <Download size={16} />
                        </a>
                      </button>
                    )
                  })}
                </div>
              </details>
            )
          })
        )}
      </div>
    </div>
  )

  return (
    <div className="relative min-h-screen bg-background">
      {/* Background ambiance */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <img
          src={thumb}
          alt=""
          className="w-full h-full object-cover blur-3xl opacity-[0.08] scale-110"
        />
        <div className="absolute inset-0 bg-linear-to-t from-background via-background/85 to-background/40" />
      </div>

      <div
        className={
          'relative z-10 w-full px-4 sm:px-6 lg:px-8 2xl:px-10 py-6 md:py-10 lg:py-14 ' +
          (theaterMode ? 'max-w-none' : 'mx-auto max-w-screen-2xl')
        }
      >
        {/* Header */}
        <header className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="rounded-full" asChild>
              <Link to="/result" search={back}>
                <ArrowLeft size={20} />
              </Link>
            </Button>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight leading-tight">
              {meta.title}
            </h1>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <Button className="rounded-full h-10 px-5 gap-2 shadow-md shadow-primary/20" asChild>
              <a href={downloadUrl}>
                <Download size={16} /> Download
              </a>
            </Button>

            {playlist.length > 1 && (
              <Button variant="secondary" className="rounded-full h-10 px-5 gap-2" asChild>
                <a href={`/api/download/playlist?id=${id}&kind=${playlistKind}&source=original`}>
                  <Download size={16} /> Playlist (.zip)
                </a>
              </Button>
            )}

            <Button
              variant="outline"
              className="rounded-full h-10 px-4"
              type="button"
              onClick={() => copyToClipboard('page', pageUrl)}
            >
              <Copy size={16} />
              <span className="ml-2">{copiedKind === 'page' ? 'Copied' : 'Copy link'}</span>
            </Button>

            {activeFileName ? (
              <Button
                variant="outline"
                className="rounded-full h-10 px-4"
                type="button"
                onClick={() => copyToClipboard('stream', streamUrl)}
              >
                <Copy size={16} />
                <span className="ml-2">{copiedKind === 'stream' ? 'Copied' : 'Copy stream'}</span>
              </Button>
            ) : null}

          

            <Button variant="outline" className="rounded-full h-10 px-5 gap-2" asChild>
              <a href={`https://archive.org/details/${id}`} target="_blank" rel="noreferrer">
                <ExternalLink size={16} /> archive.org
              </a>
            </Button>

            <Button variant="ghost" size="sm" className="rounded-full h-10 px-4 text-muted-foreground" asChild>
              <a href={`https://archive.org/download/${id}/${id}_archive.torrent`} target="_blank" rel="noreferrer">
                Torrent
              </a>
            </Button>
          </div>
        </header>

        <div className="space-y-10">
          {/* Media area */}
          <section className="space-y-7">
            <div className="rounded-xl lg:rounded-2xl overflow-hidden border bg-linear-to-b from-black/5 to-black/20 shadow-xl shadow-black/10 aspect-video">
              {isPlayingVideo ? (
                <VideoPlayer
                  title={meta.title}
                  poster={thumb}
                  src={`https://archive.org/download/${id}/${encodeURIComponent(activeFileName)}`}
                  queue={queue}
                  activeIndex={currentIndex}
                  onActiveIndexChange={i => setActiveFileName(queue[i]?.name ?? activeFileName)}
                />
              ) : isPlayingAudio ? (
                <div className="h-full flex flex-col items-center justify-center p-8 bg-secondary/5">
                  <div className="w-52 sm:w-64 aspect-square rounded-xl overflow-hidden shadow-2xl mb-8">
                    <img src={thumb} alt="Cover" className="w-full h-full object-cover" />
                  </div>
                  <audio controls className="w-full max-w-xl" src={`https://archive.org/download/${id}/${encodeURIComponent(activeFileName)}`} />
                </div>
              ) : (
                <div className="min-h-105 flex items-center justify-center p-8 bg-secondary/5">
                  <img src={thumb} alt={meta.title} className="max-h-full max-w-full object-contain" />
                </div>
              )}
            </div>

            {images.length > 0 && !bestVideo && (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                {images.map((f,i) => (
                  <a
                    key={i}
                    href={`https://archive.org/download/${id}/${encodeURIComponent(f.name!)}`}
                    target="_blank"
                    className="aspect-square rounded-lg overflow-hidden ring-1 ring-border hover:ring-primary/60 transition-all hover:scale-[1.015]"
                  >
                    <img
                      src={`https://archive.org/download/${id}/${encodeURIComponent(f.name!)}`}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </a>
                ))}
              </div>
            )}

            {/* Mobile tabs */}
            <div className="lg:hidden">
              <Tabs defaultValue="info">
                <TabsList className="w-full justify-between">
                  <TabsTrigger value="info" className="flex-1">Info</TabsTrigger>
                  {playlistPanel ? <TabsTrigger value="playlist" className="flex-1">Playlist</TabsTrigger> : null}
                  <TabsTrigger value="files" className="flex-1">Files</TabsTrigger>
                  {aboutPanel ? <TabsTrigger value="about" className="flex-1">About</TabsTrigger> : null}
                </TabsList>

                <TabsContent value="info" className="mt-4">
                  {infoPanel}
                </TabsContent>
                {playlistPanel ? (
                  <TabsContent value="playlist" className="mt-4">
                    {playlistPanel}
                  </TabsContent>
                ) : null}
                <TabsContent value="files" className="mt-4">
                  {filesPanel}
                </TabsContent>
                {aboutPanel ? (
                  <TabsContent value="about" className="mt-4">
                    {aboutPanel}
                  </TabsContent>
                ) : null}
              </Tabs>
            </div>
          </section>

          {/* Desktop: everything below the player (no nested scroll areas) */}
          <section className="hidden lg:block space-y-7">
            {infoPanel}
            {playlistPanel}
            {aboutPanel}
            {filesPanel}
          </section>
        </div>
      </div>
    </div>
  )
}

export function ResultDetailsSkeleton() {
  return (
    <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 2xl:px-10 py-10 space-y-8">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
        <div className="h-8 w-2/3 rounded-lg bg-muted animate-pulse" />
      </div>

      <div className="grid lg:grid-cols-12 gap-6 lg:gap-10">
        <div className="lg:col-span-9 space-y-6">
          <div className="aspect-video w-full rounded-2xl bg-muted/60 border animate-pulse" />
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-lg bg-muted/50 animate-pulse" />
            ))}
          </div>
        </div>
        <div className="hidden lg:block lg:col-span-3 space-y-6">
          <div className="h-40 rounded-xl bg-muted/50 border animate-pulse" />
          <div className="h-64 rounded-xl bg-muted/50 border animate-pulse" />
        </div>
      </div>
    </div>
  )
}