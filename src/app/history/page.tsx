"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Clock, ArrowRight, ChevronLeft, ChevronRight, Send, AlertCircle, CalendarClock } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePagination } from "@/hooks/usePagination";
import { cn } from "@/lib/utils";

type ActivityType = "sent" | "scheduled" | "failed";

interface ActivityItem {
    id: string;
    action: string;
    target: string;
    timestamp: string;
    type: ActivityType;
}

function relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const min = 60_000, hr = 60 * min, day = 24 * hr, week = 7 * day;
    if (diff < min) return "Just now";
    if (diff < hr) return `${Math.floor(diff / min)} minutes ago`;
    if (diff < day) return `${Math.floor(diff / hr)} hours ago`;
    if (diff < 2 * day) return "Yesterday";
    if (diff < week) return `${Math.floor(diff / day)} days ago`;
    return new Date(iso).toLocaleDateString();
}

const typeConfig: Record<ActivityType, { color: string; icon: typeof Clock; label: string }> = {
    sent: { color: "bg-primary/10 text-primary", icon: Send, label: "Sent" },
    scheduled: { color: "bg-warning/10 text-warning", icon: CalendarClock, label: "Scheduled" },
    failed: { color: "bg-destructive/10 text-destructive", icon: AlertCircle, label: "Failed" },
};

const PAGE_SIZE = 8;

export default function HistoryPage() {
    const [activeFilter, setActiveFilter] = useState<ActivityType | "all">("all");
    const [items, setItems] = useState<ActivityItem[]>([]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch("/api/emails");
                const data = await res.json();
                if (cancelled) return;
                const mapped: ActivityItem[] = (data.items ?? []).map((e: { id: string; status: string; to: string[]; sentAt?: string; scheduledAt?: string; createdAt: string }) => {
                    const target = e.to[0] ?? "";
                    const action =
                        e.status === "sent" ? "Email sent to" :
                        e.status === "scheduled" ? "Email scheduled for" :
                        "Email failed to";
                    return {
                        id: e.id,
                        action,
                        target,
                        timestamp: relativeTime(e.sentAt ?? e.scheduledAt ?? e.createdAt),
                        type: e.status as ActivityType,
                    };
                });
                setItems(mapped);
            } catch (err) {
                console.error("Failed to load history", err);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const filtered = activeFilter === "all"
        ? items
        : items.filter((i) => i.type === activeFilter);

    const { page, totalPages, paginatedItems, goNext, goPrev, hasNext, hasPrev, from, to, total, reset } =
        usePagination(filtered, PAGE_SIZE);

    useEffect(() => { reset(); }, [activeFilter]); // eslint-disable-line react-hooks/exhaustive-deps

    const counts = (["sent", "scheduled", "failed"] as ActivityType[]).reduce(
        (acc, t) => ({ ...acc, [t]: items.filter((i) => i.type === t).length }),
        {} as Record<ActivityType, number>
    );

    return (
        <div className="p-4 md:p-8 max-w-4xl mx-auto">
            <PageHeader title="Activity History" description="Track all email activity and events" />

            {/* Summary stats */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-3 gap-3 mb-6"
            >
                {(["sent", "scheduled", "failed"] as ActivityType[]).map((type) => {
                    const { color, icon: Icon, label } = typeConfig[type];
                    return (
                        <div key={type} className={cn("rounded-lg p-3 flex items-center gap-3", color.replace("text-", "bg-").split(" ")[0] + "/5 border border-current/10")}>
                            <div className={cn("rounded-full p-2", color)}>
                                <Icon className="h-3.5 w-3.5" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">{label}</p>
                                <p className="font-semibold text-sm">{counts[type]}</p>
                            </div>
                        </div>
                    );
                })}
            </motion.div>

            {/* Filter chips */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="flex flex-wrap gap-2 mb-4"
            >
                <Badge
                    variant={activeFilter === "all" ? "default" : "outline"}
                    className="cursor-pointer select-none"
                    onClick={() => setActiveFilter("all")}
                >
                    All ({items.length})
                </Badge>
                {(["sent", "scheduled", "failed"] as ActivityType[]).map((type) => (
                    <Badge
                        key={type}
                        variant={activeFilter === type ? "default" : "outline"}
                        className="cursor-pointer select-none capitalize"
                        onClick={() => setActiveFilter(type)}
                    >
                        {typeConfig[type].label} ({counts[type]})
                    </Badge>
                ))}
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-card rounded-xl border border-border shadow-card"
            >
                <div className="divide-y divide-border">
                    {paginatedItems.length > 0 ? (
                        paginatedItems.map((item, index) => {
                            const { color, icon: Icon } = typeConfig[item.type];
                            return (
                                <motion.div
                                    key={item.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.04 }}
                                    className="flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors cursor-pointer"
                                >
                                    <div className={cn("flex items-center justify-center w-10 h-10 rounded-full flex-shrink-0", color)}>
                                        <Icon className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-body-base text-foreground">
                                            {item.action} <span className="font-medium">{item.target}</span>
                                        </p>
                                        <p className="text-body-sm text-muted-foreground">{item.timestamp}</p>
                                    </div>
                                    <Badge variant="outline" className="capitalize text-xs hidden sm:flex">
                                        {item.type}
                                    </Badge>
                                    <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                                </motion.div>
                            );
                        })
                    ) : (
                        <div className="py-16 text-center text-muted-foreground">
                            No {activeFilter === "all" ? "" : activeFilter} activity found.
                        </div>
                    )}
                </div>
            </motion.div>

            {/* Pagination */}
            {total > 0 && (
                <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
                    <p>Showing {from}–{to} of {total} events</p>
                    {totalPages > 1 && (
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={goPrev} disabled={!hasPrev}>
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="px-2">Page {page} of {totalPages}</span>
                            <Button variant="outline" size="sm" onClick={goNext} disabled={!hasNext}>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
