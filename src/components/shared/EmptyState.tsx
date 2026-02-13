"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
    icon: ReactNode;
    title: string;
    description: string;
    action?: ReactNode;
    className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className={cn(
                "flex flex-col items-center justify-center py-16 px-4 text-center",
                className
            )}
        >
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-6">
                {icon}
            </div>
            <h3 className="text-heading-4 font-heading text-foreground mb-2">{title}</h3>
            <p className="text-body-base text-muted-foreground max-w-sm mb-6">{description}</p>
            {action}
        </motion.div>
    );
}
