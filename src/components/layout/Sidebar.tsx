"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    Mail,
    Mails,
    Send,
    LayoutDashboard,
    History,
    Settings,
    Users,
    FileText,
    type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface NavItem {
    name: string;
    href: string;
    icon: LucideIcon;
}

export const navigation: NavItem[] = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Compose", href: "/compose", icon: Mail },
    { name: "Bulk Send", href: "/bulk-send", icon: Mails },
    { name: "Sent", href: "/sent", icon: Send },
    { name: "Templates", href: "/templates", icon: FileText },
    { name: "Contacts", href: "/contacts", icon: Users },
    { name: "History", href: "/history", icon: History },
    { name: "Settings", href: "/settings", icon: Settings },
];

/** The nav item for the current route (used by the top-bar breadcrumb). */
export function findNavItem(pathname: string | null): NavItem | undefined {
    return navigation.find((item) => isActivePath(pathname, item.href));
}

/** Rail width (icons only) and expanded width, in px. AppLayout offsets the page by these. */
export const SIDEBAR_RAIL_WIDTH = 64;
export const SIDEBAR_EXPANDED_WIDTH = 224;

interface SidebarProps {
    expanded: boolean;
    isMobile?: boolean;
    mobileOpen?: boolean;
    onMobileClose?: () => void;
}

function isActivePath(pathname: string | null, href: string) {
    if (!pathname) return false;
    return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ expanded, isMobile = false, mobileOpen = false, onMobileClose }: SidebarProps) {
    const pathname = usePathname();
    const showLabels = isMobile || expanded;

    const renderItem = (item: NavItem) => {
        const active = isActivePath(pathname, item.href);
        const Icon = item.icon;
        const link = (
            <Link
                href={item.href}
                onClick={isMobile ? onMobileClose : undefined}
                aria-current={active ? "page" : undefined}
                aria-label={showLabels ? undefined : item.name}
                className={cn(
                    "relative flex h-10 items-center gap-3 rounded-lg text-sm font-medium transition-colors focus-ring",
                    showLabels ? "pl-3 pr-6" : "justify-center",
                    active
                        ? "bg-primary/10 text-primary"
                        : "text-foreground/75 hover:bg-muted hover:text-foreground"
                )}
            >
                <Icon className={cn("h-4 w-4 shrink-0", !active && "text-muted-foreground")} aria-hidden="true" />
                {showLabels && <span className="truncate">{item.name}</span>}
                {active && (
                    <span
                        className={cn(
                            "absolute top-1/2 h-4 w-1 -translate-y-1/2 rounded-full bg-primary",
                            showLabels ? "right-2" : "right-0.5"
                        )}
                        aria-hidden="true"
                    />
                )}
            </Link>
        );

        return (
            <li key={item.href}>
                {showLabels ? (
                    link
                ) : (
                    <Tooltip delayDuration={0}>
                        <TooltipTrigger asChild>{link}</TooltipTrigger>
                        <TooltipContent side="right" sideOffset={10} className="font-medium">
                            {item.name}
                        </TooltipContent>
                    </Tooltip>
                )}
            </li>
        );
    };

    return (
        <aside
            role="navigation"
            aria-label="Main navigation"
            className={cn(
                "fixed left-0 flex flex-col border-r border-border bg-card",
                "transition-[width,transform] duration-200 ease-in-out",
                isMobile ? "top-16 bottom-0 z-50 shadow-xl" : "top-16 bottom-0 z-30"
            )}
            style={{
                width: isMobile ? SIDEBAR_EXPANDED_WIDTH : expanded ? SIDEBAR_EXPANDED_WIDTH : SIDEBAR_RAIL_WIDTH,
                transform: isMobile && !mobileOpen ? "translateX(-100%)" : undefined,
            }}
        >
            <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 py-4">
                <ul className="space-y-1" role="list">
                    {navigation.map(renderItem)}
                </ul>
            </nav>
        </aside>
    );
}
