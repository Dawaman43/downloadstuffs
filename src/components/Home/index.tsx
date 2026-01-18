import * as React from 'react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { 
    Library, 
    Search, 
    Loader2, 
    X, 
    Music, 
    Film, 
    BookOpen, 
    Monitor 
} from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { cn } from '@/lib/utils'

export default function Home() {
    const [searchQuery, setSearchQuery] = React.useState('')
    const [isFocused, setIsFocused] = React.useState(false)
    const [loading, setLoading] = React.useState(false)
    const inputRef = React.useRef<HTMLInputElement>(null)
    const navigate = useNavigate({ from: '/' })

    const canSearch = searchQuery.trim().length > 0

    const performSearch = React.useCallback(
        (query: string) => {
            const q = query.trim()
            if (!q) return

            setLoading(true)
            navigate({
                to: '/result',
                params: {},
                search: { q, page: 1, type: 'all', sort: 'relevance' },
            })
        },
        [navigate]
    )

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        performSearch(searchQuery)
    }

    const clearSearch = () => {
        setSearchQuery('')
        inputRef.current?.focus()
    }

    const suggestions = [
        { label: 'Software', icon: Monitor, query: 'software' },
        { label: 'Movies', icon: Film, query: 'movies' },
        { label: 'Books', icon: BookOpen, query: 'books' },
        { label: 'Music', icon: Music, query: 'audio' },
    ]

    return (
        <div className="relative min-h-screen flex flex-col items-center font-chillax justify-center p-4 sm:p-6 overflow-hidden bg-background">
           

            <div className="w-full max-w-2xl flex flex-col items-center z-10 space-y-8 animate-in fade-in zoom-in duration-500">
                <div className="flex flex-col items-center gap-6 text-center">
                    <div className="relative group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-primary/50 to-secondary/50 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                        <div className="relative p-5 rounded-2xl bg-card border shadow-sm">
                            <Library className="w-10 h-10 sm:w-12 sm:h-12 text-primary" />
                        </div>
                    </div>
                    
                    <div className="space-y-3 max-w-lg">
                        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold font-telma tracking-tight text-foreground">
                            Download Stuffs
                        </h1>
                        <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
                            Explore millions of free books, movies, software, and music from the Internet Archive.
                        </p>
                    </div>
                </div>

                <div className="w-full max-w-xl">
                    <form
                        onSubmit={handleSubmit}
                        className={cn(
                            "relative flex items-center w-full rounded-2xl border bg-background shadow-lg transition-all duration-300",
                            isFocused ? "ring-2 ring-primary/20 border-primary shadow-xl scale-[1.01]" : "border-border"
                        )}
                    >
                        <div className="pl-4 text-muted-foreground">
                            <Search className="w-5 h-5" />
                        </div>

                        <Input
                            ref={inputRef}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onFocus={() => setIsFocused(true)}
                            onBlur={() => setIsFocused(false)}
                            placeholder="Search the archive..."
                            className="h-14 border-none bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 text-base sm:text-lg px-3 placeholder:text-muted-foreground/50"
                            autoFocus
                        />

                        {searchQuery && (
                            <button
                                type="button"
                                onClick={clearSearch}
                                className="p-2 mr-1 hover:bg-muted rounded-full text-muted-foreground transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}

                        <div className="pr-1.5 py-1.5">
                            <Button 
                                type="submit" 
                                size="lg"
                                disabled={!canSearch || loading}
                                className="h-11 rounded-xl px-6 font-medium shadow-sm transition-all"
                            >
                                {loading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    'Search'
                                )}
                            </Button>
                        </div>
                    </form>

                    <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mr-1">
                            Quick Look:
                        </span>
                        {suggestions.map((item) => (
                            <button
                                key={item.label}
                                type="button"
                                onClick={() => {
                                    setSearchQuery(item.query)
                                    performSearch(item.query)
                                }}
                                className="group flex items-center gap-1.5 px-3 py-1.5 rounded-full border bg-background/50 hover:bg-primary/5 hover:border-primary/30 text-xs sm:text-sm font-medium text-muted-foreground hover:text-primary transition-all duration-200"
                            >
                                <item.icon className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100" />
                                {item.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
            
            <div className="absolute bottom-6 text-center">
                <p className="text-xs mt-4 text-muted-foreground/40 font-medium">
                    Powered by archive.org
                </p>
            </div>
        </div>
    )
}