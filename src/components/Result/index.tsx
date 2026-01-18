import * as React from 'react'
import { ArchiveDoc } from '@/types/archive'
import {
    Card,
    CardDescription,
    CardHeader,
    CardTitle,
    CardContent,
    CardFooter,
} from '../ui/card'
import { Button } from '../ui/button'
import { Link } from '@tanstack/react-router'
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs'
import { 
    Calendar, 
    Download, 
    FileText, 
    Film, 
    Headphones, 
    ImageIcon, 
    Layers, 
    Monitor, 
    Database, 
    SearchX,
    ArrowLeft,
} from 'lucide-react'

function stripHtml(input: unknown) {
    if (input == null) return ''
    const text = Array.isArray(input)
        ? input.filter((v) => typeof v === 'string' && v.trim().length > 0).join(' ')
        : typeof input === 'string'
          ? input
          : String(input)
    return text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function asArray(value?: string | string[]) {
    if (!value) return []
    return Array.isArray(value) ? value : [value]
}

function formatNumber(num: number) {
    return new Intl.NumberFormat('en-US', { notation: 'compact', compactDisplay: 'short' }).format(num)
}

function getIconForMediaType(type: string) {
    const t = type.toLowerCase()
    if (t.includes('audio')) return <Headphones className="w-3 h-3" />
    if (t.includes('movie')) return <Film className="w-3 h-3" />
    if (t.includes('image')) return <ImageIcon className="w-3 h-3" />
    if (t.includes('software')) return <Monitor className="w-3 h-3" />
    if (t.includes('data')) return <Database className="w-3 h-3" />
    if (t.includes('collection')) return <Layers className="w-3 h-3" />
    return <FileText className="w-3 h-3" />
}

type ResultProps = {
    data?: ArchiveDoc[]
    totalItems?: number
    page?: number
    pageSize?: number
    onPageChange?: (page: number) => void
    mediaType?: MediaTypeFilter
    onMediaTypeChange?: (type: MediaTypeFilter) => void
    backLinkSearch?: {
        q: string
        page: number
        type: MediaTypeFilter
    }
}

const MEDIA_TYPES = [
    'all',
    'audio',
    'movies',
    'software',
    'texts',
    'image',
    'data',
    'collection',
] as const
type MediaTypeFilter = (typeof MEDIA_TYPES)[number]

const MEDIA_TYPE_LABELS: Record<MediaTypeFilter, string> = {
    all: 'All',
    audio: 'Audio',
    movies: 'Movies',
    software: 'Software',
    texts: 'Texts',
    image: 'Images',
    data: 'Data',
    collection: 'Collections',
}

export default function Result({
    data = [],
    totalItems: totalItemsProp,
    page: pageProp,
    pageSize: pageSizeProp = 12,
    onPageChange,
    mediaType = 'all',
    onMediaTypeChange,
    backLinkSearch,
}: ResultProps) {
    const [internalPage, setInternalPage] = React.useState(1)

    const isControlled = typeof onPageChange === 'function'
    const currentPage = typeof pageProp === 'number' ? pageProp : internalPage
    const pageSize = pageSizeProp

    const items = React.useMemo(() => {
        const withIds = data.filter(
            (item): item is ArchiveDoc & { identifier: string } =>
                typeof item?.identifier === 'string' && item.identifier.length > 0
        )

        if (mediaType === 'all') return withIds
        return withIds.filter(
            (item) => String(item.mediatype).toLowerCase() === mediaType
        )
    }, [data, mediaType])

    const isServerPagination = typeof totalItemsProp === 'number'
    const totalItems = isServerPagination ? totalItemsProp : items.length
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
    const safePage = Math.min(Math.max(1, currentPage), totalPages)

    React.useEffect(() => {
        if (!isControlled && safePage !== internalPage) setInternalPage(safePage)
    }, [internalPage, isControlled, safePage])

    const requestPage = React.useCallback(
        (nextPage: number) => {
            const clamped = Math.min(Math.max(1, nextPage), totalPages)
            if (isControlled) onPageChange?.(clamped)
            else setInternalPage(clamped)
        },
        [isControlled, onPageChange, totalPages]
    )

    const pageItems = React.useMemo(() => {
        if (isServerPagination) return items
        const start = (safePage - 1) * pageSize
        return items.slice(start, start + pageSize)
    }, [isServerPagination, items, pageSize, safePage])

    const rangeLabel = React.useMemo(() => {
        if (totalItems === 0) return ''
        const start = (safePage - 1) * pageSize + 1
        const end = Math.min(totalItems, start + pageItems.length - 1)
        return `Showing ${start}–${end} of ${totalItems}`
    }, [pageItems.length, pageSize, safePage, totalItems])

    const pageNumbers = React.useMemo(() => {
        const windowSize = 3 
        let start = Math.max(1, safePage - Math.floor(windowSize / 2))
        let end = Math.min(totalPages, start + windowSize - 1)
        start = Math.max(1, end - windowSize + 1)
        const nums: number[] = []
        for (let p = start; p <= end; p++) nums.push(p)
        return nums
    }, [safePage, totalPages])

    const pagination = totalItems > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 w-full">
            <span className="text-sm text-muted-foreground order-2 sm:order-1">
                {rangeLabel}
            </span>
            <div className="flex items-center gap-2 order-1 sm:order-2">
                <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={safePage <= 1}
                    onClick={() => requestPage(safePage - 1)}
                >
                    <span className="sr-only">Previous</span>
                    &lsaquo;
                </Button>

                <div className="flex items-center gap-1">
                    {pageNumbers[0] > 1 && (
                         <span className="text-muted-foreground text-xs px-1">...</span>
                    )}
                    {pageNumbers.map((p) => (
                        <Button
                            key={p}
                            variant={p === safePage ? 'default' : 'ghost'}
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => requestPage(p)}
                        >
                            {p}
                        </Button>
                    ))}
                     {pageNumbers[pageNumbers.length - 1] < totalPages && (
                        <span className="text-muted-foreground text-xs px-1">...</span>
                    )}
                </div>

                <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={safePage >= totalPages}
                    onClick={() => requestPage(safePage + 1)}
                >
                    <span className="sr-only">Next</span>
                    &rsaquo;
                </Button>
            </div>
        </div>
    )

    const detailSearch: {
        fromQ: string
        fromPage: number
        fromType: MediaTypeFilter
    } = {
        fromQ: backLinkSearch?.q ?? '',
        fromPage: backLinkSearch?.page ?? 1,
        fromType: backLinkSearch?.type ?? 'all',
    }

    return (
        <div className="container mx-auto max-w-7xl px-4 md:px-6 py-8 space-y-8">
            <div className="space-y-4 text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                    <Button asChild variant="ghost" size="icon" className="h-9 w-9">
                        <Link to="/" aria-label="Back to home">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                    </Button>
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                        Search Results
                    </h1>
                </div>
                
                <Tabs
                    value={mediaType}
                    onValueChange={(v) => {
                        const next = (MEDIA_TYPES as readonly string[]).includes(v)
                            ? (v as MediaTypeFilter)
                            : 'all'
                        onMediaTypeChange?.(next)
                    }}
                    className="w-full"
                >
                    <div className="overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
                        <TabsList className="h-auto w-auto inline-flex justify-start p-1 bg-muted/50">
                            {MEDIA_TYPES.map((t) => (
                                <TabsTrigger 
                                    key={t} 
                                    value={t} 
                                    className="rounded-sm px-4 py-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
                                >
                                    {MEDIA_TYPE_LABELS[t]}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </div>
                </Tabs>
            </div>

            {totalItems === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 border rounded-xl border-dashed bg-muted/30">
                    <div className="p-4 rounded-full bg-muted">
                        <SearchX className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <div>
                        <h3 className="text-lg font-medium">No results found</h3>
                        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                            We couldn't find any items matching your criteria. Try adjusting your filters or search terms.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {pageItems.map((item) => {
                            if (!item?.identifier) return null
                            return (
                                <Link 
                                    key={item.identifier}
                                    to="/result/$id" 
                                    params={{ id: item.identifier }}
                                    search={() => detailSearch}
                                    className="group block h-full outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
                                >
                                    <Card className="h-full flex flex-col overflow-hidden border-border/50 hover:border-border hover:shadow-md transition-all duration-300">
                                        <div className="relative aspect-16/10 bg-muted overflow-hidden">
                                            <img
                                                src={`https://archive.org/services/img/${item.identifier}`}
                                                alt=""
                                                loading="lazy"
                                                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                                onError={(e) => {
                                                    e.currentTarget.style.display = 'none'
                                                    e.currentTarget.nextElementSibling?.classList.remove('hidden')
                                                }}
                                            />
                                            <div className="absolute inset-0 items-center justify-center text-muted-foreground/20 hidden">
                                                <ImageIcon className="w-12 h-12" />
                                            </div>
                                            
                                            <div className="absolute top-2 right-2">
                                                <div className="flex items-center gap-1.5 bg-black/70 backdrop-blur-sm text-white text-[10px] uppercase font-bold px-2 py-1 rounded-full">
                                                    {getIconForMediaType(String(item.mediatype))}
                                                    <span>{item.mediatype}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <CardHeader className="p-4 pb-2 space-y-1">
                                            <CardTitle className="text-base font-semibold leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                                                {item.title}
                                            </CardTitle>
                                            <CardDescription className="text-xs line-clamp-1">
                                                by {item.creator || "Unknown"}
                                            </CardDescription>
                                        </CardHeader>

                                        <CardContent className="p-4 pt-0 grow">
                                            {stripHtml(item.description) && (
                                                <p className="text-xs text-muted-foreground line-clamp-3 mb-3">
                                                    {stripHtml(item.description)}
                                                </p>
                                            )}
                                            
                                            <div className="flex flex-wrap gap-2 mt-auto">
                                                {asArray(item.subject).slice(0, 2).map((sub, i) => (
                                                    <span key={i} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-secondary text-secondary-foreground">
                                                        {sub}
                                                    </span>
                                                ))}
                                            </div>
                                        </CardContent>

                                        <CardFooter className="p-4 pt-0 border-t bg-muted/20 mt-auto flex items-center justify-between text-xs text-muted-foreground">
                                            <div className="flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                <span>{item.year || item.date?.toString().substring(0, 4) || 'N/A'}</span>
                                            </div>
                                            {typeof item.downloads === "number" && (
                                                <div className="flex items-center gap-1">
                                                    <Download className="w-3 h-3" />
                                                    <span>{formatNumber(item.downloads)}</span>
                                                </div>
                                            )}
                                        </CardFooter>
                                    </Card>
                                </Link>
                            )
                        })}
                    </div>
                    {pagination}
                </div>
            )}
        </div>
    )
}