# DownloadStuffs

Fast, modern Internet Archive search + preview + downloads.

Live demo: https://downloadstuffss.vercel.app/

> If you find this useful, please ⭐ the repo — it helps more people discover it.

---

## Highlights

- Real server-side pagination (accurate total pages)
- Media-type filtering (movies, audio, texts, software, etc.)
- Beautiful result cards + responsive layout
- Detail pages with previews (custom video player, audio, images)
- “Back to results” keeps your query/page/filter
- Download proxy endpoint (helps avoid CORS issues)

## Screenshots

Home

<img src="public/screenshots/home.png" alt="DownloadStuffs home search" width="900" />

Results

<img src="public/screenshots/results.png" alt="Search results with filters" width="900" />

Detail

<img src="public/screenshots/detail.png" alt="Item detail page with preview" width="900" />

Player (fullscreen)

<img src="public/screenshots/player-fullscreen.png" alt="Custom video player fullscreen" width="900" />


## Quickstart

### Requirements

- Bun (recommended)

### Run locally

```bash
bun install
bun run dev
```

Dev server: http://localhost:3000

### Build & run (production)

```bash
bun run build
bun run start
```

## How it works

- Search uses the Internet Archive Advanced Search API (`advancedsearch.php`) for fast results.
- Item details use the Internet Archive metadata endpoint (`/metadata/:id`).
- Downloads are proxied through the app so browsers can download reliably.

## SEO

- Robots file: [public/robots.txt](public/robots.txt)
- Sitemap: `/sitemap/xml` (generated dynamically from the current domain)

## Configuration

### Environment variables

Optional (controls upstream timeout for downloads):

- `ARCHIVE_UPSTREAM_TIMEOUT_MS` (default: `20000`)

On Vercel: Project Settings → Environment Variables.

## Routes (reference)

- `/` — home search
- `/result?q=...&page=1&type=movies` — results
- `/result/:id` — item details
- `/api/download?id=:id&file=:filename` — download proxy

## Contributing

Contributions are welcome.

- Read: [CONTRIBUTING.md](CONTRIBUTING.md)
- Security policy: [SECURITY.md](SECURITY.md)
- Code of conduct: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

## Roadmap

- Better structured data (JSON-LD) for richer Google results
- Improve sitemap coverage (safe, non-crawling strategy)
- More download formats + batch downloads
- Better error UI for upstream timeouts

## FAQ

### Is this affiliated with Internet Archive?

No. This project is community-built and uses public endpoints provided by https://archive.org/.

### Why do some items not play?

Some items don’t have stream-friendly files (or are restricted). In that case, the page will still show metadata and available downloads.

## License

MIT — see [LICENSE](LICENSE)
