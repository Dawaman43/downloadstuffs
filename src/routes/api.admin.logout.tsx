import { createFileRoute } from '@tanstack/react-router'

import { clearAdminSessionCookie, isAdminRequest, isAllowedAdminIp } from '@/server/adminAuth'

function handler({ request }: { request: Request }) {
  if (!isAllowedAdminIp(request)) {
    return new Response('Forbidden', { status: 403 })
  }

  if (!isAdminRequest(request)) {
    return new Response('Unauthorized', { status: 401 })
  }

  const headers = new Headers({ 'content-type': 'application/json; charset=utf-8' })
  clearAdminSessionCookie(headers)

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers,
  })
}

export const Route = createFileRoute('/api/admin/logout')({
  server: {
    handlers: {
      POST: handler,
    },
  },
})
