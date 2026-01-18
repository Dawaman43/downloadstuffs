import ResultDetails, { ResultDetailsSkeleton } from '@/components/Result/detail'
import { getArchiveItem } from '@/data/fetchapi'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/result/$id')({
  head: ({ location, loaderData, params }) => {
    const href = typeof location?.href === 'string' ? location.href : undefined

    const metadata = (loaderData as any)?.metadata as Record<string, any> | undefined
    const id = (params as any)?.id as string | undefined

    const titleText =
      typeof metadata?.title === 'string' && metadata.title.trim().length > 0
        ? metadata.title.trim()
        : id ?? 'Item'

    const rawDesc = metadata?.description
    const descText =
      typeof rawDesc === 'string'
        ? rawDesc
        : Array.isArray(rawDesc)
          ? rawDesc.filter((v) => typeof v === 'string').join(' ')
          : ''

    const description = descText
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 180)

    const title = `${titleText} — DownloadStuffs`
    const ogImage = `https://archive.org/services/img/${encodeURIComponent(id ?? '')}`

    return {
      meta: [
        { title },
        ...(description ? [{ name: 'description', content: description }] : []),
        { property: 'og:title', content: title },
        ...(description ? [{ property: 'og:description', content: description }] : []),
        ...(href ? [{ property: 'og:url', content: href }] : []),
        { property: 'og:type', content: 'article' },
        { property: 'og:image', content: ogImage },
        { name: 'twitter:title', content: title },
        ...(description ? [{ name: 'twitter:description', content: description }] : []),
        { name: 'twitter:image', content: ogImage },
      ],
      links: href ? [{ rel: 'canonical', href }] : [],
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
  }),
  loaderDeps: ({ params }) => ({ id: (params as any)?.id ?? '' }),
  loader: async ({ deps }) => {
    if (!deps.id) {
      return { metadata: null }
    }
    return await getArchiveItem({ data: { id: deps.id } })
  },
  pendingComponent: ResultDetailsSkeleton,
  component: RouteComponent,
})

function RouteComponent() {
  const item = Route.useLoaderData()
  return <ResultDetails item={item} />
}
