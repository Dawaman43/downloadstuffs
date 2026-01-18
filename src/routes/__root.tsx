import {
    HeadContent,
    Scripts,
    createRootRouteWithContext,
} from '@tanstack/react-router';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';
import { TanStackDevtools } from '@tanstack/react-devtools';


import TanStackQueryDevtools from '../integrations/tanstack-query/devtools';

import appCss from '../styles.css?url';

import type { QueryClient } from '@tanstack/react-query';

import type { TRPCRouter } from '@/integrations/trpc/router';
import type { TRPCOptionsProxy } from '@trpc/tanstack-react-query';

interface MyRouterContext {
    queryClient: QueryClient;

    trpc: TRPCOptionsProxy<TRPCRouter>;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
    head: () => ({
        meta: [
            {
                charSet: 'utf-8',
            },
            {
                name: 'viewport',
                content: 'width=device-width, initial-scale=1',
            },
            {
                title: 'DownloadStuffs',
            },
            {
                name: 'description',
                content:
                    'Search the Internet Archive and download public items with filters, pagination, and a great built-in player.',
            },
            {
                name: 'robots',
                content: 'index, follow',
            },
            {
                property: 'og:site_name',
                content: 'DownloadStuffs',
            },
            {
                property: 'og:type',
                content: 'website',
            },
            {
                property: 'og:title',
                content: 'DownloadStuffs',
            },
            {
                property: 'og:description',
                content:
                    'Search the Internet Archive and download public items with filters, pagination, and a great built-in player.',
            },
            {
                property: 'og:image',
                content: '/logo512.png',
            },
            {
                name: 'twitter:card',
                content: 'summary_large_image',
            },
            {
                name: 'twitter:title',
                content: 'DownloadStuffs',
            },
            {
                name: 'twitter:description',
                content:
                    'Search the Internet Archive and download public items with filters, pagination, and a great built-in player.',
            },
            {
                name: 'twitter:image',
                content: '/logo512.png',
            },
            {
                name: 'theme-color',
                content: '#0b1220',
            },
        ],
        links: [
            {
                rel: 'stylesheet',
                href: appCss,
            },
            {
                rel: 'icon',
                href: '/favicon.ico',
            },
            {
                rel: 'manifest',
                href: '/manifest.json',
            },
            {
                rel: 'apple-touch-icon',
                href: '/logo192.png',
            },
            {
                rel: 'preconnect',
                href: 'https://archive.org',
            },
        ],
    }),

    shellComponent: RootDocument,
    errorComponent: RootError,
});

function RootError({ error }: { error: unknown }) {
    const message = error instanceof Error ? error.message : String(error)
    return (
        <div className="min-h-[60vh] w-full flex items-center justify-center px-6 py-14">
            <div className="max-w-xl w-full rounded-xl border bg-card p-6 text-center space-y-3">
                <h1 className="text-xl font-semibold">Something went wrong</h1>
                <p className="text-sm text-muted-foreground wrap-break-word">{message}</p>
                <a
                    href="/"
                    className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                >
                    Go Home
                </a>
            </div>
        </div>
    )
}

function RootDocument({ children }: { children: React.ReactNode; }) {
    return (
        <html lang="en">
            <head>
                <HeadContent />
            </head>
            <body>

                {children}
                <TanStackDevtools
                    config={{
                        position: 'bottom-right',
                    }}
                    plugins={[
                        {
                            name: 'Tanstack Router',
                            render: <TanStackRouterDevtoolsPanel />,
                        },
                        TanStackQueryDevtools,
                    ]}
                />
                <Scripts />
            </body>
        </html>
    );
}
