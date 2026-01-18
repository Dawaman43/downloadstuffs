import ResultDetails from '@/components/Result/detail'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/result/$id')({
  component: ResultDetails,
})
