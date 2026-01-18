import { useServerFn } from "@tanstack/react-start";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ArchiveIcon, BinocularsIcon } from "@phosphor-icons/react";
import { searchIA } from "@/data/fetchapi";
import { useState } from "react";
import Result from "../Result";
import { ArchiveDoc } from "@/types/archive";


export default function Home() {
    const [results, setResults] = useState<ArchiveDoc[]>([]);
    const searchFn = useServerFn(searchIA);
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [loading, setLoading] = useState(false);


    const handleSearch = async () => {
        if (!searchQuery) return;
        setLoading(true);
        setResults([]);
        try {
            const result: ArchiveDoc[] = await searchFn({
                data: {
                    query: searchQuery,
                    page: 1,
                    rows: 10
                }
            }
            );
            setResults(result);
        } finally {
            setLoading(false);
        }

    };
    return (
        <div className="flex min-h-screen flex-col gap-4 items-center justify-center py-2">

            <div className="flex gap-x-4  items-center justify-center">
                <ArchiveIcon className="font-bold" size={31} />

                <p className="text-6xl font-clash font-bold"> Download stuffs</p>
            </div>

            <div className="flex gap-x-3 ">
                <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />

                <Button onClick={handleSearch} disabled={loading}>
                    {loading ? (
                        <span className="animate-spin">
                            <BinocularsIcon size={28} />
                        </span>
                    ) : (
                        <BinocularsIcon size={32} />
                    )}
                </Button>
            </div>

            {results.length > 0 && <Result data={results} />}
        </div>
    );
}
