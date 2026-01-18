import { createFileRoute } from '@tanstack/react-router'

import ResultDetails, { ResultDetailsSkeleton } from '@/components/Result/detail'
import { getArchiveItem } from '@/data/fetchapi'
import { recordDetailView, recordPageView } from '@/server/metrics'

export const Route = createFileRoute('/result/$id')({
  head: ({ params }) => {
    const id = params.id
    const title = `${id} — DownloadStuffs`
    const ogImage = `https://archive.org/services/img/${encodeURIComponent(id)}`

    return {
      meta: [
        { title },
        { name: 'description', content: 'Internet Archive item details.' },
        { property: 'og:title', content: title },
        { property: 'og:description', content: 'Internet Archive item details.' },
        { property: 'og:type', content: 'article' },
        { property: 'og:image', content: ogImage },
        { name: 'twitter:title', content: title },
        { name: 'twitter:description', content: 'Internet Archive item details.' },
        { name: 'twitter:image', content: ogImage },
      ],
    }
  },
  validateSearch: (search: unknown) => ({
    fromQ: typeof (search as any)?.fromQ === 'string' ? (search as any).fromQ : '',
    fromType:
      typeof (search as any)?.fromType === 'string' ? (search as any).fromType : 'all',
    fromPage: (() => {
      const raw = (search as any)?.fromPage
      const n =
        typeof raw === 'number'
          ? raw
          : typeof raw === 'string'
            ? Number.parseInt(raw, 10)
            : 1
      return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1
    })(),
    fromSort: (() => {
      const raw = (search as any)?.fromSort
      if (typeof raw !== 'string') return 'relevance' as const
      const normalized = raw.trim().toLowerCase()
      return ['relevance', 'downloads', 'recent', 'views'].includes(normalized)
        ? (normalized as 'relevance' | 'downloads' | 'recent' | 'views')
        : ('relevance' as const)
    })(),
  }),
  loader: (async ({ params, request }: any) => {
    if (request) {
      recordPageView(request)
      recordDetailView({ id: params.id }, request)
    } else {
      recordDetailView({ id: params.id })
    }
    return await getArchiveItem({ data: { id: params.id } })
  }) as any,
  pendingComponent: ResultDetailsSkeleton,
  component: RouteComponent,
})

function RouteComponent() {
  const item = Route.useLoaderData()
  return <ResultDetails item={item} />
}
