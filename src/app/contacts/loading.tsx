import { Skeleton } from "@/components/ui/skeleton";

export default function ContactsLoading() {
    return (
        <div className="p-4 md:p-8 space-y-6">
            <div className="flex items-center justify-between">
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-10 w-32 rounded-md" />
            </div>
            <div className="flex gap-3">
                <Skeleton className="h-10 flex-1 rounded-md" />
                <Skeleton className="h-10 w-32 rounded-md" />
                <Skeleton className="h-10 w-32 rounded-md" />
            </div>
            <div className="border rounded-xl overflow-hidden">
                <Skeleton className="h-12 w-full" />
                {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full mt-px" />
                ))}
            </div>
        </div>
    );
}
