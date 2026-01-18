import { Redis } from '@upstash/redis'

export type MetricsEventType = 'pageview' | 'search' | 'detail' | 'download'

export type MetricsEvent = {
  ts: number
  type: MetricsEventType
  data?: Record<string, unknown>
}

export type MetricsSnapshot = {
  startedAt: number
  uptimeMs: number
  counters: {
    pageviews: number
    searches: number
    detailViews: number
    downloads: number
    downloadErrors: number
  }
  recentEvents: Array<MetricsEvent>
  traffic: {
    uniqueVisitors: number
    activeVisitors5m: number
    topCountries: Array<{ country: string; count: number }>
    topPages: Array<{ path: string; count: number }>
    series: Array<{
      minuteTs: number
      pageviews: number
      searches: number
      detailViews: number
      downloads: number
      downloadErrors: number
    }>
  }
}

type MetricsState = {
  startedAt: number
  pageviews: number
  searches: number
  detailViews: number
  downloads: number
  downloadErrors: number
  recentEvents: Array<MetricsEvent>
  pageviewsByPath: Record<string, number>
  countriesByCode: Record<string, number>
  visitorLastSeen: Record<string, number>
  uniqueVisitors: Set<string>
  minuteBuckets: Array<{
    minuteTs: number
    pageviews: number
    searches: number
    detailViews: number
    downloads: number
    downloadErrors: number
  }>
}

type RedisEnv = { url: string; token: string }

function getRedisEnv(): RedisEnv | null {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_URL ||
    ''
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_TOKEN ||
    ''
  if (!url || !token) return null
  return { url, token }
}

function getRedisClient(): Redis | null {
  const g = globalThis as unknown as { __downloadstuffsRedis?: Redis | null }
  if (g.__downloadstuffsRedis !== undefined) return g.__downloadstuffsRedis

  const env = getRedisEnv()
  if (!env) {
    g.__downloadstuffsRedis = null
    return null
  }

  g.__downloadstuffsRedis = new Redis({ url: env.url, token: env.token })
  return g.__downloadstuffsRedis
}

const REDIS_PREFIX = 'downloadstuffs:metrics'

function k(...parts: Array<string>) {
  return [REDIS_PREFIX, ...parts].join(':')
}

function minuteKey(minuteTs: number) {
  return k('minute', String(minuteTs))
}

function toNumber(value: unknown) {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
  return Number.isFinite(n) ? n : 0
}

function parseZRangeWithScores(input: unknown) {
  // Upstash zrange withScores returns: [member, score, member, score, ...]
  if (!Array.isArray(input)) return [] as Array<{ member: string; score: number }>
  const out: Array<{ member: string; score: number }> = []
  for (let i = 0; i < input.length; i += 2) {
    const member = input[i]
    const score = input[i + 1]
    if (typeof member === 'string') out.push({ member, score: toNumber(score) })
  }
  return out
}

function getState(): MetricsState {
  const g = globalThis as unknown as { __downloadstuffsMetrics?: MetricsState }
  if (!g.__downloadstuffsMetrics) {
    g.__downloadstuffsMetrics = {
      startedAt: Date.now(),
      pageviews: 0,
      searches: 0,
      detailViews: 0,
      downloads: 0,
      downloadErrors: 0,
      recentEvents: [],
      pageviewsByPath: {},
      countriesByCode: {},
      visitorLastSeen: {},
      uniqueVisitors: new Set<string>(),
      minuteBuckets: [],
    }
  }
  return g.__downloadstuffsMetrics
}

function pushEvent(event: MetricsEvent) {
  const state = getState()
  state.recentEvents.unshift(event)
  if (state.recentEvents.length > 50) state.recentEvents.length = 50
}

function getMetricsSalt() {
  return (
    process.env.METRICS_SALT ||
    process.env.ADMIN_SESSION_SECRET ||
    // dev fallback (not secure, but fine for local-only metrics)
    'downloadstuffs-dev'
  )
}

function fnv1aHex(input: string) {
  // Non-cryptographic hash (browser-safe) used only to avoid storing raw IP/UA.
  // Not a security boundary.
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  // Convert to unsigned 32-bit hex
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function parseClientIp(request: Request) {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]?.trim() || ''
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    request.headers.get('x-client-ip') ||
    ''
  )
}

