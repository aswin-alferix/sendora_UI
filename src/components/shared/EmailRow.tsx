"use client";

import { motion } from "framer-motion";
import { Check, Clock, AlertCircle, MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface EmailRowProps {
    id: string;
    to: string;
    subject: string;
    status: "sent" | "pending" | "failed";
    date: string;
    onView?: (id: string) => void;
    onResend?: (id: string) => void;
}

const statusConfig = {
    sent: {
        icon: Check,
        label: "Sent",
        className: "bg-success/10 text-success",
    },
    pending: {
        icon: Clock,
        label: "Pending",
        className: "bg-warning/10 text-warning",
    },
    failed: {
        icon: AlertCircle,
        label: "Failed",
        className: "bg-destructive/10 text-destructive",
    },
};

export function EmailRow({ id, to, subject, status, date, onView, onResend }: EmailRowProps) {
    const statusInfo = statusConfig[status];
    const StatusIcon = statusInfo.icon;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            whileHover={{ backgroundColor: "hsl(var(--muted))" }}
            className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-4 border-b border-border last:border-b-0 transition-colors"
        >
            <div className="flex-1 min-w-0">
                <p className="text-body-base font-medium text-foreground truncate">{to}</p>
                <p className="text-body-sm text-muted-foreground truncate mt-0.5">{subject}</p>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                <div className="flex items-center gap-3">
                    <span
                        className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-body-xs font-medium",
                            statusInfo.className
                        )}
                    >
                        <StatusIcon className="w-3.5 h-3.5" aria-hidden="true" />
                        {statusInfo.label}
                    </span>

                    <span className="text-body-sm text-muted-foreground hidden sm:inline sm:w-24 sm:text-right">{date}</span>
                </div>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label="More options">
                            <MoreVertical className="w-4 h-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={() => onView?.(id)}>View details</DropdownMenuItem>
                        {status === "failed" && (
                            <DropdownMenuItem onClick={() => onResend?.(id)}>Resend email</DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </motion.div>
    );
}
