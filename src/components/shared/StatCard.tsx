"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface StatCardProps {
    icon: ReactNode;
    label: string;
    value: string | number;
    change?: {
        value: string;
        positive: boolean;
    };
    className?: string;
}

export function StatCard({ icon, label, value, change, className }: StatCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -2 }}
            transition={{ duration: 0.2 }}
            className={cn(
                "bg-card rounded-xl border border-border p-6 shadow-card hover:shadow-md transition-shadow",
                className
            )}
        >
            <div className="flex items-start justify-between">
                <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-accent">
                    {icon}
                </div>
                {change && (
                    <span
                        className={cn(
                            "text-body-sm font-medium px-2 py-1 rounded-md",
                            change.positive
                                ? "bg-success/10 text-success"
                                : "bg-destructive/10 text-destructive"
                        )}
                    >
                        {change.positive ? "+" : ""}{change.value}
                    </span>
                )}
            </div>
            <div className="mt-4">
                <p className="text-body-sm text-muted-foreground">{label}</p>
                <p className="text-heading-2 font-heading text-foreground mt-1">{value}</p>
            </div>
        </motion.div>
    );
}