function normalizeCountryCode(value: string | null) {
  const raw = (value || '').trim().toUpperCase()
  if (!raw) return 'XX'
  if (raw.length === 2 && /^[A-Z]{2}$/.test(raw)) return raw
  return 'XX'
}

function getCountryFromRequest(request: Request) {
  return normalizeCountryCode(
    request.headers.get('cf-ipcountry') ||
      request.headers.get('x-vercel-ip-country') ||
      request.headers.get('cloudfront-viewer-country') ||
      request.headers.get('x-country') ||
      request.headers.get('x-geo-country'),
  )
}

function getVisitorId(request: Request) {
  const ip = parseClientIp(request)
  const ua = request.headers.get('user-agent') || ''
  if (!ip && !ua) return ''
  return fnv1aHex(`${ip}|${ua}|${getMetricsSalt()}`)
}

function getPathFromRequest(request: Request) {
  try {
    return new URL(request.url).pathname || '/'
  } catch {
    return '/'
  }
}

function bumpMinuteBucket(
  now: number,
  type: 'pageviews' | 'searches' | 'detailViews' | 'downloads' | 'downloadErrors',
) {
  const state = getState()
  const minuteTs = Math.floor(now / 60000) * 60000

  let bucket = state.minuteBuckets[0]
  if (!bucket || bucket.minuteTs !== minuteTs) {
    bucket = {
      minuteTs,
      pageviews: 0,
      searches: 0,
      detailViews: 0,
      downloads: 0,
      downloadErrors: 0,
    }
    state.minuteBuckets.unshift(bucket)
  }

  bucket[type] += 1

  // Keep last 2 hours
  const cutoff = minuteTs - 120 * 60000
  state.minuteBuckets = state.minuteBuckets.filter((b) => b.minuteTs >= cutoff)
}

function recordVisitor(request: Request, now: number) {
  const state = getState()
  const visitorId = getVisitorId(request)
  if (!visitorId) return

  state.uniqueVisitors.add(visitorId)
  state.visitorLastSeen[visitorId] = now
}

export async function recordPageView(request: Request, opts?: { path?: string }) {
  const redis = getRedisClient()
  if (redis) {
    const now = Date.now()
    const path = (opts?.path || getPathFromRequest(request)).trim() || '/'
    const country = getCountryFromRequest(request)
    const visitorId = getVisitorId(request)
    const minuteTs = Math.floor(now / 60000) * 60000

    const eventsKey = k('events')
    const countersKey = k('counters')
    const topPagesKey = k('topPages')
    const topCountriesKey = k('topCountries')
    const visitorsKey = k('visitors')
    const lastSeenKey = k('visitorsLastSeen')
    const startedAtKey = k('startedAt')

    const event = JSON.stringify({ ts: now, type: 'pageview', data: { path, country } })

    // Best-effort writes; we await to make serverless reliable.
    await Promise.all([
      redis.set(startedAtKey, now, { nx: true }),
      redis.hincrby(countersKey, 'pageviews', 1),
      redis.zincrby(topPagesKey, 1, path),
      redis.zincrby(topCountriesKey, 1, country),
      redis.hincrby(minuteKey(minuteTs), 'pageviews', 1),
      redis.expire(minuteKey(minuteTs), 60 * 60 * 3),
      redis.lpush(eventsKey, event),
      redis.ltrim(eventsKey, 0, 49),
      redis.expire(eventsKey, 60 * 60 * 24 * 7),
      visitorId.length > 0
        ? Promise.all([
            redis.sadd(visitorsKey, visitorId),
            redis.expire(visitorsKey, 60 * 60 * 24 * 30),
            redis.zadd(lastSeenKey, { score: now, member: visitorId }),
            redis.zremrangebyscore(lastSeenKey, 0, now - 2 * 60 * 60 * 1000),
            redis.expire(lastSeenKey, 60 * 60 * 24 * 30),
          ])
        : Promise.resolve(null),
    ])
    return
  }

  const state = getState()
  const now = Date.now()
  const path = (opts?.path || getPathFromRequest(request)).trim() || '/'
  const country = getCountryFromRequest(request)

  state.pageviews += 1
  state.pageviewsByPath[path] = (state.pageviewsByPath[path] || 0) + 1
  state.countriesByCode[country] = (state.countriesByCode[country] || 0) + 1
  recordVisitor(request, now)
  bumpMinuteBucket(now, 'pageviews')

  pushEvent({ ts: now, type: 'pageview', data: { path, country } })
}

