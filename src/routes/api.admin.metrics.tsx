import { createFileRoute } from '@tanstack/react-router'

import {
  isAdminRequest,
  isAllowedAdminIp,
  requireAdminPasswordConfigured,
} from '@/server/adminAuth'
import { getMetricsSnapshot } from '@/server/metrics'

function handler({ request }: { request: Request }) {
  try {
    requireAdminPasswordConfigured()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(message, {
      status: 500,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })
  }

  if (!isAllowedAdminIp(request)) {
    return new Response('Forbidden', { status: 403 })
  }

  if (!isAdminRequest(request)) {
    return new Response('Unauthorized', { status: 401 })
  }

  const snapshot = getMetricsSnapshot()

  return new Response(JSON.stringify(snapshot), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // Avoid caching in browsers/CDNs
      'cache-control': 'no-store',
    },
  })
}

export const Route = createFileRoute('/api/admin/metrics')({
  server: {
    handlers: {
      GET: handler,
    },
  },
})
