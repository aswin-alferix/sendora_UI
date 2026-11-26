"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import { Sidebar, SIDEBAR_EXPANDED_WIDTH, SIDEBAR_RAIL_WIDTH } from "./Sidebar";
import { TopBar } from "./TopBar";
import { useIsMobile } from "@/hooks/useMediaQuery";

const AUTH_ROUTES = ["/login"];

export function AppLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    // Desktop: icon rail by default, ☰ expands it to show labels.
    const [sidebarExpanded, setSidebarExpanded] = useState(false);
    // Mobile: slide-in drawer.
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const isMobile = useIsMobile();
    const drawerOpen = isMobile && mobileMenuOpen;

    // Auth pages (login) render full-bleed without the app chrome.
    // Must come AFTER all hooks to satisfy the Rules of Hooks.
    const isAuthRoute = AUTH_ROUTES.some((p) => pathname?.startsWith(p));
    if (isAuthRoute) {
        return <>{children}</>;
    }

    const handleToggleSidebar = () => {
        if (isMobile) setMobileMenuOpen((open) => !open);
        else setSidebarExpanded((open) => !open);
    };

    const mainOffset = isMobile ? 0 : sidebarExpanded ? SIDEBAR_EXPANDED_WIDTH : SIDEBAR_RAIL_WIDTH;

    return (
        <div className="min-h-screen bg-background">
            <a href="#main-content" className="skip-link">
                Skip to main content
            </a>

            <TopBar onToggleSidebar={handleToggleSidebar} />

            {/* Mobile overlay (below the top bar, so ☰ stays clickable) */}
            <AnimatePresence>
                {drawerOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-x-0 bottom-0 top-16 z-40 bg-black/40"
                        onClick={() => setMobileMenuOpen(false)}
                        aria-hidden="true"
                    />
                )}
            </AnimatePresence>

            <Sidebar
                expanded={sidebarExpanded}
                isMobile={isMobile}
                mobileOpen={drawerOpen}
                onMobileClose={() => setMobileMenuOpen(false)}
            />

            <main
                id="main-content"
                tabIndex={-1}
                className="min-h-screen pt-16 transition-[margin] duration-200 ease-in-out"
                style={{ marginLeft: mainOffset }}
            >
                {children}
            </main>
        </div>
    );
}
