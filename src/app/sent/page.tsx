"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Filter, MoreVertical, Send } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { PlayOnceImage } from "@/components/shared/PlayOnceImage";
import { StatusBadge, type StatusTone } from "@/components/shared/StatusBadge";
import { DataTable, TOOLBAR_BUTTON, type DataTableColumn } from "@/components/shared/data-table/DataTable";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { backend } from "@/lib/axios";

type SentStatus = "sent" | "pending" | "failed";

interface SentEmail {
    id: string;
    to: string;
    subject: string;
    status: SentStatus;
    /** Raw timestamp, for sorting. */
    at: Date;
    /** Friendly label ("Today, 3:40 PM"). */
    date: string;
}

const STATUS: Record<SentStatus, { label: string; tone: StatusTone }> = {
    sent: { label: "Sent", tone: "success" },
    pending: { label: "Pending", tone: "warning" },
    failed: { label: "Failed", tone: "destructive" },
};

function relativeDate(d: Date): string {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    if (d.toDateString() === now.toDateString()) return `Today, ${time}`;
    if (d.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`;
    return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function csvCell(value: string) {
    return `"${value.replace(/"/g, '""')}"`;
}

export default function SentPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [emails, setEmails] = useState<SentEmail[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const { data } = await backend.get("/api/emails");
                if (cancelled) return;
                const items: SentEmail[] = (data.items ?? []).map(
                    (e: { id: string; to: string[]; subject: string; status: string; createdAt: string; sentAt?: string; scheduledAt?: string }) => {
                        const at = new Date(e.sentAt ?? e.scheduledAt ?? e.createdAt);
                        return {
                            id: e.id,
                            to: e.to.join(", "),
                            subject: e.subject,
                            status: e.status === "scheduled" ? "pending" : (e.status as "sent" | "failed"),
                            at,
                            date: relativeDate(at),
                        };
                    }
                );
                setEmails(items);
            } catch (err) {
                console.error("Failed to load emails", err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const filteredEmails = useMemo(
        () => (statusFilter === "all" ? emails : emails.filter((e) => e.status === statusFilter)),
        [emails, statusFilter]
    );

    const handleView = (id: string) => router.push(`/sent/${id}`);

    const handleResend = (email: SentEmail) => {
        router.push(`/compose?to=${encodeURIComponent(email.to)}`);
        toast({ title: "Compose opened", description: `Pre-filled to ${email.to}` });
    };

    /** Exports the selected rows, or everything matching the status filter when nothing is selected. */
    const handleExport = (rows: SentEmail[]) => {
        const csv = [
            ["ID", "To", "Subject", "Status", "Date"],
            ...rows.map((e) => [e.id, e.to, e.subject, STATUS[e.status].label, e.at.toISOString()]),
        ]
            .map((row) => row.map(csvCell).join(","))
            .join("\n");
        const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = "sent-emails.csv";
        a.click();
        URL.revokeObjectURL(url);
    };

    const columns: DataTableColumn<SentEmail>[] = [
        {
            id: "to",
            header: "Recipient",
            hideable: false,
            sortValue: (e) => e.to,
            className: "min-w-[240px]",
            cell: (e) => (
                <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold uppercase text-primary-foreground">
                        {e.to.charAt(0) || "?"}
                    </span>
                    <span className="truncate font-medium" title={e.to}>
                        {e.to}
                    </span>
                </div>
            ),
        },
        {
            id: "subject",
            header: "Subject",
            sortValue: (e) => e.subject,
            className: "min-w-[240px] max-w-[420px]",
            cell: (e) => (
                <span className="block truncate text-muted-foreground" title={e.subject}>
                    {e.subject || "(no subject)"}
                </span>
            ),
        },
        {
            id: "status",
            header: "Status",
            sortValue: (e) => STATUS[e.status].label,
            cell: (e) => <StatusBadge tone={STATUS[e.status].tone}>{STATUS[e.status].label}</StatusBadge>,
        },
        {
            id: "date",
            header: "Date",
            sortValue: (e) => e.at,
            className: "whitespace-nowrap",
            cell: (e) => <span className="text-muted-foreground">{e.date}</span>,
        },
    ];

    return (
        <div className="flex h-[calc(100dvh-4rem)] min-h-[600px] flex-col px-4 py-6 md:px-8">
            <PageHeader
                icon={Send}
                title="Sent Emails"
                count={loading ? undefined : emails.length}
                description="View and manage all your sent emails"
            />

            <DataTable
                data={filteredEmails}
                columns={columns}
                getRowId={(e) => e.id}
                loading={loading}
                selectable
                itemLabel="emails"
                initialSort={{ id: "date", desc: true }}
                getSearchText={(e) => `${e.to} ${e.subject}`}
                searchPlaceholder="Search by recipient or subject…"
                filters={
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="h-9 w-[148px] gap-2 rounded-lg bg-card px-3.5 text-sm font-medium shadow-sm" aria-label="Filter by status">
                            <Filter className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <SelectValue placeholder="All Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="sent">Sent</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="failed">Failed</SelectItem>
                        </SelectContent>
                    </Select>
                }
                actions={(selected) => (
                    <Button
                        variant="outline"
                        className={TOOLBAR_BUTTON}
                        disabled={filteredEmails.length === 0}
                        onClick={() => handleExport(selected.length ? selected : filteredEmails)}
                    >
                        <Download />
                        {selected.length ? `Export ${selected.length}` : "Export CSV"}
                    </Button>
                )}
                rowActions={(e) => (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" aria-label="Email actions">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem onClick={() => handleView(e.id)}>View details</DropdownMenuItem>
                            {e.status === "failed" && (
                                <DropdownMenuItem onClick={() => handleResend(e)}>Resend email</DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
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
                        {emails.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No emails sent yet. Hit Compose to send your first one.</p>
                        ) : (
                            <>
                                <p className="text-sm text-muted-foreground">No emails match your search or filter.</p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        clearSearch();
                                        setStatusFilter("all");
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
