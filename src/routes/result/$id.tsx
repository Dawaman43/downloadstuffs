import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/result/$id')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/result/$id"!</div>
}
