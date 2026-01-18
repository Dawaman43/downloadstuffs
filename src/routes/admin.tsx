import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'

import {
  TopCountriesChart,
  TopPagesChart,
  TrafficOverTimeChart,
  type TrafficSnapshot,
} from '@/components/Admin/Charts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

type MetricsSnapshot = {
  startedAt: number
  uptimeMs: number
  counters: {
    pageviews: number
    searches: number
    detailViews: number
    downloads: number
    downloadErrors: number
  }
  recentEvents: Array<{ ts: number; type: string; data?: Record<string, unknown> }>
  traffic: TrafficSnapshot
}

export const Route = createFileRoute('/admin')({
  head: () => ({
    meta: [
      { title: 'Admin — DownloadStuffs' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
  component: AdminPage,
})

function AdminPage() {
  const [password, setPassword] = React.useState('')
  const [status, setStatus] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [metrics, setMetrics] = React.useState<MetricsSnapshot | null>(null)
  const [tab, setTab] = React.useState('overview')

  const fetchMetrics = React.useCallback(async () => {
    const res = await fetch('/api/admin/metrics', { credentials: 'include' })
    if (res.status === 401) {
      setMetrics(null)
      return false
    }
    if (res.status === 403) {
      setMetrics(null)
      setStatus('Forbidden. Check ADMIN_ALLOWED_IPS (if set).')
      return false
    }
    if (res.status === 500) {
      const text = await res.text().catch(() => '')
      setMetrics(null)
      setStatus(
        text?.trim() ||
          'Server misconfigured. Set ADMIN_SESSION_SECRET and ADMIN_PASSWORD (or ADMIN_PASSWORD_HASH).',
      )
      return false
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(text || `Failed: ${res.status}`)
    }
    const json = (await res.json()) as MetricsSnapshot
    setMetrics(json)
    return true
  }, [])

  React.useEffect(() => {
    // Try to load metrics immediately if already logged in
    fetchMetrics().catch(() => {})
  }, [fetchMetrics])

  React.useEffect(() => {
    // Only poll while authenticated; stop immediately on 401.
    if (!metrics) return

    const interval = window.setInterval(() => {
      fetchMetrics().catch(() => {})
    }, 5000)

    return () => window.clearInterval(interval)
  }, [fetchMetrics, metrics])

  async function onLogin(e: React.FormEvent) {
    e.preventDefault()
    setStatus(null)
    setLoading(true)
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password }),
      })

      if (res.status === 401) {
        setStatus('Wrong password')
        return
      }

      if (res.status === 403) {
        setStatus('Forbidden. Your IP is not allowed.')
        return
      }

      if (res.status === 429) {
        const retryAfter = res.headers.get('retry-after')
        setStatus(
          retryAfter
            ? `Too many attempts. Try again in ${retryAfter}s.`
            : 'Too many attempts. Try again later.',
        )
        return
      }

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        setStatus(text || `Login failed (${res.status})`)
        return
      }

      setPassword('')
      setStatus(null)
      await fetchMetrics()
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function onLogout() {
    setStatus(null)
    setLoading(true)
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        credentials: 'include',
      })
      setMetrics(null)
    } finally {
      setLoading(false)
    }
  }

  const fmt = new Intl.NumberFormat()
  const uptime = metrics ? formatUptime(metrics.uptimeMs) : ''

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin</h1>
          <p className="text-sm text-muted-foreground">
            Private dashboard. Set <code className="font-mono">ADMIN_PASSWORD</code> and{' '}
            <code className="font-mono">ADMIN_SESSION_SECRET</code> in your environment.
            <span className="block">
              Optional: <code className="font-mono">ADMIN_PASSWORD_HASH</code> (preferred) and{' '}
              <code className="font-mono">ADMIN_ALLOWED_IPS</code>.
            </span>
          </p>
        </div>
        {metrics ? (
          <Button variant="outline" onClick={onLogout} disabled={loading}>
            Log out
          </Button>
        ) : null}
      </div>

      {!metrics ? (
        <Card>
          <CardHeader>
            <CardTitle>Login</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={onLogin}>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Admin password"
                autoComplete="current-password"
              />
              <div className="flex items-center gap-3">
                <Button type="submit" disabled={loading || password.trim().length === 0}>
                  {loading ? 'Signing in…' : 'Sign in'}
                </Button>
                {status ? <p className="text-sm text-destructive">{status}</p> : null}
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            <MetricCard label="Pageviews" value={fmt.format(metrics.counters.pageviews)} />
            <MetricCard label="Unique visitors" value={fmt.format(metrics.traffic.uniqueVisitors)} />
            <MetricCard label="Active (5m)" value={fmt.format(metrics.traffic.activeVisitors5m)} />
            <MetricCard label="Searches" value={fmt.format(metrics.counters.searches)} />
            <MetricCard label="Downloads" value={fmt.format(metrics.counters.downloads)} />
            <MetricCard label="Errors" value={fmt.format(metrics.counters.downloadErrors)} />
          </div>

          <p className="text-xs text-muted-foreground">
            Note: these stats are in-memory and reset on server restart/cold start. On serverless
            platforms, different requests may hit different instances, so counts can look low or
            temporarily zero.
          </p>

          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="countries">Countries</TabsTrigger>
              <TabsTrigger value="pages">Pages</TabsTrigger>
              <TabsTrigger value="events">Events</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4 space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {tab === 'overview' ? <TrafficOverTimeChart traffic={metrics.traffic} /> : null}
                <Card>
                  <CardHeader>
                    <CardTitle>Server</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground space-y-1">
                    <div>
                      <span className="text-foreground font-medium">Uptime:</span> {uptime}
                    </div>
                    <div>
                      <span className="text-foreground font-medium">Started:</span>{' '}
                      {new Date(metrics.startedAt).toLocaleString()}
                    </div>
                    <div>
                      <span className="text-foreground font-medium">Polling:</span> every 5s
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="countries" className="mt-4 space-y-4">
              {tab === 'countries' ? <TopCountriesChart traffic={metrics.traffic} /> : null}
              <p className="text-xs text-muted-foreground">
                Country is best-effort from proxy headers (e.g. Cloudflare/Vercel). Local dev typically shows
                <span className="font-mono"> XX</span>.
              </p>
            </TabsContent>

            <TabsContent value="pages" className="mt-4 space-y-4">
              {tab === 'pages' ? <TopPagesChart traffic={metrics.traffic} /> : null}
            </TabsContent>

            <TabsContent value="events" className="mt-4">
              {tab === 'events' ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Recent activity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-muted-foreground">
                            <th className="py-2 pr-4">Time</th>
                            <th className="py-2 pr-4">Type</th>
                            <th className="py-2">Data</th>
                          </tr>
                        </thead>
                        <tbody>
                          {metrics.recentEvents.map((e) => (
                            <tr key={`${e.ts}-${e.type}`} className="border-t">
                              <td className="py-2 pr-4 whitespace-nowrap">
                                {new Date(e.ts).toLocaleTimeString()}
                              </td>
                              <td className="py-2 pr-4 font-medium whitespace-nowrap">{e.type}</td>
                              <td className="py-2 font-mono text-xs text-muted-foreground">
                                {e.data ? JSON.stringify(e.data).slice(0, 200) : ''}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </TabsContent>
          </Tabs>

          {status ? <p className="text-sm text-destructive">{status}</p> : null}
        </>
      )}
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground font-medium">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold tracking-tight">{value}</div>
      </CardContent>
    </Card>
  )
}

function formatUptime(ms: number) {
  const s = Math.floor(ms / 1000)
  const secs = s % 60
  const m = Math.floor(s / 60)
  const mins = m % 60
  const h = Math.floor(m / 60)
  const hrs = h % 24
  const d = Math.floor(h / 24)
  const parts: Array<string> = []
  if (d) parts.push(`${d}d`)
  if (d || hrs) parts.push(`${hrs}h`)
  if (d || hrs || mins) parts.push(`${mins}m`)
  parts.push(`${secs}s`)
  return parts.join(' ')
}