export async function recordSearch(data: Record<string, unknown>, request?: Request) {
  const redis = getRedisClient()
  if (redis) {
    const now = Date.now()
    const minuteTs = Math.floor(now / 60000) * 60000
    const eventsKey = k('events')
    const countersKey = k('counters')
    const startedAtKey = k('startedAt')
    const visitorsKey = k('visitors')
    const lastSeenKey = k('visitorsLastSeen')
    const visitorId = request ? getVisitorId(request) : ''

    const event = JSON.stringify({ ts: now, type: 'search', data })

    await Promise.all([
      redis.set(startedAtKey, now, { nx: true }),
      redis.hincrby(countersKey, 'searches', 1),
      redis.hincrby(minuteKey(minuteTs), 'searches', 1),
      redis.expire(minuteKey(minuteTs), 60 * 60 * 3),
      redis.lpush(eventsKey, event),
      redis.ltrim(eventsKey, 0, 49),
      redis.expire(eventsKey, 60 * 60 * 24 * 7),
      visitorId.length > 0
        ? Promise.all([
            redis.sadd(visitorsKey, visitorId),
            redis.expire(visitorsKey, 60 * 60 * 24 * 30),
            redis.zadd(lastSeenKey, { score: now, member: visitorId }),
            redis.zremrangebyscore(lastSeenKey, 0, now - 2 * 60 * 60 * 1000),
            redis.expire(lastSeenKey, 60 * 60 * 24 * 30),
          ])
        : Promise.resolve(null),
    ])
    return
  }

  const state = getState()
  const now = Date.now()
  state.searches += 1
  bumpMinuteBucket(now, 'searches')
  if (request) recordVisitor(request, now)
  pushEvent({ ts: now, type: 'search', data })
}

export async function recordDetailView(data: Record<string, unknown>, request?: Request) {
  const redis = getRedisClient()
  if (redis) {
    const now = Date.now()
    const minuteTs = Math.floor(now / 60000) * 60000
    const eventsKey = k('events')
    const countersKey = k('counters')
    const startedAtKey = k('startedAt')
    const visitorsKey = k('visitors')
    const lastSeenKey = k('visitorsLastSeen')
    const visitorId = request ? getVisitorId(request) : ''
    const event = JSON.stringify({ ts: now, type: 'detail', data })

    await Promise.all([
      redis.set(startedAtKey, now, { nx: true }),
      redis.hincrby(countersKey, 'detailViews', 1),
      redis.hincrby(minuteKey(minuteTs), 'detailViews', 1),
      redis.expire(minuteKey(minuteTs), 60 * 60 * 3),
      redis.lpush(eventsKey, event),
      redis.ltrim(eventsKey, 0, 49),
      redis.expire(eventsKey, 60 * 60 * 24 * 7),
      visitorId.length > 0
        ? Promise.all([
            redis.sadd(visitorsKey, visitorId),
            redis.expire(visitorsKey, 60 * 60 * 24 * 30),
            redis.zadd(lastSeenKey, { score: now, member: visitorId }),
            redis.zremrangebyscore(lastSeenKey, 0, now - 2 * 60 * 60 * 1000),
            redis.expire(lastSeenKey, 60 * 60 * 24 * 30),
          ])
        : Promise.resolve(null),
    ])
    return
  }

  const state = getState()
  const now = Date.now()
  state.detailViews += 1
  bumpMinuteBucket(now, 'detailViews')
  if (request) recordVisitor(request, now)
  pushEvent({ ts: now, type: 'detail', data })
}

