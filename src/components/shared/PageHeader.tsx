"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";
import { TopBarActions } from "@/components/layout/TopBarActions";

interface PageHeaderProps {
    title: string;
    description?: string;
    action?: ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
    return (
        <motion.header
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6 md:mb-8"
        >
            <div>
                <h1 className="text-xl md:text-heading-2 font-heading text-foreground">{title}</h1>
                {description && (
                    <p className="text-body-sm md:text-body-base text-muted-foreground mt-1">{description}</p>
                )}
            </div>
            <div className="flex items-center gap-3 shrink-0">
                {action}
                <TopBarActions />
            </div>
        </motion.header>
    );
}
