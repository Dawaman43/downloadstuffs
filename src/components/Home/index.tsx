import * as React from 'react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { ArchiveIcon, BinocularsIcon, MagnifyingGlassIcon } from '@phosphor-icons/react'
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
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background selection:bg-primary/10">
            <div className="w-full max-w-2xl flex flex-col items-center">
                <div className="mb-10 flex flex-col items-center gap-4">
                    <div className="p-4 rounded-2xl bg-primary/5 text-primary">
                        <ArchiveIcon size={48} weight="duotone" />
                    </div>
                    <div className="space-y-2 text-center">
                        <h1 className="font-clash font-bold text-4xl sm:text-6xl tracking-tight">
                            Download <span className="text-primary">Stuffs</span>
                        </h1>
                        <p className="text-base sm:text-lg text-muted-foreground max-w-sm mx-auto leading-relaxed">
                            Access millions of free books, movies, software, and music from Archive.org.
                        </p>
                    </div>
                </div>

                <form
                    onSubmit={handleSearch}
                    className="w-full group relative flex flex-col sm:flex-row items-stretch gap-3 p-2 rounded-2xl border bg-card shadow-xl transition-all focus-within:ring-2 focus-within:ring-primary/20"
                >
                    <div className="relative flex-1 flex items-center">
                        <MagnifyingGlassIcon 
                            size={20} 
                            className="absolute left-4 text-muted-foreground group-focus-within:text-primary transition-colors" 
                        />
                        <Input
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value)
                                if (loading) setLoading(false)
                            }}
                            placeholder="What are you looking for?"
                            className="h-12 pl-11 bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 text-lg"
                            autoFocus
                        />
                    </div>

                    <Button 
                        type="submit" 
                        disabled={!canSearch || loading}
                        className="h-12 px-8 rounded-xl font-semibold transition-all active:scale-95"
                    >
                        {loading ? (
                            <BinocularsIcon size={22} className="animate-spin" />
                        ) : (
                            <>
                                <MagnifyingGlassIcon size={20} weight="bold" className="mr-2" />
                                <span>Search</span>
                            </>
                        )}
                    </Button>
                </form>

                <div className="mt-8 flex flex-wrap justify-center gap-2 opacity-60">
                    {['Software', 'Movies', 'Books', 'Music'].map((tag) => (
                        <button
                            key={tag}
                            onClick={() => setSearchQuery(tag.toLowerCase())}
                            className="text-xs font-medium px-3 py-1 rounded-full border hover:bg-secondary hover:text-secondary-foreground transition-colors"
                        >
                            {tag}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
}