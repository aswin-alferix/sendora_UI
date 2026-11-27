"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    Mail, Send, Clock, ArrowRight, Plus, CheckCircle, AlertCircle, CalendarClock, LayoutDashboard, FileText, UserPlus,
} from "lucide-react";
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer, Legend,
} from "recharts";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { EmailRow } from "@/components/shared/EmailRow";
import { PlayOnceImage } from "@/components/shared/PlayOnceImage";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { backend } from "@/lib/axios";

interface ApiEmail {
    id: string;
    status: "sent" | "scheduled" | "failed";
    to: string[];
    subject: string;
    sentAt?: string;
    scheduledAt?: string;
    createdAt: string;
}

function relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const min = 60_000, hr = 60 * min, day = 24 * hr;
    if (diff < min) return "Just now";
    if (diff < hr) return `${Math.floor(diff / min)} min ago`;
    if (diff < day) return `${Math.floor(diff / hr)} hours ago`;
    return new Date(iso).toLocaleDateString();
}

function bucketEmailsByDay(emails: ApiEmail[], days: number) {
    const buckets: Record<string, { date: string; sent: number; failed: number; scheduled: number }> = {};
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        const label = d.toLocaleDateString([], { month: "short", day: "numeric" });
        buckets[key] = { date: label, sent: 0, failed: 0, scheduled: 0 };
    }
    emails.forEach((e) => {
        const ts = e.sentAt ?? e.scheduledAt ?? e.createdAt;
        const key = ts.slice(0, 10);
        if (buckets[key]) {
            if (e.status === "sent") buckets[key].sent += 1;
            else if (e.status === "failed") buckets[key].failed += 1;
            else if (e.status === "scheduled") buckets[key].scheduled += 1;
        }
    });
    return Object.values(buckets);
}

/** Rows shown in "Recent Emails"; "View all" appears only when there are more. */
const RECENT_LIMIT = 5;

const QUICK_ACTIONS = [
    { href: "/compose", label: "New Email", icon: Mail },
    { href: "/templates", label: "Create Template", icon: FileText },
    { href: "/contacts", label: "Add Contact", icon: UserPlus },
];

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