export async function recordDownload(data: Record<string, unknown>, request?: Request) {
  const redis = getRedisClient()
  if (redis) {
    const now = Date.now()
    const minuteTs = Math.floor(now / 60000) * 60000
    const eventsKey = k('events')
    const countersKey = k('counters')
    const startedAtKey = k('startedAt')
    const visitorsKey = k('visitors')
    const lastSeenKey = k('visitorsLastSeen')
    const visitorId = request ? getVisitorId(request) : ''
    const event = JSON.stringify({ ts: now, type: 'download', data })

    await Promise.all([
      redis.set(startedAtKey, now, { nx: true }),
      redis.hincrby(countersKey, 'downloads', 1),
      redis.hincrby(minuteKey(minuteTs), 'downloads', 1),
      redis.expire(minuteKey(minuteTs), 60 * 60 * 3),
      redis.lpush(eventsKey, event),
      redis.ltrim(eventsKey, 0, 49),
      redis.expire(eventsKey, 60 * 60 * 24 * 7),
      visitorId.length > 0
        ? Promise.all([
            redis.sadd(visitorsKey, visitorId),
            redis.expire(visitorsKey, 60 * 60 * 24 * 30),
            redis.zadd(lastSeenKey, { score: now, member: visitorId }),
            redis.zremrangebyscore(lastSeenKey, 0, now - 2 * 60 * 60 * 1000),
            redis.expire(lastSeenKey, 60 * 60 * 24 * 30),
          ])
        : Promise.resolve(null),
    ])
    return
  }

  const state = getState()
  const now = Date.now()
  state.downloads += 1
  bumpMinuteBucket(now, 'downloads')
  if (request) recordVisitor(request, now)
  pushEvent({ ts: now, type: 'download', data })
}

export async function recordDownloadError(data: Record<string, unknown>, request?: Request) {
  const redis = getRedisClient()
  if (redis) {
    const now = Date.now()
    const minuteTs = Math.floor(now / 60000) * 60000
    const eventsKey = k('events')
    const countersKey = k('counters')
    const startedAtKey = k('startedAt')
    const visitorsKey = k('visitors')
    const lastSeenKey = k('visitorsLastSeen')
    const visitorId = request ? getVisitorId(request) : ''
    const event = JSON.stringify({ ts: now, type: 'download', data: { ...data, error: true } })

    await Promise.all([
      redis.set(startedAtKey, now, { nx: true }),
      redis.hincrby(countersKey, 'downloadErrors', 1),
      redis.hincrby(minuteKey(minuteTs), 'downloadErrors', 1),
      redis.expire(minuteKey(minuteTs), 60 * 60 * 3),
      redis.lpush(eventsKey, event),
      redis.ltrim(eventsKey, 0, 49),
      redis.expire(eventsKey, 60 * 60 * 24 * 7),
      visitorId.length > 0
        ? Promise.all([
            redis.sadd(visitorsKey, visitorId),
            redis.expire(visitorsKey, 60 * 60 * 24 * 30),
            redis.zadd(lastSeenKey, { score: now, member: visitorId }),
            redis.zremrangebyscore(lastSeenKey, 0, now - 2 * 60 * 60 * 1000),
            redis.expire(lastSeenKey, 60 * 60 * 24 * 30),
          ])
        : Promise.resolve(null),
    ])
    return
  }

  const state = getState()
  const now = Date.now()
  state.downloadErrors += 1
  bumpMinuteBucket(now, 'downloadErrors')
  if (request) recordVisitor(request, now)
  pushEvent({ ts: now, type: 'download', data: { ...data, error: true } })
}

function topNFromRecord(rec: Record<string, number>, n: number, keyName: string) {
  return Object.entries(rec)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key, v]) => ({ [keyName]: key, count: v }))
}

function getActiveVisitors5m(now: number) {
  const state = getState()
  const cutoff = now - 5 * 60 * 1000
  let active = 0
  for (const lastSeen of Object.values(state.visitorLastSeen)) {
    if (lastSeen >= cutoff) active += 1
  }
  return active
}

