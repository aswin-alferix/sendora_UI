"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CalendarClock, History, Send, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { PlayOnceImage } from "@/components/shared/PlayOnceImage";
import { StatusBadge, type StatusTone } from "@/components/shared/StatusBadge";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table/DataTable";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { backend } from "@/lib/axios";

type ActivityType = "sent" | "scheduled" | "failed";

interface ActivityItem {
    id: string;
    action: string;
    target: string;
    at: Date;
    when: string;
    type: ActivityType;
}

function relativeTime(d: Date): string {
    const diff = Date.now() - d.getTime();
    const min = 60_000, hr = 60 * min, day = 24 * hr, week = 7 * day;
    if (diff < min) return "Just now";
    if (diff < hr) return `${Math.floor(diff / min)} minutes ago`;
    if (diff < day) return `${Math.floor(diff / hr)} hours ago`;
    if (diff < 2 * day) return "Yesterday";
    if (diff < week) return `${Math.floor(diff / day)} days ago`;
    return d.toLocaleDateString();
}

const TYPES: Record<ActivityType, { label: string; icon: LucideIcon; tone: StatusTone; tile: string }> = {
    sent: { label: "Sent", icon: Send, tone: "success", tile: "bg-primary/10 text-primary" },
    scheduled: { label: "Scheduled", icon: CalendarClock, tone: "warning", tile: "bg-warning/10 text-warning" },
    failed: { label: "Failed", icon: AlertCircle, tone: "destructive", tile: "bg-destructive/10 text-destructive" },
};

const FILTERS: (ActivityType | "all")[] = ["all", "sent", "scheduled", "failed"];

export default function HistoryPage() {
    const [activeFilter, setActiveFilter] = useState<ActivityType | "all">("all");
    const [items, setItems] = useState<ActivityItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const { data } = await backend.get("/api/emails");
                if (cancelled) return;
                const mapped: ActivityItem[] = (data.items ?? []).map(
                    (e: { id: string; status: string; to: string[]; sentAt?: string; scheduledAt?: string; createdAt: string }) => {
                        const at = new Date(e.sentAt ?? e.scheduledAt ?? e.createdAt);
                        return {
                            id: e.id,
                            action:
                                e.status === "sent" ? "Email sent to" : e.status === "scheduled" ? "Email scheduled for" : "Email failed to",
                            target: e.to[0] ?? "",
                            at,
                            when: relativeTime(at),
                            type: e.status as ActivityType,
                        };
                    }
                );
                setItems(mapped);
            } catch (err) {
                console.error("Failed to load history", err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const counts = useMemo(() => {
        const c: Record<ActivityType | "all", number> = { all: items.length, sent: 0, scheduled: 0, failed: 0 };
        items.forEach((i) => {
            if (i.type in c) c[i.type] += 1;
        });
        return c;
    }, [items]);

    const filtered = useMemo(
        () => (activeFilter === "all" ? items : items.filter((i) => i.type === activeFilter)),
        [items, activeFilter]
    );

    const columns: DataTableColumn<ActivityItem>[] = [
        {
            id: "event",
            header: "Activity",
            hideable: false,
            sortValue: (i) => i.action,
            className: "min-w-[260px]",
            cell: (i) => {
                const { icon: Icon, tile } = TYPES[i.type] ?? TYPES.sent;
                return (
                    <div className="flex items-center gap-3">
                        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", tile)}>
                            <Icon className="h-4 w-4" />
                        </span>
                        <span className="font-medium">{i.action}</span>
                    </div>
                );
            },
        },
        {
            id: "target",
            header: "Recipient",
            sortValue: (i) => i.target,
            className: "min-w-[220px]",
            cell: (i) => <span className="block max-w-[360px] truncate text-muted-foreground" title={i.target}>{i.target || "—"}</span>,
        },
        {
            id: "type",
            header: "Status",
            sortValue: (i) => TYPES[i.type]?.label,
            cell: (i) => <StatusBadge tone={TYPES[i.type]?.tone ?? "neutral"}>{TYPES[i.type]?.label ?? i.type}</StatusBadge>,
        },
        {
            id: "when",
            header: "When",
            sortValue: (i) => i.at,
            className: "whitespace-nowrap",
            cell: (i) => (
                <span className="text-muted-foreground" title={i.at.toLocaleString()}>
                    {i.when}
                </span>
            ),
        },
    ];

    return (
        <div className="flex h-[calc(100dvh-4rem)] min-h-[600px] flex-col px-4 py-6 md:px-8">
            <PageHeader
                icon={History}
                title="Activity History"
                count={loading ? undefined : items.length}
                description="Track all email activity and events"
            />

            <DataTable
                data={filtered}
                columns={columns}
                getRowId={(i) => i.id}
                loading={loading}
                itemLabel="events"
                initialSort={{ id: "when", desc: true }}
                getSearchText={(i) => `${i.action} ${i.target}`}
                searchPlaceholder="Search by recipient…"
                filters={
                    <div className="inline-flex h-9 items-center rounded-lg border border-border bg-card p-0.5 shadow-sm" role="group" aria-label="Filter by status">
                        {FILTERS.map((f) => (
                            <button
                                key={f}
                                type="button"
                                onClick={() => setActiveFilter(f)}
                                aria-pressed={activeFilter === f}
                                className={cn(
                                    "flex h-full items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors",
                                    activeFilter === f ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {f === "all" ? "All" : TYPES[f].label}
                                <span
                                    className={cn(
                                        "rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                                        activeFilter === f ? "bg-primary-foreground/20" : "bg-muted"
                                    )}
                                >
                                    {counts[f]}
                                </span>
                            </button>
                        ))}
                    </div>
                }
                emptyState={({ searching, clearSearch }) => (
                    <>
                        <PlayOnceImage
                            animatedSrc="/illustrations/no-emails.webp"
                            staticSrc="/illustrations/no-emails.png"
                            durationMs={2000}
                            width={128}
                            height={128}
                            className="h-32 w-32"
                        />
                        {items.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No activity yet. Sent and scheduled emails will show up here.</p>
                        ) : (
                            <>
                                <p className="text-sm text-muted-foreground">No activity matches your search or filter.</p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        clearSearch();
                                        setActiveFilter("all");
                                    }}
                                >
                                    {searching ? "Clear search & filters" : "Clear filters"}
                                </Button>
                            </>
                        )}
                    </>
                )}
            />
        </div>
    );
}
