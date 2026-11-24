"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    Mail, Send, Clock, ArrowRight, Plus, CheckCircle, AlertCircle, CalendarClock,
} from "lucide-react";
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer, Legend,
} from "recharts";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { EmailRow } from "@/components/shared/EmailRow";
import { Button } from "@/components/ui/button";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

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
                const res = await fetch("/api/emails?limit=500");
                const data = await res.json();
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
            emails.slice(0, 5).map((e) => ({
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
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
            <PageHeader
                title="Dashboard"
                description="Monitor your email activity and performance"
                action={
                    <Button asChild>
                        <Link href="/compose">
                            <Plus className="w-4 h-4" />
                            Compose Email
                        </Link>
                    </Button>
                }
            />

            {/* Stats Grid */}
            <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <motion.div variants={item}>
                    <StatCard icon={<Send className="w-6 h-6 text-primary" />} label="Emails Sent" value={loading ? "—" : stats.sent.toLocaleString()} />
                </motion.div>
                <motion.div variants={item}>
                    <StatCard icon={<CheckCircle className="w-6 h-6 text-success" />} label="Delivery Rate" value={loading ? "—" : stats.deliveryRate} />
                </motion.div>
                <motion.div variants={item}>
                    <StatCard icon={<CalendarClock className="w-6 h-6 text-warning" />} label="Scheduled" value={loading ? "—" : stats.scheduled.toLocaleString()} />
                </motion.div>
                <motion.div variants={item}>
                    <StatCard icon={<AlertCircle className="w-6 h-6 text-destructive" />} label="Failed" value={loading ? "—" : stats.failed.toLocaleString()} />
                </motion.div>
            </motion.div>

            {/* Chart */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="bg-card rounded-xl border border-border shadow-card p-6 mb-8"
            >
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-heading-4 font-heading text-foreground">Email Performance</h2>
                        <p className="text-body-sm text-muted-foreground">Sent, scheduled, and failed over time</p>
                    </div>
                    <Select value={period} onValueChange={(v) => setPeriod(v as "7d" | "30d" | "90d")}>
                        <SelectTrigger className="w-28">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="7d">Last 7 days</SelectItem>
                            <SelectItem value="30d">Last 30 days</SelectItem>
                            <SelectItem value="90d">Last 90 days</SelectItem>
                        </SelectContent>
                    </Select>
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
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Recent Emails */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="lg:col-span-2">
                    <div className="bg-card rounded-xl border border-border shadow-card">
                        <div className="flex items-center justify-between p-4 border-b border-border">
                            <h2 className="text-heading-4 font-heading text-foreground">Recent Emails</h2>
                            <Button variant="ghost" size="sm" asChild>
                                <Link href="/sent">
                                    View all <ArrowRight className="w-4 h-4" />
                                </Link>
                            </Button>
                        </div>
                        <div>
                            {loading ? (
                                <div className="p-12 text-center text-muted-foreground text-sm">Loading…</div>
                            ) : recentEmails.length === 0 ? (
                                <div className="p-12 text-center text-muted-foreground text-sm">No emails yet. Hit Compose to send your first one.</div>
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
                    <div className="bg-card rounded-xl border border-border shadow-card p-6">
                        <h2 className="text-heading-4 font-heading text-foreground mb-4">Quick Actions</h2>
                        <div className="space-y-3">
                            <Button variant="outline" className="w-full justify-start" asChild>
                                <Link href="/compose"><Mail className="w-4 h-4 text-primary" />New Email</Link>
                            </Button>
                            <Button variant="outline" className="w-full justify-start" asChild>
                                <Link href="/templates"><Plus className="w-4 h-4 text-primary" />Create Template</Link>
                            </Button>
                            <Button variant="outline" className="w-full justify-start" asChild>
                                <Link href="/contacts"><Plus className="w-4 h-4 text-primary" />Add Contact</Link>
                            </Button>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-primary to-primary/80 rounded-xl p-6 text-primary-foreground">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 rounded-lg bg-primary-foreground/20">
                                <Clock className="w-5 h-5" />
                            </div>
                            <h3 className="text-lg font-medium">Scheduled</h3>
                        </div>
                        <p className="text-4xl font-heading font-bold mb-2 tabular-nums">{loading ? "—" : stats.scheduled}</p>
                        <p className="text-primary-foreground/80 text-sm">Emails scheduled for delivery</p>
                        <Button variant="secondary" size="sm" className="mt-4 bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground border-0" asChild>
                            <Link href="/history">View Schedule</Link>
                        </Button>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
