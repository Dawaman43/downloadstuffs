import { useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getArchiveItem } from "@/data/fetchapi";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function ResultDetails() {
    const { id } = useParams({ from: "/results/$id" });
    const fetchItem = useServerFn(getArchiveItem);

    const [item, setItem] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchItem({ data: { id } }).then((res) => {
            setItem(res);
            setLoading(false);
        });
    }, [id]);

    if (loading) return <p>Loading details...</p>;

    return (
        <div className="max-w-3xl mx-auto py-10 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="text-2xl">{item.metadata.title}</CardTitle>
                    <CardDescription>{item.metadata.creator}</CardDescription>
                    <p className="text-sm text-muted-foreground">
                        {item.metadata.mediatype}
                    </p>
                </CardHeader>
            </Card>

            <Button asChild>
                <a
                    href={`https://archive.org/details/${id}`}
                    target="_blank"
                >
                    Download from Archive.org
                </a>
            </Button>
        </div>
    );
}
