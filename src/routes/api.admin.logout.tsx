import { createFileRoute } from '@tanstack/react-router'

import { clearAdminSessionCookie } from '@/server/adminAuth'

function handler() {
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
