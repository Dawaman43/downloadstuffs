import Result from '@/components/Result'
import { searchIA } from '@/data/fetchapi'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/result/')({
    validateSearch: (search: unknown) => ({
        q:
            typeof (search as any)?.q === 'string'
                ? ((search as any).q as string)
                : '',
    }),
    loaderDeps: ({ search }) => ({
        q: search.q,
    }),
    loader: async ({ deps }) => {
        const q = deps.q.trim()
        if (!q) return []
        return await searchIA({ data: { query: q } })
    },
    component: RouteComponent,
})

function RouteComponent() {
    const data = Route.useLoaderData()
    return <Result data={data} />
}


