import { ArchiveDoc } from "@/types/archive";
import {
    Card,
    CardDescription,
    CardHeader,
    CardTitle,
    CardFooter,
} from "../ui/card";
import { Button } from "../ui/button";

type ResultProps = {
    data: ArchiveDoc[];
};

export default function Result({ data }: ResultProps) {
    return (
        <div className="w-full max-w-5xl flex flex-col gap-6 py-8">
            <h1 className="font-clash text-4xl font-semibold text-center">
                Search Results
            </h1>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {data.map((item) => (
                    <Card
                        key={item.identifier}
                        className="flex flex-col justify-between hover:shadow-lg transition-all duration-200"
                    >
                        <CardHeader className="space-y-2">
                            <CardTitle className="text-base line-clamp-2">
                                {item.title}
                            </CardTitle>

                            <CardDescription className="text-sm opacity-75">
                                {item.creator || "Unknown Author"}
                            </CardDescription>

                            <p className="text-xs text-muted-foreground">
                                Type: {item.mediatype}
                            </p>
                        </CardHeader>

                        <CardFooter className="pt-0">
                            <Button
                                variant="secondary"
                                className="w-full cursor-pointer text-center"
                            >
                                See Details
                            </Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>
        </div>
    );
}
