"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const sameDay = (a: Date | null | undefined, b: Date | null | undefined) =>
    !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

interface MonthCalendarProps {
    value: Date | null;
    onChange: (date: Date) => void;
    /** Days before this are greyed out and can't be picked. */
    minDate?: Date;
    /** Days after this are greyed out and can't be picked. */
    maxDate?: Date;
    className?: string;
}

/**
 * Month-view date picker: "‹ Nov · 2026 ›" header, Su–Sa columns, 6-week grid.
 * Days from the neighbouring months and out-of-range days are faded; the
 * selected day is a solid primary tile; today is outlined.
 */
export function MonthCalendar({ value, onChange, minDate, maxDate, className }: MonthCalendarProps) {
    const today = startOfDay(new Date());
    const [view, setView] = useState(() => {
        const base = value ?? minDate ?? today;
        return new Date(base.getFullYear(), base.getMonth(), 1);
    });

    const min = minDate ? startOfDay(minDate) : null;
    const max = maxDate ? startOfDay(maxDate) : null;
    const isDisabled = (d: Date) => (min && d < min) || (max && d > max);

    // 6 rows × 7 days, starting on the Sunday before (or on) the 1st
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const gridStart = new Date(first);
    gridStart.setDate(1 - first.getDay());
    const days = Array.from({ length: 42 }, (_, i) => {
        const d = new Date(gridStart);
        d.setDate(gridStart.getDate() + i);
        return d;
    });

    const prevMonthEnd = new Date(view.getFullYear(), view.getMonth(), 0);
    const nextMonthStart = new Date(view.getFullYear(), view.getMonth() + 1, 1);
    const canPrev = !min || prevMonthEnd >= min;
    const canNext = !max || nextMonthStart <= max;
    const shift = (months: number) => setView((v) => new Date(v.getFullYear(), v.getMonth() + months, 1));

    const monthLabel = view.toLocaleDateString([], { month: "short" });

    return (
        <div className={cn("w-[296px] select-none", className)}>
            {/* Header */}
            <div className="flex items-center justify-between px-1 pb-3">
                <button
                    type="button"
                    onClick={() => shift(-1)}
                    disabled={!canPrev}
                    aria-label="Previous month"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                >
                    <ChevronLeft className="h-4 w-4" />
                </button>
                <p className="flex items-center gap-2 text-base font-semibold text-foreground" aria-live="polite">
                    {monthLabel}
                    <span className="h-1 w-1 rounded-full bg-muted-foreground/40" aria-hidden="true" />
                    {view.getFullYear()}
                </p>
                <button
                    type="button"
                    onClick={() => shift(1)}
                    disabled={!canNext}
                    aria-label="Next month"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                >
                    <ChevronRight className="h-4 w-4" />
                </button>
            </div>

            <div className="border-t border-border pt-3">
                {/* Weekdays */}
                <div className="grid grid-cols-7 pb-1">
                    {WEEKDAYS.map((w) => (
                        <span key={w} className="flex h-7 items-center justify-center text-xs font-medium text-muted-foreground/70">
                            {w}
                        </span>
                    ))}
                </div>

                {/* Days */}
                <div className="grid grid-cols-7 gap-y-1" role="grid">
                    {days.map((d) => {
                        const inMonth = d.getMonth() === view.getMonth();
                        const disabled = isDisabled(d);
                        const selected = sameDay(d, value);
                        const isToday = sameDay(d, today);
                        return (
                            <button
                                key={d.toISOString()}
                                type="button"
                                disabled={!!disabled}
                                onClick={() => {
                                    onChange(d);
                                    if (!inMonth) setView(new Date(d.getFullYear(), d.getMonth(), 1));
                                }}
                                aria-pressed={selected}
                                aria-label={d.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                                className={cn(
                                    "mx-auto flex h-9 w-9 items-center justify-center rounded-lg text-sm tabular-nums transition-colors",
                                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                    selected
                                        ? "bg-primary font-semibold text-primary-foreground shadow-sm"
                                        : disabled
                                          ? "cursor-not-allowed text-muted-foreground/30"
                                          : inMonth
                                            ? "text-foreground hover:bg-primary/10 hover:text-primary"
                                            : "text-muted-foreground/40 hover:bg-muted",
                                    isToday && !selected && "font-semibold text-primary ring-1 ring-inset ring-primary/40"
                                )}
                            >
                                {d.getDate()}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
