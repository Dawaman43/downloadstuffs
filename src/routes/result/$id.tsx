import ResultDetails from '@/components/Result/detail'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/result/$id')({
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
  component: ResultDetails,
})
