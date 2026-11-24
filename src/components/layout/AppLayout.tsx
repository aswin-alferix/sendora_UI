"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { TopBarActions } from "./TopBarActions";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/useMediaQuery";

const AUTH_ROUTES = ["/login"];

export function AppLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const isMobile = useIsMobile();

    // Close mobile menu when switching to desktop
    useEffect(() => {
        if (!isMobile) {
            setMobileMenuOpen(false);
        }
    }, [isMobile]);

    // Auth pages (login) render full-bleed without the sidebar/topbar chrome.
    // Must come AFTER all hooks to satisfy the Rules of Hooks.
    const isAuthRoute = AUTH_ROUTES.some((p) => pathname?.startsWith(p));
    if (isAuthRoute) {
        return <>{children}</>;
    }

    // Calculate margin for main content
    const getMainMargin = () => {
        if (isMobile) return 0;
        return sidebarCollapsed ? 72 : 260;
    };

    return (
        <div className="min-h-screen bg-background">
            {/* Skip link for accessibility */}
            <a href="#main-content" className="skip-link">
                Skip to main content
            </a>

            {/* Mobile-only top header — hosts menu trigger + actions pill (desktop pages render the pill in their own PageHeader) */}
            {isMobile && (
                <header className="fixed top-0 left-0 right-0 z-30 h-14 bg-background/85 backdrop-blur-md border-b border-border flex items-center justify-between px-4">
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setMobileMenuOpen(true)}
                            aria-label="Open menu"
                        >
                            <Menu className="w-5 h-5" />
                        </Button>
                        <span className="text-base font-heading font-bold tracking-tight">Sendora</span>
                    </div>
                    <TopBarActions />
                </header>
            )}

            {/* Mobile Overlay */}
            <AnimatePresence>
                {isMobile && mobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-40 bg-black/50"
                        onClick={() => setMobileMenuOpen(false)}
                        aria-hidden="true"
                    />
                )}
            </AnimatePresence>

            {/* Sidebar */}
            <Sidebar
                collapsed={sidebarCollapsed}
                onCollapsedChange={setSidebarCollapsed}
                isMobile={isMobile}
                mobileOpen={mobileMenuOpen}
                onMobileClose={() => setMobileMenuOpen(false)}
            />

            <motion.main
                id="main-content"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, marginLeft: getMainMargin() }}
                transition={{ duration: 0.2 }}
                className={`min-h-screen ${isMobile ? "pt-14" : ""}`}
                tabIndex={-1}
            >
                {children}
            </motion.main>
        </div>
    );
}
