"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Filter, Download } from "lucide-react";
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

// Mock data for sent emails
const sentEmails = [
    {
        id: "1",
        to: "john.doe@company.com",
        subject: "Weekly Report - Q4 Updates",
        status: "sent" as const,
        date: "Today, 2:30 PM",
    },
    {
        id: "2",
        to: "marketing@startup.io",
        subject: "Partnership Proposal",
        status: "sent" as const,
        date: "Today, 1:15 PM",
    },
    {
        id: "3",
        to: "team@agency.co",
        subject: "Project Kickoff Meeting",
        status: "pending" as const,
        date: "Today, 11:00 AM",
    },
    {
        id: "4",
        to: "support@vendor.net",
        subject: "Invoice #12345 - Payment Confirmation",
        status: "failed" as const,
        date: "Yesterday, 4:45 PM",
    },
    {
        id: "5",
        to: "hr@enterprise.com",
        subject: "New Hire Onboarding Documents",
        status: "sent" as const,
        date: "Yesterday, 2:30 PM",
    },
    {
        id: "6",
        to: "sales@business.org",
        subject: "Quarterly Sales Forecast",
        status: "sent" as const,
        date: "Jan 10, 2025",
    },
    {
        id: "7",
        to: "ceo@startup.io",
        subject: "Board Meeting Summary",
        status: "sent" as const,
        date: "Jan 9, 2025",
    },
    {
        id: "8",
        to: "dev@techcorp.com",
        subject: "API Integration Docs",
        status: "sent" as const,
        date: "Jan 8, 2025",
    },
];

export default function SentPage() {
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");

    const filteredEmails = sentEmails.filter((email) => {
        const matchesSearch =
            email.to.toLowerCase().includes(searchQuery.toLowerCase()) ||
            email.subject.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === "all" || email.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
            <PageHeader
                title="Sent Emails"
                description="View and manage all your sent emails"
                action={
                    <Button variant="outline">
                        <Download className="w-4 h-4" />
                        Export
                    </Button>
                }
            />

            {/* Filters */}
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

            {/* Email List */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-card rounded-xl border border-border shadow-card"
            >
                {filteredEmails.length > 0 ? (
                    filteredEmails.map((email) => (
                        <EmailRow
                            key={email.id}
                            {...email}
                            onView={(id) => console.log("View:", id)}
                            onResend={(id) => console.log("Resend:", id)}
                        />
                    ))
                ) : (
                    <div className="py-16 text-center">
                        <p className="text-muted-foreground">No emails found matching your criteria.</p>
                    </div>
                )}
            </motion.div>

            {/* Pagination info */}
            <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
                <p>Showing {filteredEmails.length} of {sentEmails.length} emails</p>
            </div>
        </div>
    );
}
