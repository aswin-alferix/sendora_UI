import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Varied bar widths so placeholder rows look like real data, not a solid block. */
const CELL_WIDTHS = ["w-40", "w-56", "w-20", "w-24", "w-32", "w-28", "w-44", "w-16"];
export function cellSkeletonWidth(row: number, col: number) {
    return CELL_WIDTHS[(row * 3 + col * 5) % CELL_WIDTHS.length];
}

function HeaderSkeleton({ action = true }: { action?: boolean }) {
    return (
        <div className="mb-5 flex items-start justify-between gap-4">
            <div className="space-y-2">
                <div className="flex items-center gap-2.5">
                    <Skeleton className="h-5 w-5 rounded" />
                    <Skeleton className="h-6 w-44" />
                    <Skeleton className="h-6 w-7 rounded-full" />
                </div>
                <Skeleton className="h-4 w-72" />
            </div>
            {action && <Skeleton className="h-9 w-36 rounded-lg" />}
        </div>
    );
}

/** Table rows for loading states: one bar per column, optional checkbox/avatar/actions. */
export function TableRowsSkeleton({
    rows = 12,
    columns = 4,
    selectable = false,
    actions = false,
    avatar = true,
}: {
    rows?: number;
    columns?: number;
    selectable?: boolean;
    actions?: boolean;
    avatar?: boolean;
}) {
    return (
        <>
            {Array.from({ length: rows }, (_, r) => (
                <div key={r} className="flex items-center gap-4 border-b border-border px-4 py-3.5">
                    {selectable && <Skeleton className="h-4 w-4 shrink-0 rounded-[4px]" />}
                    {Array.from({ length: columns }, (_, c) => (
                        <div key={c} className="flex min-w-0 flex-1 items-center gap-3">
                            {c === 0 && avatar && <Skeleton className="h-8 w-8 shrink-0 rounded-full" />}
                            <Skeleton className={cn("h-4 max-w-full", cellSkeletonWidth(r, c))} />
                        </div>
                    ))}
                    {actions && <Skeleton className="h-6 w-6 shrink-0 rounded-md" />}
                </div>
            ))}
        </>
    );
}

/** Route-level skeleton for list pages (Sent, History, Templates, Contacts): matches DataTable. */
export function ListPageSkeleton({
    columns = 4,
    selectable = false,
    actions = true,
    headerAction = true,
    toolbarButtons = 2,
}: {
    columns?: number;
    selectable?: boolean;
    actions?: boolean;
    headerAction?: boolean;
    toolbarButtons?: number;
}) {
    return (
        <div className="flex h-[calc(100dvh-4rem)] min-h-[600px] flex-col px-4 py-6 md:px-8">
            <HeaderSkeleton action={headerAction} />
            <div className="mb-4 flex items-center gap-3">
                <Skeleton className="h-9 w-full rounded-lg sm:w-[320px]" />
                {Array.from({ length: toolbarButtons }, (_, i) => (
                    <Skeleton key={i} className="hidden h-9 w-28 rounded-lg sm:block" />
                ))}
            </div>
            <div className="flex min-h-[360px] flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card">
                {/* Header row in the table's own colour */}
                <div className="flex h-12 shrink-0 items-center gap-4 bg-primary px-4">
                    {selectable && <div className="h-4 w-4 shrink-0 rounded-[4px] bg-primary-foreground/70" />}
                    {Array.from({ length: columns }, (_, c) => (
                        <div key={c} className="flex-1">
                            <div className="h-3 w-20 rounded bg-primary-foreground/40" />
                        </div>
                    ))}
                    {actions && <div className="w-6 shrink-0" />}
                </div>
                <div className="min-h-0 flex-1 overflow-hidden">
                    <TableRowsSkeleton rows={14} columns={columns} selectable={selectable} actions={actions} />
                </div>
                <div className="flex h-12 shrink-0 items-center justify-between border-t border-border px-4">
                    <Skeleton className="h-4 w-40" />
                    <div className="flex items-center gap-1">
                        {Array.from({ length: 5 }, (_, i) => (
                            <Skeleton key={i} className="h-8 w-8 rounded-lg" />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export function DashboardSkeleton() {
    return (
        <div className="px-4 py-6 md:px-8">
            <HeaderSkeleton />
            <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }, (_, i) => (
                    <div key={i} className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-card">
                        <div className="flex items-start justify-between">
                            <Skeleton className="h-3 w-24" />
                            <Skeleton className="h-9 w-9 rounded-lg" />
                        </div>
                        <Skeleton className="h-7 w-16" />
                        <Skeleton className="h-3 w-28" />
                    </div>
                ))}
            </div>
            <Skeleton className="mb-5 h-[360px] rounded-2xl" />
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                <Skeleton className="h-80 rounded-2xl lg:col-span-2" />
                <Skeleton className="h-80 rounded-2xl" />
            </div>
        </div>
    );
}

/** Compose / Settings: header + one big card. */
export function FormPageSkeleton({ tabs = false }: { tabs?: boolean }) {
    return (
        <div className="px-4 py-6 md:px-8">
            <HeaderSkeleton action={false} />
            {tabs && <Skeleton className="mb-6 h-10 w-full rounded-lg" />}
            <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-card">
                {Array.from({ length: 3 }, (_, i) => (
                    <div key={i} className="flex items-center gap-3">
                        <Skeleton className="h-8 w-14 rounded-md" />
                        <Skeleton className="h-8 flex-1 rounded-md" />
                    </div>
                ))}
                <Skeleton className="h-64 w-full rounded-xl" />
                <div className="flex justify-between pt-2">
                    <Skeleton className="h-9 w-28 rounded-lg" />
                    <Skeleton className="h-9 w-32 rounded-lg" />
                </div>
            </div>
        </div>
    );
}
