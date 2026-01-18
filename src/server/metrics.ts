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

export function recordPageView(request: Request, opts?: { path?: string }) {
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

export function recordSearch(data: Record<string, unknown>, request?: Request) {
  const state = getState()
  const now = Date.now()
  state.searches += 1
  bumpMinuteBucket(now, 'searches')
  if (request) recordVisitor(request, now)
  pushEvent({ ts: now, type: 'search', data })
}

export function recordDetailView(data: Record<string, unknown>, request?: Request) {
  const state = getState()
  const now = Date.now()
  state.detailViews += 1
  bumpMinuteBucket(now, 'detailViews')
  if (request) recordVisitor(request, now)
  pushEvent({ ts: now, type: 'detail', data })
}

export function recordDownload(data: Record<string, unknown>, request?: Request) {
  const state = getState()
  const now = Date.now()
  state.downloads += 1
  bumpMinuteBucket(now, 'downloads')
  if (request) recordVisitor(request, now)
  pushEvent({ ts: now, type: 'download', data })
}

export function recordDownloadError(data: Record<string, unknown>, request?: Request) {
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
    .map(([k, v]) => ({ [keyName]: k, count: v }))
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

export function getMetricsSnapshot(): MetricsSnapshot {
  const state = getState()
  const now = Date.now()

  const series = [...state.minuteBuckets]
    .sort((a, b) => a.minuteTs - b.minuteTs)
    .slice(-120)

  return {
    startedAt: state.startedAt,
    uptimeMs: Math.max(0, Date.now() - state.startedAt),
    counters: {
      pageviews: state.pageviews,
      searches: state.searches,
      detailViews: state.detailViews,
      downloads: state.downloads,
      downloadErrors: state.downloadErrors,
    },
    recentEvents: state.recentEvents,
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
