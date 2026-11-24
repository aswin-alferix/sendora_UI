import { Skeleton } from "@/components/ui/skeleton";

export default function ComposeLoading() {
    return (
        <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6">
            <Skeleton className="h-8 w-40" />
            <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-10 w-full rounded-md" />
                    </div>
                ))}
                <Skeleton className="h-48 w-full rounded-md" />
            </div>
        </div>
    );
}
