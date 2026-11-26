"use client";

import { useMemo, useState } from "react";
import { CalendarClock, Sun, Sunrise, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MonthCalendar } from "@/components/shared/MonthCalendar";
import { cn } from "@/lib/utils";

/** "YYYY-MM-DDTHH:mm" in local time: the format the compose form stores for scheduledAt. */
export function toLocalInputValue(d: Date) {
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

const fmtWhen = (d: Date) =>
    d.toLocaleString([], { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

function at(base: Date, days: number, hours: number, minutes = 0) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + days, hours, minutes);
    return d;
}

/** Quick picks, like Outlook's "Schedule send". */
function quickOptions(now: Date) {
    const opts: { id: string; label: string; icon: typeof Sun; date: Date }[] = [];
    const later = new Date(now);
    later.setHours(now.getHours() + 3, 0, 0, 0); // ~3 hours from now, on the hour
    // Only offer it when that lands in sensible sending hours (8 AM – 8 PM)
    if (later.getDate() === now.getDate() && later.getHours() >= 8 && later.getHours() <= 20) {
        opts.push({ id: "later", label: "Later today", icon: Clock, date: later });
    }
    opts.push({ id: "tomorrow", label: "Tomorrow morning", icon: Sunrise, date: at(now, 1, 9) });
    const daysToMonday = ((8 - now.getDay()) % 7) || 7; // next Monday, never today
    if (daysToMonday !== 1) opts.push({ id: "monday", label: "Monday morning", icon: Sun, date: at(now, daysToMonday, 9) });
    return opts;
}

interface SchedulePickerProps {
    /** Current value ("YYYY-MM-DDTHH:mm") or empty. */
    value?: string;
    onSchedule: (value: string) => void;
    onCancel: () => void;
}

export function SchedulePicker({ value, onSchedule, onCancel }: SchedulePickerProps) {
    const now = useMemo(() => new Date(), []);
    const initial = useMemo(() => {
        const v = value ? new Date(value) : null;
        if (v && !Number.isNaN(v.getTime()) && v > now) return v;
        return at(now, 1, 9); // default: tomorrow 9:00 AM
    }, [value, now]);

    const [day, setDay] = useState<Date>(new Date(initial.getFullYear(), initial.getMonth(), initial.getDate()));
    const [hour12, setHour12] = useState(String(initial.getHours() % 12 || 12));
    const [minute, setMinute] = useState(String(Math.floor(initial.getMinutes() / 5) * 5).padStart(2, "0"));
    const [ampm, setAmpm] = useState<"AM" | "PM">(initial.getHours() >= 12 ? "PM" : "AM");

    const chosen = useMemo(() => {
        const h = (Number(hour12) % 12) + (ampm === "PM" ? 12 : 0);
        return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, Number(minute));
    }, [day, hour12, minute, ampm]);
    // Compared with the moment the picker opened; re-checked against the clock on Schedule.
    const inPast = chosen.getTime() <= now.getTime();

    const quick = useMemo(() => quickOptions(now), [now]);
    // Set when Schedule is clicked after the chosen time has passed; clears once the time changes.
    const [lateFor, setLateFor] = useState<number | null>(null);
    const lateNote = lateFor === chosen.getTime();

    const handleSchedule = () => {
        if (chosen.getTime() <= Date.now()) {
            setLateFor(chosen.getTime()); // the picker stayed open past the chosen time
            return;
        }
        onSchedule(toLocalInputValue(chosen));
    };

    return (
        <div className="flex flex-col sm:flex-row">
            {/* Quick picks */}
            <div className="border-b border-border p-3 sm:w-[210px] sm:border-b-0 sm:border-r">
                <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Schedule send</p>
                <ul className="space-y-0.5">
                    {quick.map(({ id, label, icon: Icon, date }) => (
                        <li key={id}>
                            <button
                                type="button"
                                onClick={() => onSchedule(toLocalInputValue(date))}
                                className="flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left outline-none transition-colors hover:bg-primary/10 focus-visible:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                                <span className="min-w-0">
                                    <span className="block text-sm font-medium text-foreground">{label}</span>
                                    <span className="block text-xs text-muted-foreground">{fmtWhen(date)}</span>
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
                <p className="mt-3 flex items-center gap-1.5 px-2 text-xs text-muted-foreground">
                    <CalendarClock className="h-3.5 w-3.5" />
                    Or pick a date and time
                </p>
            </div>

            {/* Custom date + time */}
            <div className="p-4">
                <MonthCalendar value={day} onChange={setDay} minDate={now} />

                <div className="mt-3 border-t border-border pt-3">
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">Time</p>
                    <div className="flex items-center gap-1.5">
                        <Select value={hour12} onValueChange={setHour12}>
                            <SelectTrigger className="h-9 w-[68px] rounded-lg" aria-label="Hour">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="max-h-60">
                                {HOURS.map((h) => (
                                    <SelectItem key={h} value={h}>
                                        {h}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <span className="font-semibold text-muted-foreground">:</span>
                        <Select value={minute} onValueChange={setMinute}>
                            <SelectTrigger className="h-9 w-[68px] rounded-lg" aria-label="Minute">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="max-h-60">
                                {MINUTES.map((m) => (
                                    <SelectItem key={m} value={m}>
                                        {m}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <div className="ml-1 inline-flex h-9 rounded-lg bg-muted p-0.5" role="group" aria-label="AM or PM">
                            {(["AM", "PM"] as const).map((v) => (
                                <button
                                    key={v}
                                    type="button"
                                    onClick={() => setAmpm(v)}
                                    aria-pressed={ampm === v}
                                    className={cn(
                                        "rounded-md px-3 text-xs font-semibold transition-colors",
                                        ampm === v ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    {v}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <p className={cn("mt-3 text-xs", inPast || lateNote ? "text-destructive" : "text-muted-foreground")}>
                    {inPast || lateNote ? "That time has already passed. Pick a later time." : <>Sends <span className="font-semibold text-foreground">{fmtWhen(chosen)}</span></>}
                </p>

                <div className="mt-3 flex justify-end gap-2">
                    <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg" onClick={onCancel}>
                        Cancel
                    </Button>
                    <Button type="button" size="sm" className="h-8 rounded-lg" disabled={inPast} onClick={handleSchedule}>
                        Schedule
                    </Button>
                </div>
            </div>
        </div>
    );
}
