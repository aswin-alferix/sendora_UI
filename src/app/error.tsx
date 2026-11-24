"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 p-8 text-center">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10">
                <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
            <div className="space-y-2">
                <h2 className="text-heading-3 font-heading">Something went wrong</h2>
                <p className="text-body-sm text-muted-foreground max-w-sm">
                    {error.message || "An unexpected error occurred. Please try again."}
                </p>
                {error.digest && (
                    <p className="text-xs text-muted-foreground font-mono">
                        Error ID: {error.digest}
                    </p>
                )}
            </div>
            <Button onClick={reset} variant="outline" className="gap-2">
                <RefreshCw className="w-4 h-4" />
                Try again
            </Button>
        </div>
    );
}
