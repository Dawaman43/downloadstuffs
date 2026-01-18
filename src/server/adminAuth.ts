import { createHash, timingSafeEqual } from 'node:crypto'

const COOKIE_NAME = 'admin_session'

function sha256Hex(input: string) {
  return createHash('sha256').update(input).digest('hex')
}

function getRequiredEnv(name: string) {
  const value = process.env[name]
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value
}

export function requireAdminPasswordConfigured() {
  getRequiredEnv('ADMIN_PASSWORD')
  getRequiredEnv('ADMIN_SESSION_SECRET')
}

function constantTimeEquals(a: string, b: string) {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

export function verifyAdminPassword(password: string) {
  const expected = getRequiredEnv('ADMIN_PASSWORD')
  return constantTimeEquals(password, expected)
}

export function createSessionToken() {
  const secret = getRequiredEnv('ADMIN_SESSION_SECRET')
  // Simple deterministic token for this deploy. (Not user-specific)
  return sha256Hex(`downloadstuffs-admin:${secret}`)
}

export function getSessionCookieValue() {
  return createSessionToken()
}

export function isAdminRequest(request: Request) {
  const cookie = request.headers.get('cookie') || ''
  const value = parseCookie(cookie)[COOKIE_NAME]
  if (!value) return false
  return constantTimeEquals(value, getSessionCookieValue())
}

export function setAdminSessionCookie(headers: Headers, opts?: { maxAgeSeconds?: number }) {
  const maxAge = opts?.maxAgeSeconds ?? 60 * 60 * 24 * 7
  const value = getSessionCookieValue()
  const isProd = process.env.NODE_ENV === 'production'
  const parts = [
    `${COOKIE_NAME}=${value}`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Max-Age=${maxAge}`,
  ]
  if (isProd) parts.push('Secure')
  headers.append('set-cookie', parts.join('; '))
}

export function clearAdminSessionCookie(headers: Headers) {
  const isProd = process.env.NODE_ENV === 'production'
  const parts = [`${COOKIE_NAME}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0']
  if (isProd) parts.push('Secure')
  headers.append('set-cookie', parts.join('; '))
}

function parseCookie(header: string) {
  const out: Record<string, string> = {}
  header.split(';').forEach((part) => {
    const [k, ...rest] = part.trim().split('=')
    if (!k) return
    out[k] = rest.join('=')
  })
  return out
}