export default function Dashboard() {
    const router = useRouter();
    const [period, setPeriod] = useState<"7d" | "30d" | "90d">("7d");
    const [emails, setEmails] = useState<ApiEmail[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const { data } = await backend.get("/api/emails?limit=500");
                if (!cancelled) setEmails(data.items ?? []);
            } catch (err) {
                console.error("Failed to load emails", err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
    const chartData = useMemo(() => bucketEmailsByDay(emails, days), [emails, days]);

    const stats = useMemo(() => {
        const sent = emails.filter((e) => e.status === "sent").length;
        const failed = emails.filter((e) => e.status === "failed").length;
        const scheduled = emails.filter((e) => e.status === "scheduled").length;
        const total = sent + failed;
        const deliveryRate = total > 0 ? `${((sent / total) * 100).toFixed(1)}%` : "—";
        return { sent, failed, scheduled, deliveryRate };
    }, [emails]);

    const recentEmails = useMemo(
        () =>
            emails.slice(0, RECENT_LIMIT).map((e) => ({
                id: e.id,
                to: e.to.join(", "),
                subject: e.subject,
                status:
                    e.status === "scheduled"
                        ? ("pending" as const)
                        : (e.status as "sent" | "failed"),
                date: relativeTime(e.sentAt ?? e.scheduledAt ?? e.createdAt),
            })),
        [emails]
    );

    return (
        <div className="px-4 py-6 md:px-8">
            <PageHeader
                icon={LayoutDashboard}
                title="Dashboard"
                description="Snapshot of your email activity and performance"
                action={
                    <Button asChild className="h-9 rounded-lg">
                        <Link href="/compose">
                            <Plus className="w-4 h-4" />
                            Compose Email
                        </Link>
                    </Button>
                }
            />

            {/* Stats Grid */}
            <motion.div variants={container} initial="hidden" animate="show" className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <motion.div variants={item}>
                    <StatCard icon={Send} tone="primary" label="Emails Sent" value={loading ? "—" : stats.sent.toLocaleString()} hint="All time" />
                </motion.div>
                <motion.div variants={item}>
                    <StatCard icon={CheckCircle} tone="success" label="Delivery Rate" value={loading ? "—" : stats.deliveryRate} hint="Sent out of sent + failed" />
                </motion.div>
                <motion.div variants={item}>
                    <StatCard icon={CalendarClock} tone="warning" label="Scheduled" value={loading ? "—" : stats.scheduled.toLocaleString()} hint="Waiting to go out" />
                </motion.div>
                <motion.div variants={item}>
                    <StatCard icon={AlertCircle} tone="destructive" label="Failed" value={loading ? "—" : stats.failed.toLocaleString()} hint="Need a retry" />
                </motion.div>
            </motion.div>

            {/* Chart */}
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mb-5 rounded-2xl border border-border bg-card p-5 shadow-card"
            >
                <div className="mb-4 flex items-center justify-between gap-4">
                    <div>
                        <h2 className="text-base font-semibold text-foreground">Email Performance</h2>
                        <p className="text-[13px] text-muted-foreground">Sent, scheduled, and failed over time</p>
                    </div>
                    {/* Segmented period switch */}
                    <div className="inline-flex rounded-lg bg-muted p-0.5" role="group" aria-label="Period">
                        {(["7d", "30d", "90d"] as const).map((p) => (
                            <button
                                key={p}
                                type="button"
                                onClick={() => setPeriod(p)}
                                aria-pressed={period === p}
                                className={cn(
                                    "rounded-md px-3 py-1 text-xs font-semibold uppercase transition-colors",
                                    period === p ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {p}
                            </button>
                        ))}
                    </div>
                </div>
                <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="hsl(217 91% 60%)" stopOpacity={0.2} />
                                <stop offset="95%" stopColor="hsl(217 91% 60%)" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorScheduled" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="hsl(38 92% 50%)" stopOpacity={0.2} />
                                <stop offset="95%" stopColor="hsl(38 92% 50%)" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="hsl(0 84% 60%)" stopOpacity={0.2} />
                                <stop offset="95%" stopColor="hsl(0 84% 60%)" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                        <ChartTooltip
                            contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                            labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600, marginBottom: 4 }}
                        />
                        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 16 }} />
                        <Area type="monotone" dataKey="sent" name="Sent" stroke="hsl(217 91% 60%)" strokeWidth={2} fill="url(#colorSent)" />
                        <Area type="monotone" dataKey="scheduled" name="Scheduled" stroke="hsl(38 92% 50%)" strokeWidth={2} fill="url(#colorScheduled)" />
                        <Area type="monotone" dataKey="failed" name="Failed" stroke="hsl(0 84% 60%)" strokeWidth={2} fill="url(#colorFailed)" />
                    </AreaChart>
                </ResponsiveContainer>
            </motion.div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                {/* Recent Emails */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="lg:col-span-2 h-full">
                    <div className="bg-card rounded-2xl border border-border shadow-card h-full flex flex-col overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                            <h2 className="text-base font-semibold text-foreground">Recent Emails</h2>
                            {/* Only when there's more than the list shows */}
                            {emails.length > RECENT_LIMIT && (
                                <Button variant="ghost" size="sm" className="text-[13px] text-primary hover:text-primary" asChild>
                                    <Link href="/sent">
                                        View all <ArrowRight className="w-4 h-4" />
                                    </Link>
                                </Button>
                            )}
                        </div>
                        <div className="flex-1 flex flex-col">
                            {loading ? (
                                <div className="flex-1 flex items-center justify-center p-12 text-muted-foreground text-sm">Loading…</div>
                            ) : recentEmails.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center gap-3 p-12 text-center">
                                    <PlayOnceImage
                                        animatedSrc="/illustrations/no-emails.webp"
                                        staticSrc="/illustrations/no-emails.png"
                                        durationMs={2000}
                                        width={128}
                                        height={128}
                                        className="w-32 h-32"
                                    />
                                    <p className="text-sm text-muted-foreground">No emails yet. Hit Compose to send your first one.</p>
                                </div>
                            ) : (
                                recentEmails.map((email) => (
                                    <EmailRow
                                        key={email.id}
                                        {...email}
                                        onView={(id) => router.push(`/sent/${id}`)}
                                        onResend={() => router.push("/compose")}
                                    />
                                ))
                            )}
                        </div>
                    </div>
                </motion.div>

                {/* Quick Actions + Scheduled */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="space-y-6">
                    <div className="bg-card rounded-2xl border border-border shadow-card p-5">
                        <h2 className="text-base font-semibold text-foreground mb-4">Quick Actions</h2>
                        <div className="space-y-2.5">
                            {QUICK_ACTIONS.map(({ href, label, icon: Icon }, i) => (
                                <Button
                                    key={href}
                                    variant={i === 0 ? "default" : "outline"}
                                    className="group h-11 w-full justify-between rounded-xl px-4 font-semibold"
                                    asChild
                                >
                                    <Link href={href}>
                                        <span className="flex items-center gap-2.5">
                                            <Icon className="w-4 h-4" />
                                            {label}
                                        </span>
                                        <ArrowRight className={cn("w-4 h-4 transition-transform group-hover:translate-x-0.5", i !== 0 && "text-muted-foreground")} />
                                    </Link>
                                </Button>
                            ))}
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-5 text-primary-foreground shadow-card">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 rounded-lg bg-primary-foreground/20">
                                <Clock className="w-4 h-4" />
                            </div>
                            <h3 className="text-base font-semibold">Scheduled</h3>
                        </div>
                        <p className="text-3xl font-bold mb-1 tabular-nums tracking-tight">{loading ? "—" : stats.scheduled}</p>
                        <p className="text-primary-foreground/80 text-sm">Emails scheduled for delivery</p>
                        <Button variant="secondary" size="sm" className="mt-4 rounded-lg bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground border-0" asChild>
                            <Link href="/history">View Schedule</Link>
                        </Button>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
