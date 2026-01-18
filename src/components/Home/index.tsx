import * as React from 'react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { ArchiveIcon, BinocularsIcon } from '@phosphor-icons/react'
import { useNavigate } from '@tanstack/react-router'

export default function Home() {
    const [searchQuery, setSearchQuery] = React.useState('')
    const [loading, setLoading] = React.useState(false)
    const navigate = useNavigate({ from: '/' })

    const canSearch = searchQuery.trim().length > 0

    const handleSearch = React.useCallback(
        (e?: React.FormEvent) => {
            e?.preventDefault()
            const q = searchQuery.trim()
            if (!q) {
                setLoading(false)
                return
            }

            setLoading(true)

            navigate({
                to: '/result',
                params: {},
                search: { q, page: 1, type: 'all' },
            })
        },
        [navigate, searchQuery]
    )

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="w-full max-w-xl flex flex-col items-center gap-6">
                <div className="flex gap-x-3 items-center justify-center">
                    <ArchiveIcon size={30} />
                    <p className="font-clash font-bold text-3xl sm:text-5xl text-center">
                        Download stuffs
                    </p>
                </div>

                <p className="text-sm text-muted-foreground text-center max-w-md">
                    Search Archive.org and download items.
                </p>

                <form
                    onSubmit={handleSearch}
                    className="w-full flex flex-col sm:flex-row gap-3"
                >
                    <Input
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value)
                            if (loading) setLoading(false)
                        }}
                        placeholder="Search (e.g. podcasts, books, software…)"
                        autoFocus
                    />

                    <Button type="submit" disabled={!canSearch || loading}>
                        <BinocularsIcon
                            size={22}
                            className={loading ? 'animate-spin' : ''}
                        />
                        <span className="hidden sm:inline">Search</span>
                    </Button>
                </form>
            </div>
        </div>
    )
}
