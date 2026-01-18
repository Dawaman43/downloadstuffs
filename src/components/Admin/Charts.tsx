import * as React from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export type TrafficSeriesPoint = {
  minuteTs: number
  pageviews: number
  searches: number
  detailViews: number
  downloads: number
  downloadErrors: number
}

export type TrafficSnapshot = {
  uniqueVisitors: number
  activeVisitors5m: number
  topCountries: Array<{ country: string; count: number }>
  topPages: Array<{ path: string; count: number }>
  series: Array<TrafficSeriesPoint>
}

function useMounted() {
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  return mounted
}

function formatMinuteLabel(minuteTs: number) {
  return new Date(minuteTs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function TrafficOverTimeChart({ traffic }: { traffic: TrafficSnapshot }) {
  const mounted = useMounted()

  const data = React.useMemo(() => {
    return traffic.series
      .slice(-60)
      .map((p) => ({
        ...p,
        t: formatMinuteLabel(p.minuteTs),
      }))
  }, [traffic.series])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Traffic (last 60 minutes)</CardTitle>
      </CardHeader>
      <CardContent className="h-72">
        {!mounted ? (
          <div className="h-full w-full rounded-md bg-muted animate-pulse" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 18, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
              <XAxis dataKey="t" tickMargin={8} minTickGap={18} />
              <YAxis width={32} tickMargin={8} />
              <Tooltip />
              <Line type="monotone" dataKey="pageviews" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="searches" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="downloads" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}

export function TopCountriesChart({ traffic }: { traffic: TrafficSnapshot }) {
  const mounted = useMounted()
  const data = traffic.topCountries.slice(0, 10)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top countries</CardTitle>
      </CardHeader>
      <CardContent className="h-72">
        {!mounted ? (
          <div className="h-full w-full rounded-md bg-muted animate-pulse" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 18, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
              <XAxis dataKey="country" tickMargin={8} />
              <YAxis width={32} tickMargin={8} />
              <Tooltip />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}

export function TopPagesChart({ traffic }: { traffic: TrafficSnapshot }) {
  const mounted = useMounted()
  const data = traffic.topPages.slice(0, 10)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top pages</CardTitle>
      </CardHeader>
      <CardContent className="h-72">
        {!mounted ? (
          <div className="h-full w-full rounded-md bg-muted animate-pulse" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 10, right: 18, bottom: 0, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
              <XAxis type="number" />
              <YAxis type="category" dataKey="path" width={130} tickMargin={8} />
              <Tooltip />
              <Bar dataKey="count" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
