import { createFileRoute } from '@tanstack/react-router'

function buildSitemapXml(origin: string) {
  const today = new Date().toISOString().slice(0, 10)

  const urls: Array<{ loc: string; changefreq?: string; priority?: string }> = [
    { loc: `${origin}/`, changefreq: 'daily', priority: '1.0' },
    { loc: `${origin}/result/`, changefreq: 'daily', priority: '0.7' },
  ]

  const body = urls
    .map(
      (u) => `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${today}</lastmod>\n    ${u.changefreq ? `<changefreq>${u.changefreq}</changefreq>\n    ` : ''}${u.priority ? `<priority>${u.priority}</priority>\n  ` : ''}</url>`,
    )
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`
}

async function handler({ request }: { request: Request }) {
  const origin = new URL(request.url).origin
  const xml = buildSitemapXml(origin)
  return new Response(xml, {
    status: 200,
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  })
}

export const Route = createFileRoute('/sitemap/xml')({
  server: {
    handlers: {
      GET: handler,
    },
  },
})
