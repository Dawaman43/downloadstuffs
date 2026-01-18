import { Link, useParams, useSearch } from "@tanstack/react-router";
import * as React from 'react'
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import VideoPlayer from "@/components/Result/VideoPlayer";
import { 
    ArrowLeft, 
    Download, 
    ExternalLink, 
    FileAudio, 
    FileVideo, 
    FileImage, 
    FileText,
    User
} from "lucide-react";

// --- Helpers ---
function stripHtml(input: unknown) {
    if (input == null) return "";
    const text = Array.isArray(input)
        ? input.filter((v) => typeof v === "string" && v.trim().length > 0).join(" ")
        : typeof input === "string"
          ? input
          : String(input);
    return text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function asArray(value?: string | string[]) {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
}

type ArchiveFile = {
    name?: string;
    source?: string;
    format?: string;
    private?: string;
    size?: string;
};

function isPublicFile(file: ArchiveFile) {
    return !!file?.name && file.private !== "true";
}

function getFileIcon(filename: string) {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (['mp4', 'mkv', 'webm', 'avi'].includes(ext!)) return <FileVideo className="w-4 h-4" />;
    if (['mp3', 'wav', 'flac', 'ogg'].includes(ext!)) return <FileAudio className="w-4 h-4" />;
    if (['jpg', 'png', 'gif', 'webp'].includes(ext!)) return <FileImage className="w-4 h-4" />;
    return <FileText className="w-4 h-4" />;
}

// --- Main Component ---
export default function ResultDetails({ item }: { item: any }) {
    const { id } = useParams({ from: "/result/$id" });
    const back = useSearch({ from: "/result/$id" });

    const [fallbackItem, setFallbackItem] = React.useState<any>(null)
    const [fallbackLoading, setFallbackLoading] = React.useState(false)

    React.useEffect(() => {
        if (item?.metadata) return
        if (!id) return

        let cancelled = false
        setFallbackLoading(true)

        fetch(`https://archive.org/metadata/${encodeURIComponent(id)}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((json) => {
                if (cancelled) return
                setFallbackItem(json)
            })
            .catch(() => {
                if (cancelled) return
                setFallbackItem(null)
            })
            .finally(() => {
                if (cancelled) return
                setFallbackLoading(false)
            })

        return () => {
            cancelled = true
        }
    }, [id, item?.metadata])

    const resolvedItem = item?.metadata ? item : fallbackItem

    if (!resolvedItem?.metadata) {
        return (
            <div className="p-10 text-center space-y-3">
                <div className="text-lg font-medium">
                    {fallbackLoading ? 'Loading item…' : 'Item not found.'}
                </div>
                <div className="text-sm text-muted-foreground">
                    {id ? (
                        <a
                            className="underline"
                            href={`https://archive.org/details/${encodeURIComponent(id)}`}
                            target="_blank"
                            rel="noreferrer"
                        >
                            Open on archive.org
                        </a>
                    ) : null}
                </div>
            </div>
        )
    }

    // --- Data Processing ---
    const metadata = resolvedItem.metadata as Record<string, any>;
    const subjects = asArray(metadata.subject);
    const description = stripHtml(metadata.description);
    const files: ArchiveFile[] = Array.isArray(resolvedItem.files) ? resolvedItem.files : [];
    const publicFiles = files.filter(isPublicFile);
    const thumbUrl = `https://archive.org/services/img/${id}`;

    // Logic to find best media
    const videoFile = publicFiles.find(f => ['.mp4', '.webm'].some(ext => f.name?.endsWith(ext)) && f.source === 'original') 
                   || publicFiles.find(f => ['.mp4', '.webm'].some(ext => f.name?.endsWith(ext)));
                   
    const audioFile: ArchiveFile | undefined = videoFile
        ? undefined
        : publicFiles.find(
              (f) =>
                  ['.mp3', '.ogg', '.flac'].some((ext) => f.name?.endsWith(ext)) &&
                  f.source === 'original'
          ) ||
          publicFiles.find((f) =>
              ['.mp3', '.ogg', '.flac'].some((ext) => f.name?.endsWith(ext))
          );

    const imageFiles = publicFiles.filter(f => ['.jpg', '.jpeg', '.png', '.webp'].some(ext => f.name?.endsWith(ext))).slice(0, 12);
    const downloadableFiles = publicFiles.filter((f) => f.source === "original" && !f.name?.endsWith('.xml') && !f.name?.endsWith('.sqlite')).slice(0, 8);
    const preferredDownloadName = videoFile?.name ?? audioFile?.name ?? downloadableFiles[0]?.name;

    return (
        <div className="relative min-h-screen w-full bg-background overflow-hidden selection:bg-primary/20">
            {/* Ambient Background */}
            <div className="absolute inset-0 z-0 opacity-10 pointer-events-none">
                <img 
                    src={thumbUrl} 
                    className="w-full h-full object-cover blur-[100px] scale-110" 
                    alt="" 
                />
                <div className="absolute inset-0 bg-linear-to-t from-background via-background/80 to-background/20" />
            </div>

            <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-6 md:py-12">
                {/* Navigation */}
                <div className="mb-8">
                    <Link
                        to="/result"
                        search={() => ({
                            q: back.fromQ ?? '',
                            page: back.fromPage ?? 1,
                            type: back.fromType ?? 'all',
                        })}
                        onClick={(e) => {
                            if (!back.fromQ && typeof window !== 'undefined') {
                                e.preventDefault()
                                window.history.back()
                            }
                        }}
                        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group"
                    >
                        <div className="p-2 rounded-full bg-background/50 border backdrop-blur-sm group-hover:border-primary/50 transition-colors">
                            <ArrowLeft className="w-4 h-4" />
                        </div>
                        <span>Back to Results</span>
                    </Link>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-8 lg:gap-16 items-start">
                    
                    {/* LEFT COLUMN: Media Player & Visuals */}
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="relative rounded-2xl overflow-hidden bg-black/5 border shadow-2xl shadow-black/10 aspect-video lg:aspect-auto">
                            {videoFile ? (
                                <VideoPlayer
                                    title={metadata.title}
                                    poster={thumbUrl}
                                    src={`https://archive.org/download/${id}/${encodeURIComponent(videoFile.name!)}`}
                                    className="h-full w-full"
                                />
                            ) : audioFile ? (
                                <div className="flex flex-col items-center justify-center p-10 h-full min-h-100 bg-secondary/10 backdrop-blur-sm">
                                    <div className="w-48 h-48 sm:w-64 sm:h-64 rounded-xl shadow-2xl overflow-hidden mb-8">
                                        <img src={thumbUrl} className="w-full h-full object-cover" alt="Album Art" />
                                    </div>
                                    <audio
                                        controls
                                        className="w-full max-w-md"
                                        src={`https://archive.org/download/${id}/${encodeURIComponent(audioFile.name!)}`}
                                    />
                                </div>
                            ) : (
                                <div className="w-full h-full min-h-100 bg-secondary/5 flex items-center justify-center">
                                    <img 
                                        src={thumbUrl} 
                                        className="w-full h-full object-contain" 
                                        alt={metadata.title} 
                                    />
                                </div>
                            )}
                        </div>

                        {/* Image Gallery Grid (if separate images exist) */}
                        {imageFiles.length > 0 && !videoFile && (
                            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                                {imageFiles.map((f, i) => (
                                    <a 
                                        key={i} 
                                        href={`https://archive.org/download/${id}/${encodeURIComponent(f.name!)}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="block aspect-square rounded-md overflow-hidden opacity-70 hover:opacity-100 hover:ring-2 ring-primary transition-all"
                                    >
                                        <img 
                                            src={`https://archive.org/download/${id}/${encodeURIComponent(f.name!)}`}
                                            className="w-full h-full object-cover"
                                            loading="lazy"
                                        />
                                    </a>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* RIGHT COLUMN: Metadata & Actions */}
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
                        
                        {/* Title Section */}
                        <div className="space-y-4">
                            <div className="flex flex-wrap gap-2">
                                <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-normal bg-primary/10 text-primary hover:bg-primary/20">
                                    {metadata.mediatype}
                                </Badge>
                                {metadata.year && (
                                    <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-normal border-primary/20">
                                        {metadata.year}
                                    </Badge>
                                )}
                            </div>
                            
                            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-foreground leading-[1.1]">
                                {metadata.title}
                            </h1>
                            
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <User className="w-4 h-4" />
                                <span className="text-sm font-medium">{metadata.creator || "Unknown Creator"}</span>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap gap-3 py-2">
                            <Button className="rounded-full h-12 px-6 shadow-lg shadow-primary/20" asChild>
                                <a
                                    href={preferredDownloadName ? `/api/download?id=${encodeURIComponent(id)}&file=${encodeURIComponent(preferredDownloadName)}` : '#'}
                                >
                                    <Download className="w-4 h-4 mr-2" />
                                    Download Now
                                </a>
                            </Button>
                            <Button variant="outline" className="rounded-full h-12 px-6" asChild>
                                <a href={`https://archive.org/details/${id}`} target="_blank" rel="noreferrer">
                                    <ExternalLink className="w-4 h-4 mr-2" />
                                    Archive.org
                                </a>
                            </Button>
                        </div>

                        {/* Description */}
                        {description && (
                            <div className="prose prose-sm dark:prose-invert text-muted-foreground/90 leading-relaxed max-w-none">
                                <p className="line-clamp-10 whitespace-pre-line">{description}</p>
                            </div>
                        )}

                        {/* Tags */}
                        {subjects.length > 0 && (
                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Tags</h3>
                                <div className="flex flex-wrap gap-1.5">
                                    {subjects.slice(0, 8).map((sub, i) => (
                                        <span key={i} className="inline-flex items-center px-2.5 py-1 rounded-md bg-secondary/50 text-secondary-foreground text-xs hover:bg-secondary transition-colors cursor-default">
                                            #{sub}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* File List (Compact) */}
                        <div className="pt-4 border-t border-border/50">
                            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Included Files</h3>
                            <ScrollArea className="h-50 w-full rounded-xl border bg-card/50 px-4">
                                <div className="py-2 space-y-1">
                                    {downloadableFiles.map((f, i) => (
                                        <a
                                            key={i}
                                            href={`/api/download?id=${encodeURIComponent(id)}&file=${encodeURIComponent(f.name!)}`}
                                            className="group flex items-center justify-between p-2 rounded-lg hover:bg-accent transition-colors text-sm"
                                        >
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className="text-muted-foreground group-hover:text-primary transition-colors">
                                                    {getFileIcon(f.name!)}
                                                </div>
                                                <span className="truncate text-foreground/80 group-hover:text-foreground font-medium">
                                                    {f.name}
                                                </span>
                                            </div>
                                            <Download className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
                                        </a>
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function ResultDetailsSkeleton() {
    return (
        <div className="max-w-7xl mx-auto px-6 py-12 space-y-10">
            <div className="w-32 h-6 bg-muted rounded-full animate-pulse" />
            <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-16">
                <div className="aspect-video w-full bg-muted/50 rounded-2xl animate-pulse" />
                <div className="space-y-6">
                    <div className="space-y-3">
                        <div className="h-4 w-20 bg-muted rounded-full animate-pulse" />
                        <div className="h-10 w-3/4 bg-muted rounded-lg animate-pulse" />
                        <div className="h-5 w-1/3 bg-muted rounded animate-pulse" />
                    </div>
                    <div className="h-12 w-40 bg-muted rounded-full animate-pulse" />
                    <div className="space-y-2 pt-4">
                        <div className="h-4 w-full bg-muted rounded animate-pulse" />
                        <div className="h-4 w-full bg-muted rounded animate-pulse" />
                        <div className="h-4 w-2/3 bg-muted rounded animate-pulse" />
                    </div>
                </div>
            </div>
        </div>
    )
}