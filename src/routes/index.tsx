import { createFileRoute } from '@tanstack/react-router';
import Home from '../components/Home';

export const Route = createFileRoute('/')({
	head: ({ location }) => {
		const url = typeof location?.href === 'string' ? location.href : undefined
		return {
			meta: [
				{ title: 'DownloadStuffs — Search Internet Archive' },
				{
					name: 'description',
					content:
						'Search the Internet Archive by keyword and quickly browse, filter, and download public items.',
				},
				{ property: 'og:title', content: 'DownloadStuffs — Search Internet Archive' },
				{
					property: 'og:description',
					content:
						'Search the Internet Archive by keyword and quickly browse, filter, and download public items.',
				},
				...(url ? [{ property: 'og:url', content: url }] : []),
				{ name: 'twitter:title', content: 'DownloadStuffs — Search Internet Archive' },
				{
					name: 'twitter:description',
					content:
						'Search the Internet Archive by keyword and quickly browse, filter, and download public items.',
				},
			],
			links: url ? [{ rel: 'canonical', href: url }] : [],
		}
	},
	component: Home,
})
