"use client";

import { motion } from "framer-motion";
import { Clock, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";

interface ActivityItem {
    id: string;
    action: string;
    target: string;
    timestamp: string;
    type: "sent" | "opened" | "clicked" | "bounced";
}

const activityItems: ActivityItem[] = [
    { id: "1", action: "Email sent to", target: "john.doe@company.com", timestamp: "2 minutes ago", type: "sent" },
    { id: "2", action: "Email opened by", target: "sarah@startup.io", timestamp: "15 minutes ago", type: "opened" },
    { id: "3", action: "Link clicked by", target: "mike@agency.co", timestamp: "1 hour ago", type: "clicked" },
    { id: "4", action: "Email sent to", target: "marketing@startup.io", timestamp: "2 hours ago", type: "sent" },
    { id: "5", action: "Email bounced for", target: "support@vendor.net", timestamp: "3 hours ago", type: "bounced" },
    { id: "6", action: "Email sent to", target: "hr@enterprise.com", timestamp: "4 hours ago", type: "sent" },
    { id: "7", action: "Email opened by", target: "dev@techcorp.com", timestamp: "5 hours ago", type: "opened" },
    { id: "8", action: "Email sent to", target: "sales@business.org", timestamp: "Yesterday", type: "sent" },
    { id: "9", action: "Link clicked by", target: "emily@design.co", timestamp: "Yesterday", type: "clicked" },
    { id: "10", action: "Email sent to", target: "team@agency.co", timestamp: "2 days ago", type: "sent" },
];

const typeColors = {
    sent: "bg-primary/10 text-primary",
    opened: "bg-success/10 text-success",
    clicked: "bg-accent text-accent-foreground",
    bounced: "bg-destructive/10 text-destructive",
};

export default function HistoryPage() {
    return (
        <div className="p-4 md:p-8 max-w-4xl mx-auto">
            <PageHeader
                title="Activity History"
                description="Track all email activity and events"
            />

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card rounded-xl border border-border shadow-card"
            >
                <div className="divide-y divide-border">
                    {activityItems.map((item, index) => (
                        <motion.div
                            key={item.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors"
                        >
                            <div className={`flex items-center justify-center w-10 h-10 rounded-full ${typeColors[item.type]}`}>
                                <Clock className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-body-base text-foreground">
                                    {item.action} <span className="font-medium">{item.target}</span>
                                </p>
                                <p className="text-body-sm text-muted-foreground">{item.timestamp}</p>
                            </div>
                            <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                        </motion.div>
                    ))}
                </div>
            </motion.div>
        </div>
    );
}
