import { Skeleton } from "@/components/ui/skeleton";

export default function HistoryLoading() {
    return (
        <div className="p-4 md:p-8 space-y-6">
            <Skeleton className="h-8 w-36" />
            <div className="space-y-4">
                {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="flex gap-4">
                        <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3 w-1/3" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
