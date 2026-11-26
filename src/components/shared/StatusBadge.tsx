import { cn } from "@/lib/utils";

export type StatusTone = "success" | "warning" | "destructive" | "info" | "neutral";

const toneClasses: Record<StatusTone, string> = {
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    destructive: "bg-destructive/10 text-destructive",
    info: "bg-primary/10 text-primary",
    neutral: "bg-muted text-muted-foreground",
};

/** Small rounded status pill used in tables (Sent, Failed, Active…). */
export function StatusBadge({ tone, children, className }: { tone: StatusTone; children: React.ReactNode; className?: string }) {
    return (
        <span
            className={cn(
                "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold leading-none whitespace-nowrap",
                toneClasses[tone],
                className
            )}
        >
            {children}
        </span>
    );
}
