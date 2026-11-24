"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, Filter, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmailRow } from "@/components/shared/EmailRow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { usePagination } from "@/hooks/usePagination";
import { useToast } from "@/hooks/use-toast";

interface SentEmail {
    id: string;
    to: string;
    subject: string;
    status: "sent" | "pending" | "failed";
    date: string;
}

const PAGE_SIZE = 10;

function relativeDate(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();
    const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    if (sameDay) return `Today, ${time}`;
    if (isYesterday) return `Yesterday, ${time}`;
    return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

export default function SentPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [emails, setEmails] = useState<SentEmail[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch("/api/emails");
                const data = await res.json();
                if (cancelled) return;
                const items: SentEmail[] = (data.items ?? []).map((e: { id: string; to: string[]; subject: string; status: string; createdAt: string; sentAt?: string; scheduledAt?: string }) => ({
                    id: e.id,
                    to: e.to.join(", "),
                    subject: e.subject,
                    status: e.status === "scheduled" ? "pending" : (e.status as "sent" | "failed"),
                    date: relativeDate(e.sentAt ?? e.scheduledAt ?? e.createdAt),
                }));
                setEmails(items);
            } catch (err) {
                console.error("Failed to load emails", err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const filteredEmails = emails.filter((email) => {
        const matchesSearch =
            email.to.toLowerCase().includes(searchQuery.toLowerCase()) ||
            email.subject.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === "all" || email.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const { page, totalPages, paginatedItems, goNext, goPrev, hasNext, hasPrev, from, to, total, reset } =
        usePagination(filteredEmails, PAGE_SIZE);

    useEffect(() => { reset(); }, [searchQuery, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleView = (id: string) => {
        router.push(`/sent/${id}`);
    };

    const handleResend = (id: string) => {
        const email = emails.find((e) => e.id === id);
        if (!email) return;
        router.push(`/compose?to=${encodeURIComponent(email.to)}`);
        toast({ title: "Compose opened", description: `Pre-filled to ${email.to}` });
    };

    const handleExport = () => {
        const csv = [
            ["ID", "To", "Subject", "Status", "Date"],
            ...filteredEmails.map((e) => [e.id, e.to, e.subject, e.status, e.date]),
        ]
            .map((row) => row.map((cell) => `"${cell}"`).join(","))
            .join("\n");

        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "sent-emails.csv";
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
            <PageHeader
                title="Sent Emails"
                description="View and manage all your sent emails"
                action={
                    <Button variant="outline" onClick={handleExport}>
                        <Download className="w-4 h-4" />
                        Export CSV
                    </Button>
                }
            />

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col sm:flex-row gap-4 mb-6"
            >
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by recipient or subject..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[160px]">
                        <Filter className="w-4 h-4 mr-2" />
                        <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="sent">Sent</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                </Select>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-card rounded-xl border border-border shadow-card"
            >
                {paginatedItems.length > 0 ? (
                    paginatedItems.map((email) => (
                        <EmailRow
                            key={email.id}
                            {...email}
                            onView={handleView}
                            onResend={handleResend}
                        />
                    ))
                ) : (
                    <div className="py-16 text-center">
                        <p className="text-muted-foreground">No emails found matching your criteria.</p>
                    </div>
                )}
            </motion.div>

            {/* Pagination */}
            {total > 0 && (
                <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
                    <p>Showing {from}–{to} of {total} emails</p>
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
