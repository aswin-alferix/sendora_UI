"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatTone = "primary" | "success" | "warning" | "destructive";

const tones: Record<StatTone, { bar: string; tile: string }> = {
    primary: { bar: "before:bg-primary", tile: "bg-primary" },
    success: { bar: "before:bg-success", tile: "bg-success" },
    warning: { bar: "before:bg-warning", tile: "bg-warning" },
    destructive: { bar: "before:bg-destructive", tile: "bg-destructive" },
};

interface StatCardProps {
    icon: LucideIcon;
    label: string;
    value: string | number;
    /** Small line under the value ("All time", "Need a retry"…). */
    hint?: string;
    tone?: StatTone;
    className?: string;
}

/** KPI card: coloured top edge, uppercase label, solid icon tile, big number. */
export function StatCard({ icon: Icon, label, value, hint, tone = "primary", className }: StatCardProps) {
    const t = tones[tone];
    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={cn(
                "relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card",
                "before:absolute before:inset-x-0 before:top-0 before:h-[3px]",
                t.bar,
                className
            )}
        >
            <div className="flex items-start justify-between gap-3">
                <p className="pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white shadow-sm", t.tile)}>
                    <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                </span>
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-foreground">{value}</p>
            {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </motion.div>
    );
}
