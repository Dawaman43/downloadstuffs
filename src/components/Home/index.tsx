import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ArchiveIcon, BinocularsIcon } from "@phosphor-icons/react";

export default function Home() {
    return (
        <div className="flex min-h-screen flex-col gap-4 items-center justify-center py-2">

            <div className="flex gap-x-4  items-center justify-center">
                <ArchiveIcon className="font-bold" size={31} />

                <p className="text-6xl font-clash font-bold"> Download stuffs</p>
            </div>

            <div className="flex gap-x-3 ">
                <Input />
                <Button className="cursor-pointer">
                    <BinocularsIcon size={32} />
                </Button>
            </div>
        </div>
    );
}