export async function getMetricsSnapshot(): Promise<MetricsSnapshot> {
  const redis = getRedisClient()
  if (redis) {
    const now = Date.now()
    const startedAtKey = k('startedAt')
    const countersKey = k('counters')
    const eventsKey = k('events')
    const visitorsKey = k('visitors')
    const lastSeenKey = k('visitorsLastSeen')
    const topCountriesKey = k('topCountries')
    const topPagesKey = k('topPages')

    const startedAtRaw = await redis.get(startedAtKey)
    const startedAt = toNumber(startedAtRaw) || now

    const countersRaw = (await redis.hgetall<Record<string, unknown>>(countersKey)) || {}
    const [eventsRaw, uniqueVisitorsRaw, active5mRaw, topCountriesRaw, topPagesRaw] = await Promise.all([
      redis.lrange(eventsKey, 0, 49),
      redis.scard(visitorsKey),
      redis.zcount(lastSeenKey, now - 5 * 60 * 1000, '+inf'),
      redis.zrange(topCountriesKey, 0, 11, { rev: true, withScores: true } as any),
      redis.zrange(topPagesKey, 0, 11, { rev: true, withScores: true } as any),
    ])

    const events = (Array.isArray(eventsRaw) ? eventsRaw : [])
      .map((s) => {
        if (typeof s !== 'string') return null
        try {
          return JSON.parse(s) as MetricsEvent
        } catch {
          return null
        }
      })
      .filter(Boolean) as Array<MetricsEvent>

    const topCountries = parseZRangeWithScores(topCountriesRaw).map(({ member, score }) => ({
      country: member,
      count: score,
    }))

    const topPages = parseZRangeWithScores(topPagesRaw).map(({ member, score }) => ({
      path: member,
      count: score,
    }))

    const seriesPoints = 120
    const seriesStartMinuteTs = Math.floor(now / 60000) * 60000 - (seriesPoints - 1) * 60000
    const minuteKeys: Array<{ minuteTs: number; key: string }> = []
    for (let i = 0; i < seriesPoints; i += 1) {
      const minuteTs = seriesStartMinuteTs + i * 60000
      minuteKeys.push({ minuteTs, key: minuteKey(minuteTs) })
    }

    const minuteBuckets = await Promise.all(
      minuteKeys.map(async ({ key }) => {
        const raw = await redis.hgetall<Record<string, unknown>>(key)
        return raw || {}
      }),
    )

    const series = minuteKeys.map(({ minuteTs }, idx) => {
      const raw = minuteBuckets[idx] || {}
      return {
        minuteTs,
        pageviews: toNumber(raw.pageviews),
        searches: toNumber(raw.searches),
        detailViews: toNumber(raw.detailViews),
        downloads: toNumber(raw.downloads),
        downloadErrors: toNumber(raw.downloadErrors),
      }
    })

    return {
      startedAt,
      uptimeMs: Math.max(0, now - startedAt),
      counters: {
        pageviews: toNumber(countersRaw.pageviews),
        searches: toNumber(countersRaw.searches),
        detailViews: toNumber(countersRaw.detailViews),
        downloads: toNumber(countersRaw.downloads),
        downloadErrors: toNumber(countersRaw.downloadErrors),
      },
      recentEvents: events,
      traffic: {
        uniqueVisitors: toNumber(uniqueVisitorsRaw),
        activeVisitors5m: toNumber(active5mRaw),
        topCountries,
        topPages,
        series,
      },
    }
  }

  const state = getState()
  const now = Date.now()
  const series = [...state.minuteBuckets]
    .sort((a, b) => a.minuteTs - b.minuteTs)
    .slice(-120)

  return {
    startedAt: state.startedAt,
    uptimeMs: Math.max(0, now - state.startedAt),
    counters: {
      pageviews: state.pageviews,
      searches: state.searches,
      detailViews: state.detailViews,
      downloads: state.downloads,
      downloadErrors: state.downloadErrors,
    },
    recentEvents: [...state.recentEvents],
    traffic: {
      uniqueVisitors: state.uniqueVisitors.size,
      activeVisitors5m: getActiveVisitors5m(now),
      topCountries: topNFromRecord(state.countriesByCode, 12, 'country') as Array<{
        country: string
        count: number
      }>,
      topPages: topNFromRecord(state.pageviewsByPath, 12, 'path') as Array<{
        path: string
        count: number
      }>,
      series,
    },
  }
}
