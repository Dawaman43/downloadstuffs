import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ArchiveIcon, BinocularsIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";

export default function Home() {
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSearch = () => {
        if (!searchQuery) return;

        setLoading(true);

        navigate({
            to: "/result/",
            search: { q: searchQuery },
        });
    };

    return (
        <div className="flex min-h-screen flex-col gap-4 items-center justify-center py-2">
            <div className="flex gap-x-4 items-center justify-center">
                <ArchiveIcon size={31} />
                <p className="text-6xl font-clash font-bold">Download stuffs</p>
            </div>

            <div className="flex gap-x-3">
                <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search archive.org..."
                />

                <Button onClick={handleSearch} disabled={loading}>
                    <BinocularsIcon size={28} className={loading ? "animate-spin" : ""} />
                </Button>
            </div>
        </div>
    );
}
