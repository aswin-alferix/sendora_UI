"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    Mail,
    Mails,
    Send,
    LayoutDashboard,
    History,
    Settings,
    Users,
    FileText,
    ChevronLeft,
    ChevronRight,
    Zap,
    X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Compose", href: "/compose", icon: Mail },
    { name: "Bulk Send", href: "/bulk-send", icon: Mails },
    { name: "Sent", href: "/sent", icon: Send },
    { name: "Templates", href: "/templates", icon: FileText },
    { name: "Contacts", href: "/contacts", icon: Users },
    { name: "History", href: "/history", icon: History },
];

const bottomNavigation = [
    { name: "Settings", href: "/settings", icon: Settings },
];

interface SidebarProps {
    collapsed: boolean;
    onCollapsedChange: (collapsed: boolean) => void;
    isMobile?: boolean;
    mobileOpen?: boolean;
    onMobileClose?: () => void;
}

export function Sidebar({
    collapsed,
    onCollapsedChange,
    isMobile = false,
    mobileOpen = false,
    onMobileClose
}: SidebarProps) {
    const pathname = usePathname();

    // For mobile: show as slide-in drawer
    // For desktop: show as fixed sidebar
    const sidebarClasses = cn(
        "fixed top-0 z-50 h-screen bg-sidebar border-r border-sidebar-border flex flex-col",
        isMobile
            ? "left-0 w-[280px] transition-transform duration-300 ease-in-out"
            : "left-0"
    );

    const sidebarStyle = isMobile
        ? { transform: mobileOpen ? "translateX(0)" : "translateX(-100%)" }
        : {};

    const handleNavClick = () => {
        // Close mobile menu when navigating
        if (isMobile && onMobileClose) {
            onMobileClose();
        }
    };

    const sidebarContent = (
        <>
            {/* Logo Section */}
            <div className="flex items-center justify-between h-16 px-4 border-b border-sidebar-border">
                <Link href="/" className="flex items-center gap-3 focus-ring rounded-lg" onClick={handleNavClick}>
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg gradient-primary">
                        <Zap className="w-5 h-5 text-primary-foreground" aria-hidden="true" />
                    </div>
                    {(isMobile || !collapsed) && (
                        <motion.span
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="text-xl font-heading font-bold text-sidebar-foreground"
                        >
                            Sendora
                        </motion.span>
                    )}
                </Link>
                {isMobile && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onMobileClose}
                        aria-label="Close menu"
                        className="text-sidebar-foreground"
                    >
                        <X className="w-5 h-5" />
                    </Button>
                )}
                {!isMobile && !collapsed && (
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => onCollapsedChange(true)}
                        aria-label="Collapse sidebar"
                        className="h-7 w-7 text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </Button>
                )}
            </div>

            {/* Expand toggle — only visible when collapsed (desktop) */}
            {!isMobile && collapsed && (
                <div className="flex justify-center border-b border-sidebar-border py-1.5">
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => onCollapsedChange(false)}
                        aria-label="Expand sidebar"
                        className="h-7 w-7 text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                </div>
            )}

            {/* Main Navigation */}
            <nav className="flex-1 overflow-y-auto py-4 px-3">
                <ul className="space-y-1" role="list">
                    {navigation.map((item) => {
                        const isActive = pathname === item.href;
                        const Icon = item.icon;

                        const linkContent = (
                            <Link
                                href={item.href}
                                onClick={handleNavClick}
                                className={cn(
                                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 focus-ring",
                                    isActive
                                        ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                                )}
                                aria-current={isActive ? "page" : undefined}
                            >
                                <Icon className="w-5 h-5 shrink-0" aria-hidden="true" />
                                {(isMobile || !collapsed) && (
                                    <motion.span
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                    >
                                        {item.name}
                                    </motion.span>
                                )}
                            </Link>
                        );

                        return (
                            <li key={item.name}>
                                {!isMobile && collapsed ? (
                                    <Tooltip delayDuration={0}>
                                        <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                                        <TooltipContent side="right" className="font-medium">
                                            {item.name}
                                        </TooltipContent>
                                    </Tooltip>
                                ) : (
                                    linkContent
                                )}
                            </li>
                        );
                    })}
                </ul>
            </nav>

            {/* Bottom Navigation */}
            <div className="border-t border-sidebar-border py-4 px-3">
                <ul className="space-y-1" role="list">
                    {bottomNavigation.map((item) => {
                        const isActive = pathname === item.href;
                        const Icon = item.icon;

                        const linkContent = (
                            <Link
                                href={item.href}
                                onClick={handleNavClick}
                                className={cn(
                                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 focus-ring",
                                    isActive
                                        ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                                )}
                                aria-current={isActive ? "page" : undefined}
                            >
                                <Icon className="w-5 h-5 shrink-0" aria-hidden="true" />
                                {(isMobile || !collapsed) && (
                                    <motion.span
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                    >
                                        {item.name}
                                    </motion.span>
                                )}
                            </Link>
                        );

                        return (
                            <li key={item.name}>
                                {!isMobile && collapsed ? (
                                    <Tooltip delayDuration={0}>
                                        <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                                        <TooltipContent side="right" className="font-medium">
                                            {item.name}
                                        </TooltipContent>
                                    </Tooltip>
                                ) : (
                                    linkContent
                                )}
                            </li>
                        );
                    })}
                </ul>
            </div>
        </>
    );

    // For mobile, render with slide animation
    if (isMobile) {
        return (
            <aside
                className={sidebarClasses}
                style={sidebarStyle}
                role="navigation"
                aria-label="Main navigation"
            >
                {sidebarContent}
            </aside>
        );
    }

    // For desktop, render with width animation
    return (
        <motion.aside
            initial={false}
            animate={{ width: collapsed ? 72 : 260 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className={sidebarClasses}
            role="navigation"
            aria-label="Main navigation"
        >
            {sidebarContent}
        </motion.aside>
    );
}

