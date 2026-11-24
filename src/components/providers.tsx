"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { MsalProvider } from "@azure/msal-react";
import { EventType, AuthenticationResult } from "@azure/msal-browser";
import { msalInstance } from "@/lib/msal/config";

/**
 * Initializes MSAL once on mount and processes any redirect responses.
 * Renders nothing until init completes so child components don't see an
 * uninitialized instance.
 */
function MsalGate({ children }: { children: React.ReactNode }) {
    const [ready, setReady] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            await msalInstance.initialize();
            // Capture redirect responses (when using loginRedirect) — no-op for popup flows
            await msalInstance.handleRedirectPromise();

            // If MSAL emits a successful login event, ensure it becomes the active account
            msalInstance.addEventCallback((event) => {
                if (
                    event.eventType === EventType.LOGIN_SUCCESS &&
                    event.payload &&
                    "account" in event.payload &&
                    event.payload.account
                ) {
                    msalInstance.setActiveAccount((event.payload as AuthenticationResult).account);
                }
            });

            if (!cancelled) setReady(true);
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    if (!ready) return null;
    return <MsalProvider instance={msalInstance}>{children}</MsalProvider>;
}

export function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 60 * 1000,
                        gcTime: 5 * 60 * 1000,
                        retry: 1,
                    },
                },
            })
    );

    return (
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <MsalGate>
                <AuthProvider>
                    <QueryClientProvider client={queryClient}>
                        <TooltipProvider>
                            {children}
                            <Toaster />
                            <Sonner />
                        </TooltipProvider>
                    </QueryClientProvider>
                </AuthProvider>
            </MsalGate>
        </ThemeProvider>
    );
}
