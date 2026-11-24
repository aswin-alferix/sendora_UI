import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
    return (
        <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-64 w-full rounded-xl" />
        </div>
    );
}
