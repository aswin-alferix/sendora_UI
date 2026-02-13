"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/useMediaQuery";

export function AppLayout({ children }: { children: React.ReactNode }) {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const isMobile = useIsMobile();

    // Close mobile menu when switching to desktop
    useEffect(() => {
        if (!isMobile) {
            setMobileMenuOpen(false);
        }
    }, [isMobile]);

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

            {/* Mobile Header */}
            {isMobile && (
                <header className="fixed top-0 left-0 right-0 z-30 h-14 bg-sidebar border-b border-sidebar-border flex items-center px-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setMobileMenuOpen(true)}
                        aria-label="Open menu"
                        className="text-sidebar-foreground"
                    >
                        <Menu className="w-5 h-5" />
                    </Button>
                    <span className="ml-3 text-lg font-heading font-bold text-sidebar-foreground">
                        Sendora
                    </span>
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
