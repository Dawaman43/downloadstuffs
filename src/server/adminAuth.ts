import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto'

const COOKIE_NAME = 'admin_session'

type RateLimitState = {
  failures: Array<number>
  lockedUntil?: number
}

function sha256(input: string | Buffer) {
  return createHash('sha256').update(input).digest()
}

function getRequiredEnv(name: string) {
  const value = process.env[name]
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value
}

export function requireAdminPasswordConfigured() {
  // Either a plaintext password (simple) or a stored hash (preferred)
  const hasPlain = !!process.env.ADMIN_PASSWORD
  const hasHash = !!process.env.ADMIN_PASSWORD_HASH
  if (!hasPlain && !hasHash) {
    throw new Error('Missing required env var: ADMIN_PASSWORD or ADMIN_PASSWORD_HASH')
  }
  getRequiredEnv('ADMIN_SESSION_SECRET')
}

function constantTimeEquals(a: string, b: string) {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

export function verifyAdminPassword(password: string) {
  const expectedHash = process.env.ADMIN_PASSWORD_HASH
  if (expectedHash && expectedHash.trim().length > 0) {
    // Format: scrypt$<saltHex>$<hashHex>
    const parts = expectedHash.trim().split('$')
    if (parts.length !== 3 || parts[0] !== 'scrypt') return false
    const saltHex = parts[1] || ''
    const hashHex = parts[2] || ''
    if (!saltHex || !hashHex) return false

    let salt: Buffer
    let expected: Buffer
    try {
      salt = Buffer.from(saltHex, 'hex')
      expected = Buffer.from(hashHex, 'hex')
    } catch {
      return false
    }
    if (expected.length === 0) return false

    const derived = scryptSync(password, salt, expected.length)
    return timingSafeEqual(derived, expected)
  }

  const expectedPlain = getRequiredEnv('ADMIN_PASSWORD')
  return constantTimeEquals(password, expectedPlain)
}

function base64UrlEncode(buf: Buffer) {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function base64UrlDecode(input: string) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
  const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4))
  return Buffer.from(normalized + pad, 'base64')
}

function getSessionKey() {
  const secret = getRequiredEnv('ADMIN_SESSION_SECRET')
  // Derive a 32-byte key.
  return sha256(secret)
}

type SessionPayload = {
  iat: number
  exp: number
  nonce: string
}

export function createSessionToken(opts?: { ttlSeconds?: number }) {
  const ttlSeconds = opts?.ttlSeconds ?? 60 * 60 * 24 * 7
  const now = Date.now()
  const payload: SessionPayload = {
    iat: now,
    exp: now + ttlSeconds * 1000,
    nonce: randomBytes(16).toString('hex'),
  }

  const key = getSessionKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  cipher.setAAD(Buffer.from(COOKIE_NAME, 'utf8'))
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8')
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()

  return `${base64UrlEncode(iv)}.${base64UrlEncode(ciphertext)}.${base64UrlEncode(tag)}`
}

export function verifySessionToken(token: string) {
  const parts = token.split('.')
  if (parts.length !== 3) return null

  let iv: Buffer
  let ciphertext: Buffer
  let tag: Buffer
  try {
    iv = base64UrlDecode(parts[0] || '')
    ciphertext = base64UrlDecode(parts[1] || '')
    tag = base64UrlDecode(parts[2] || '')
  } catch {
    return null
  }

  if (iv.length !== 12 || tag.length !== 16) return null

  try {
    const key = getSessionKey()
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAAD(Buffer.from(COOKIE_NAME, 'utf8'))
    decipher.setAuthTag(tag)
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
    const parsed = JSON.parse(plaintext.toString('utf8')) as unknown
    if (typeof parsed !== 'object' || parsed === null) return null
    const payload = parsed as Partial<SessionPayload>
    if (typeof payload.exp !== 'number') return null
    if (Date.now() > payload.exp) return null
    return payload as SessionPayload
  } catch {
    return null
  }
}

export function isAdminRequest(request: Request) {
  const cookie = request.headers.get('cookie') || ''
  const value = parseCookie(cookie)[COOKIE_NAME]
  if (!value) return false
  return verifySessionToken(value) != null
}

export function isAllowedAdminIp(request: Request) {
  const allow = process.env.ADMIN_ALLOWED_IPS
  if (!allow || allow.trim().length === 0) return true

  const allowed = allow
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const ip =
    (request.headers.get('x-vercel-forwarded-for') || '').split(',')[0]?.trim() ||
    (request.headers.get('x-forwarded-for') || '').split(',')[0]?.trim() ||
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    ''

  if (!ip) return false
  return allowed.includes(ip)
}

function getRateLimitState() {
  const g = globalThis as unknown as { __downloadstuffsAdminRateLimit?: Record<string, RateLimitState> }
  if (!g.__downloadstuffsAdminRateLimit) g.__downloadstuffsAdminRateLimit = {}
  return g.__downloadstuffsAdminRateLimit
}

export function checkAdminLoginRateLimit(request: Request) {
  const ip =
    (request.headers.get('x-vercel-forwarded-for') || '').split(',')[0]?.trim() ||
    (request.headers.get('x-forwarded-for') || '').split(',')[0]?.trim() ||
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    'unknown'

  const now = Date.now()
  const state = getRateLimitState()[ip] || { failures: [] }

  if (state.lockedUntil && now < state.lockedUntil) {
    return { ok: false as const, retryAfterSeconds: Math.ceil((state.lockedUntil - now) / 1000) }
  }

  // Keep only last 15 minutes
  state.failures = state.failures.filter((ts) => ts >= now - 15 * 60 * 1000)
  getRateLimitState()[ip] = state

  return { ok: true as const }
}

export function recordAdminLoginFailure(request: Request) {
  const ip =
    (request.headers.get('x-vercel-forwarded-for') || '').split(',')[0]?.trim() ||
    (request.headers.get('x-forwarded-for') || '').split(',')[0]?.trim() ||
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    'unknown'

  const now = Date.now()
  const state = getRateLimitState()[ip] || { failures: [] }
  state.failures.push(now)
  state.failures = state.failures.filter((ts) => ts >= now - 15 * 60 * 1000)

  // Lock for 15 minutes after 8 failures
  if (state.failures.length >= 8) {
    state.lockedUntil = now + 15 * 60 * 1000
    state.failures = []
  }
  getRateLimitState()[ip] = state
}

export function setAdminSessionCookie(headers: Headers, opts?: { maxAgeSeconds?: number }) {
  const configuredTtl = Number(process.env.ADMIN_SESSION_TTL_SECONDS || '')
  const defaultTtl = Number.isFinite(configuredTtl) && configuredTtl > 0 ? configuredTtl : 60 * 60 * 24 * 7
  const maxAge = opts?.maxAgeSeconds ?? defaultTtl
  const value = createSessionToken({ ttlSeconds: maxAge })
  const isProd = process.env.NODE_ENV === 'production'
  const parts = [
    `${COOKIE_NAME}=${value}`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Strict`,
    `Max-Age=${maxAge}`,
    `Priority=High`,
  ]
  if (isProd) parts.push('Secure')
  headers.append('set-cookie', parts.join('; '))
}

export function clearAdminSessionCookie(headers: Headers) {
  const isProd = process.env.NODE_ENV === 'production'
  const parts = [`${COOKIE_NAME}=`, 'Path=/', 'HttpOnly', 'SameSite=Strict', 'Max-Age=0', 'Priority=High']
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
