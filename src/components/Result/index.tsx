import * as React from 'react'
import { ArchiveDoc } from '@/types/archive'
import {
    Card,
    CardDescription,
    CardHeader,
    CardTitle,
    CardFooter,
} from '../ui/card'
import { Button } from '../ui/button'
import { Link } from '@tanstack/react-router'
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs'

function stripHtml(input: string) {
    return input.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function asArray(value?: string | string[]) {
    if (!value) return []
    return Array.isArray(value) ? value : [value]
}

type ResultProps = {
    data?: ArchiveDoc[]
    totalItems?: number
    page?: number
    pageSize?: number
    onPageChange?: (page: number) => void
    mediaType?: MediaTypeFilter
    onMediaTypeChange?: (type: MediaTypeFilter) => void
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

        // Safety net: even if the server returns mixed docs,
        // the UI stays consistent with the selected filter.
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
        const windowSize = 5
        let start = Math.max(1, safePage - Math.floor(windowSize / 2))
        let end = Math.min(totalPages, start + windowSize - 1)
        start = Math.max(1, end - windowSize + 1)
        const nums: number[] = []
        for (let p = start; p <= end; p++) nums.push(p)
        return nums
    }, [safePage, totalPages])

    const pagination = totalItems > 0 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
            <p className="text-sm text-muted-foreground text-center sm:text-left">
                {rangeLabel}
            </p>
            <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    disabled={safePage <= 1}
                    onClick={() => requestPage(safePage - 1)}
                >
                    Previous
                </Button>

                {pageNumbers.map((p) => (
                    <Button
                        key={p}
                        variant={p === safePage ? 'default' : 'outline'}
                        size="sm"
                        aria-current={p === safePage ? 'page' : undefined}
                        onClick={() => requestPage(p)}
                    >
                        {p}
                    </Button>
                ))}

                <Button
                    variant="outline"
                    size="sm"
                    disabled={safePage >= totalPages}
                    onClick={() => requestPage(safePage + 1)}
                >
                    Next
                </Button>
            </div>
        </div>
    )

    return (
        <div className="w-full max-w-5xl flex flex-col gap-6 py-8">
            <h1 className="font-clash text-4xl font-semibold text-center">
                Search Results
            </h1>

            <div className="flex flex-col items-center gap-3">
                {/* Mobile: use a dropdown so it doesn't overflow */}
                <div className="w-full max-w-xs sm:hidden">
                    <select
                        value={mediaType}
                        onChange={(e) =>
                            onMediaTypeChange?.(e.currentTarget.value as MediaTypeFilter)
                        }
                        className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                        aria-label="Filter by type"
                    >
                        {MEDIA_TYPES.map((t) => (
                            <option key={t} value={t}>
                                {MEDIA_TYPE_LABELS[t]}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Desktop/tablet: tabs */}
                <div className="hidden sm:block w-full max-w-xl">
                    <Tabs
                        value={mediaType}
                        onValueChange={(v) => {
                            const next = (MEDIA_TYPES as readonly string[]).includes(v)
                                ? (v as MediaTypeFilter)
                                : 'all'
                            onMediaTypeChange?.(next)
                        }}
                    >
                        <TabsList className="w-full overflow-x-auto flex-nowrap">
                            {MEDIA_TYPES.map((t) => (
                                <TabsTrigger key={t} value={t} className="flex-1">
                                    {MEDIA_TYPE_LABELS[t]}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </Tabs>
                </div>
            </div>

            {totalItems === 0 && (
                <p className="text-center text-muted-foreground">
                    No results found. Try another search
                </p>
            )}

            {pagination}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {pageItems.map((item) =>
                    item?.identifier ? (
                        <Card
                            key={item.identifier}
                            className="flex flex-col justify-between hover:shadow-lg hover:-translate-y-1 transition-all duration-200 cursor-pointer"
                        >
                        <div className="w-full overflow-hidden rounded-t-xl bg-muted">
                            <img
                                src={`https://archive.org/services/img/${item.identifier}`}
                                alt={item.title}
                                loading="lazy"
                                className="h-44 w-full object-cover"
                                onError={(e) => {
                                    ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                                }}
                            />
                        </div>
                        <CardHeader className="space-y-2">
                            <CardTitle className="text-base line-clamp-2">{item.title}</CardTitle>

                            <CardDescription className="text-sm opacity-75">
                                {item.creator || "Unknown Author"}
                            </CardDescription>

                            <div className="text-xs text-muted-foreground flex flex-wrap gap-x-2 gap-y-1">
                                <span>{item.mediatype}</span>
                                {item.year != null && <span>• {String(item.year)}</span>}
                                {!item.year && item.date && <span>• {item.date}</span>}
                                {typeof item.downloads === "number" && <span>• {item.downloads} downloads</span>}
                            </div>

                            {item.description && (
                                <p className="text-sm text-muted-foreground line-clamp-3">
                                    {stripHtml(item.description)}
                                </p>
                            )}

                            {asArray(item.subject).length > 0 && (
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                    {asArray(item.subject).slice(0, 3).join(" · ")}
                                </p>
                            )}
                        </CardHeader>

                        <CardFooter className="pt-0">
                            <Link to="/result/$id" params={{ id: item.identifier }}>
                                <Button variant="secondary" className="w-full text-center">
                                    See Details
                                </Button>
                            </Link>
                        </CardFooter>
                    </Card>
                    ) : null
                )}
            </div>

            {pagination}
        </div>
    )
}
