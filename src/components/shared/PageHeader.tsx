"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

interface PageHeaderProps {
    title: string;
    description?: string;
    /** Icon shown before the title, in the primary colour. */
    icon?: LucideIcon;
    /** Record count shown as a pill next to the title (e.g. number of emails). */
    count?: number;
    action?: ReactNode;
}

export function PageHeader({ title, description, icon: Icon, count, action }: PageHeaderProps) {
    return (
        <motion.header
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
        >
            <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                    {Icon && <Icon className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />}
                    <h1 className="truncate text-xl leading-tight font-bold tracking-tight text-foreground">{title}</h1>
                    {count !== undefined && (
                        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-muted px-2 text-xs font-semibold tabular-nums text-foreground/70">
                            {count.toLocaleString()}
                        </span>
                    )}
                </div>
                {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
            </div>
            {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </motion.header>
    );
}
