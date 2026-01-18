import { ArchiveDoc } from "@/types/archive";
import {
    Card,
    CardDescription,
    CardHeader,
    CardTitle,
    CardFooter,
} from "../ui/card";
import { Button } from "../ui/button";
import { Link } from "@tanstack/react-router";

function stripHtml(input: string) {
    return input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function asArray(value?: string | string[]) {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
}

type ResultProps = {
    data?: ArchiveDoc[];
};

export default function Result({ data = [] }: ResultProps) {
    return (
        <div className="w-full max-w-5xl flex flex-col gap-6 py-8">
            <h1 className="font-clash text-4xl font-semibold text-center">
                Search Results
            </h1>

            {data.length === 0 && (
                <p className="text-center text-muted-foreground">
                    No results found. Try another search
                </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {data.map((item) =>
                    item?.identifier ? (
                        <Card
                            key={item.identifier}
                            className="flex flex-col justify-between hover:shadow-lg hover:-translate-y-1 transition-all duration-200 cursor-pointer"
                        >
                        <div className="w-full overflow-hidden rounded-t-xl bg-muted">
                            <img
                                src={`https://archive.org/services/img/${item.identifier}`}
                                alt={item.title}
                                loading="lazy"
                                className="h-44 w-full object-cover"
                                onError={(e) => {
                                    ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                                }}
                            />
                        </div>
                        <CardHeader className="space-y-2">
                            <CardTitle className="text-base line-clamp-2">{item.title}</CardTitle>

                            <CardDescription className="text-sm opacity-75">
                                {item.creator || "Unknown Author"}
                            </CardDescription>

                            <div className="text-xs text-muted-foreground flex flex-wrap gap-x-2 gap-y-1">
                                <span>{item.mediatype}</span>
                                {item.year != null && <span>• {String(item.year)}</span>}
                                {!item.year && item.date && <span>• {item.date}</span>}
                                {typeof item.downloads === "number" && <span>• {item.downloads} downloads</span>}
                            </div>

                            {item.description && (
                                <p className="text-sm text-muted-foreground line-clamp-3">
                                    {stripHtml(item.description)}
                                </p>
                            )}

                            {asArray(item.subject).length > 0 && (
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                    {asArray(item.subject).slice(0, 3).join(" · ")}
                                </p>
                            )}
                        </CardHeader>

                        <CardFooter className="pt-0">
                            <Link to="/result/$id" params={{ id: item.identifier }}>
                                <Button variant="secondary" className="w-full text-center">
                                    See Details
                                </Button>
                            </Link>
                        </CardFooter>
                    </Card>
                    ) : null
                )}
            </div>
        </div>
    );
}
