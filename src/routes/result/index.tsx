import Result from '@/components/Result'
import { searchIA } from '@/data/fetchapi'
import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'

import { Card, CardHeader } from '@/components/ui/card'

const PAGE_SIZE = 10

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

export const Route = createFileRoute('/result/')({
    head: ({ location }) => {
        const href = typeof location?.href === 'string' ? location.href : undefined
        const searchStr =
            typeof location?.searchStr === 'string'
                ? location.searchStr
                : typeof location?.search === 'string'
                  ? location.search
                  : ''
        const sp = new URLSearchParams(searchStr.startsWith('?') ? searchStr.slice(1) : searchStr)
        const q = (sp.get('q') ?? '').trim()
        const page = sp.get('page')
        const type = (sp.get('type') ?? '').trim()

        const baseTitle = q ? `Results for “${q}”` : 'Search Results'
        const titleParts = [baseTitle]
        if (type && type !== 'all') titleParts.push(type)
        if (page && page !== '1') titleParts.push(`Page ${page}`)
        titleParts.push('DownloadStuffs')

        const title = titleParts.join(' — ')
        const description = q
            ? `Browse Internet Archive results for “${q}” with filtering and pagination.`
            : 'Browse Internet Archive results with filtering and pagination.'

        return {
            meta: [
                { title },
                { name: 'description', content: description },
                { property: 'og:title', content: title },
                { property: 'og:description', content: description },
                ...(href ? [{ property: 'og:url', content: href }] : []),
                { name: 'twitter:title', content: title },
                { name: 'twitter:description', content: description },
            ],
            links: href ? [{ rel: 'canonical', href }] : [],
        }
    },
    validateSearch: (search: unknown) => ({
        q:
            typeof (search as any)?.q === 'string'
                ? ((search as any).q as string)
                : '',
        type: (() => {
            const raw = (search as any)?.type
            if (typeof raw !== 'string') return 'all' as const
            const normalized = raw.trim().toLowerCase()
            return (MEDIA_TYPES as readonly string[]).includes(normalized)
                ? (normalized as MediaTypeFilter)
                : ('all' as const)
        })(),
        page: (() => {
            const raw = (search as any)?.page
            const n =
                typeof raw === 'number'
                    ? raw
                    : typeof raw === 'string'
                      ? Number.parseInt(raw, 10)
                      : 1
            return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1
        })(),
    }),
    loaderDeps: ({ search }) => ({
        q: search.q,
        type: search.type,
        page: search.page,
    }),
    loader: async ({ deps }) => {
        const q = deps.q.trim()
        if (!q) return { docs: [], total: 0 }

        const baseQuery = `(${q})`
        const query =
            deps.type && deps.type !== 'all'
                ? `${baseQuery} AND mediatype:${deps.type}`
                : baseQuery
        return await searchIA({
            data: { query, page: deps.page ?? 1, rows: PAGE_SIZE },
        })
    },
    pendingComponent: ResultPending,
    component: RouteComponent,
})

function ResultPending() {
    // Simple skeleton state while the loader is fetching
    return (
        <div className="w-full max-w-5xl flex flex-col gap-6 py-8">
            <div className="flex flex-col items-center gap-2">
                <h1 className="font-clash text-4xl font-semibold text-center">
                    Search Results
                </h1>
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <span className="inline-block h-4 w-4 rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground animate-spin" />
                    <span>Loading…</span>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                    <Card key={i} className="overflow-hidden">
                        <div className="h-44 w-full bg-muted animate-pulse" />
                        <CardHeader className="space-y-3">
                            <div className="h-4 w-4/5 bg-muted animate-pulse rounded" />
                            <div className="h-3 w-2/3 bg-muted animate-pulse rounded" />
                            <div className="h-3 w-1/2 bg-muted animate-pulse rounded" />
                        </CardHeader>
                    </Card>
                ))}
            </div>
        </div>
    )
}

function RouteComponent() {
    const data = Route.useLoaderData()
    const search = Route.useSearch()
    const navigate = Route.useNavigate()

    const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE))
    const page = Math.min(Math.max(1, search.page ?? 1), totalPages)

    // Keep URL in sync when page is out of range (e.g. new search results)
    // or when query changes (reset to page 1).
    const prevQRef = React.useRef(search.q)
    React.useEffect(() => {
        if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, behavior: 'smooth' })
        }
    }, [page, search.type])

    React.useEffect(() => {
        if (prevQRef.current !== search.q) {
            prevQRef.current = search.q
            if ((search.page ?? 1) !== 1) {
                navigate({
                    search: (prev) => ({ ...prev, page: 1 }),
                    replace: true,
                })
            }
            return
        }

        if ((search.page ?? 1) !== page) {
            navigate({
                search: (prev) => ({ ...prev, page }),
                replace: true,
            })
        }
    }, [navigate, page, search.page, search.q])

    return (
        <Result
            data={data.docs}
            totalItems={data.total}
            page={page}
            pageSize={PAGE_SIZE}
            mediaType={search.type}
            backLinkSearch={{
                q: search.q,
                page,
                type: search.type,
            }}
            onMediaTypeChange={(type) =>
                navigate({
                    search: (prev) => ({ ...prev, type, page: 1 }),
                })
            }
            onPageChange={(nextPage) =>
                navigate({
                    search: (prev) => ({ ...prev, page: nextPage }),
                })
            }
        />
    )
}


