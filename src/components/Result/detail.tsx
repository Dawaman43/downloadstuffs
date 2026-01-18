import { Link, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getArchiveItem } from "@/data/fetchapi";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

function stripHtml(input: string) {
    return input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
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
};

function isPublicFile(file: ArchiveFile) {
    return !!file?.name && file.private !== "true";
}

function pickFirstByExt(files: ArchiveFile[], exts: string[]) {
    const lowerExts = exts.map((e) => e.toLowerCase());
    return files.find((f) => {
        const name = f?.name?.toLowerCase();
        return !!name && lowerExts.some((ext) => name.endsWith(ext));
    });
}

function filterByExt(files: ArchiveFile[], exts: string[]) {
    const lowerExts = exts.map((e) => e.toLowerCase());
    return files.filter((f) => {
        const name = f?.name?.toLowerCase();
        return !!name && lowerExts.some((ext) => name.endsWith(ext));
    });
}

export default function ResultDetails() {
    const { id } = useParams({ from: "/result/$id" });
    const fetchItem = useServerFn(getArchiveItem);

    const [item, setItem] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        fetchItem({ data: { id } }).then((res) => {
            setItem(res);
            setLoading(false);
        });
    }, [id, fetchItem]);

    if (loading)
        return (
            <div className="max-w-3xl mx-auto py-10 space-y-6">
                <div className="flex flex-col items-center gap-2">
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <span className="inline-block h-4 w-4 rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground animate-spin" />
                        <span>Loading details…</span>
                    </div>
                </div>

                <Card>
                    <CardHeader className="space-y-3">
                        <div className="h-6 w-3/4 bg-muted animate-pulse rounded" />
                        <div className="h-4 w-1/3 bg-muted animate-pulse rounded" />
                        <div className="h-3 w-1/2 bg-muted animate-pulse rounded" />
                    </CardHeader>
                </Card>

                <Card>
                    <CardHeader className="space-y-4">
                        <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                        <div className="h-72 w-full bg-muted animate-pulse rounded-md" />
                    </CardHeader>
                </Card>

                <Card>
                    <CardHeader className="space-y-3">
                        <div className="h-4 w-28 bg-muted animate-pulse rounded" />
                        <div className="h-3 w-full bg-muted animate-pulse rounded" />
                        <div className="h-3 w-11/12 bg-muted animate-pulse rounded" />
                        <div className="h-3 w-10/12 bg-muted animate-pulse rounded" />
                    </CardHeader>
                </Card>
            </div>
        );
    if (!item?.metadata) return <p>Could not load item.</p>;

    const metadata = item.metadata as Record<string, any>;
    const subjects = asArray(metadata.subject);
    const collections = asArray(metadata.collection);
    const description = typeof metadata.description === "string" ? stripHtml(metadata.description) : "";

    const files: ArchiveFile[] = Array.isArray(item.files) ? item.files : [];
    const publicFiles = files.filter(isPublicFile);

    const thumbUrl = `https://archive.org/services/img/${id}`;

    const videoFile =
        pickFirstByExt(publicFiles, [".mp4", ".webm", ".m4v", ".ogv"]) ??
        pickFirstByExt(publicFiles.filter((f) => f.source === "original"), [".mp4", ".webm", ".m4v", ".ogv"]);
    const audioFile =
        pickFirstByExt(publicFiles, [".mp3", ".ogg", ".m4a", ".flac", ".wav"]) ??
        pickFirstByExt(publicFiles.filter((f) => f.source === "original"), [".mp3", ".ogg", ".m4a", ".flac", ".wav"]);
    const imageFiles = filterByExt(publicFiles, [".jpg", ".jpeg", ".png", ".webp", ".gif"]).slice(0, 24);

    const downloadableFiles = publicFiles
        .filter((f) => f.source === "original")
        .slice(0, 12);

    const preferredDownloadName =
        videoFile?.name ?? audioFile?.name ?? downloadableFiles[0]?.name;

    return (
        <div className="max-w-3xl mx-auto py-10 space-y-6">
            <div className="flex items-center gap-2">
                <Button asChild variant="ghost" size="icon" className="h-9 w-9">
                    <Link to="/" aria-label="Back to home">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                </Button>
                <span className="text-sm text-muted-foreground">Back</span>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-2xl">{metadata.title}</CardTitle>
                    <CardDescription>{metadata.creator}</CardDescription>
                    <p className="text-sm text-muted-foreground">
                        {metadata.mediatype}
                        {metadata.date ? ` • ${metadata.date}` : ""}
                        {metadata.year ? ` • ${metadata.year}` : ""}
                    </p>
                </CardHeader>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Preview</CardTitle>
                    <div className="space-y-4">
                        <img
                            src={thumbUrl}
                            alt={metadata.title}
                            loading="lazy"
                            className="w-full max-h-96 object-contain rounded-md bg-muted"
                            onError={(e) => {
                                ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                            }}
                        />

                        {videoFile?.name ? (
                            <video
                                controls
                                preload="metadata"
                                className="w-full rounded-md bg-black"
                                poster={thumbUrl}
                                src={`https://archive.org/download/${id}/${encodeURIComponent(videoFile.name)}`}
                            />
                        ) : null}

                        {!videoFile?.name && audioFile?.name ? (
                            <audio
                                controls
                                preload="metadata"
                                className="w-full"
                                src={`https://archive.org/download/${id}/${encodeURIComponent(audioFile.name)}`}
                            />
                        ) : null}

                        {imageFiles.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {imageFiles.map((f) => (
                                    <a
                                        key={f.name}
                                        href={`https://archive.org/download/${id}/${encodeURIComponent(f.name!)}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="block"
                                    >
                                        <img
                                            src={`https://archive.org/download/${id}/${encodeURIComponent(f.name!)}`}
                                            alt={f.name}
                                            loading="lazy"
                                            className="h-32 w-full object-cover rounded-md bg-muted"
                                            onError={(e) => {
                                                ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                                            }}
                                        />
                                    </a>
                                ))}
                            </div>
                        ) : null}
                    </div>
                </CardHeader>
            </Card>

            {description && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Description</CardTitle>
                        <CardDescription className="leading-relaxed">
                            {description}
                        </CardDescription>
                    </CardHeader>
                </Card>
            )}

            {(subjects.length > 0 || collections.length > 0) && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Metadata</CardTitle>
                        <div className="space-y-2 text-sm text-muted-foreground">
                            {subjects.length > 0 && (
                                <p>
                                    <span className="font-medium text-foreground">Subjects:</span> {subjects.slice(0, 10).join(", ")}
                                </p>
                            )}
                            {collections.length > 0 && (
                                <p>
                                    <span className="font-medium text-foreground">Collections:</span> {collections.slice(0, 10).join(", ")}
                                </p>
                            )}
                        </div>
                    </CardHeader>
                </Card>
            )}

            {downloadableFiles.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Files</CardTitle>
                        <div className="space-y-2">
                            {downloadableFiles.map((f) => (
                                <a
                                    key={f.name}
                                    className="block text-sm underline underline-offset-4"
                                    href={`/api/download?id=${encodeURIComponent(id)}&file=${encodeURIComponent(f.name!)}`}
                                    rel="noreferrer"
                                >
                                    {f.name}
                                </a>
                            ))}
                        </div>
                    </CardHeader>
                </Card>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
                <Button asChild disabled={!preferredDownloadName}>
                    <a
                        href={
                            preferredDownloadName
                                ? `/api/download?id=${encodeURIComponent(id)}&file=${encodeURIComponent(preferredDownloadName)}`
                                : undefined
                        }
                        rel="noreferrer"
                    >
                        Download from Archive.org
                    </a>
                </Button>

                <Button variant="secondary" asChild>
                    <a href={`https://archive.org/details/${id}`} target="_blank" rel="noreferrer">
                        View on Archive.org
                    </a>
                </Button>
            </div>
        </div>
    );
}
