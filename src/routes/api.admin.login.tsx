import { createFileRoute } from '@tanstack/react-router'

import {
  checkAdminLoginRateLimit,
  isAllowedAdminIp,
  recordAdminLoginFailure,
  requireAdminPasswordConfigured,
  setAdminSessionCookie,
  verifyAdminPassword,
} from '@/server/adminAuth'

async function handler({ request }: { request: Request }) {
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

  const rl = checkAdminLoginRateLimit(request)
  if (!rl.ok) {
    return new Response('Too many attempts', {
      status: 429,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'retry-after': String(rl.retryAfterSeconds),
      },
    })
  }

  let body: unknown = null
  try {
    body = await request.json()
  } catch {
    body = null
  }

  const passwordValue =
    typeof body === 'object' && body !== null && 'password' in body
      ? (body as { password?: unknown }).password
      : undefined

  const password = typeof passwordValue === 'string' ? passwordValue : ''
  if (!password) {
    return new Response('Missing password', { status: 400 })
  }

  if (!verifyAdminPassword(password)) {
    recordAdminLoginFailure(request)
    return new Response('Unauthorized', { status: 401 })
  }

  const headers = new Headers({ 'content-type': 'application/json; charset=utf-8' })
  setAdminSessionCookie(headers)

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers,
  })
}

export const Route = createFileRoute('/api/admin/login')({
  server: {
    handlers: {
      POST: handler,
    },
  },
})
