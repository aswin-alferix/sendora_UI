"use client";

import Link from "next/link";
import { Menu, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserMenu } from "./UserMenu";

interface TopBarProps {
    /** ☰ button: toggles the sidebar (rail ↔ expanded on desktop, drawer on mobile). */
    onToggleSidebar: () => void;
}

/**
 * Full-width app bar. Rendered once by AppLayout (root layout), so it stays
 * mounted while the user moves between pages.
 */
export function TopBar({ onToggleSidebar }: TopBarProps) {
    return (
        <header className="fixed inset-x-0 top-0 z-40 h-16 border-b border-border bg-card/95 shadow-[0_1px_3px_0_rgb(0_0_0/0.04)] backdrop-blur-md">
            <div className="flex h-full items-center justify-between gap-4 pl-3 pr-4 md:pr-6">
                <div className="flex min-w-0 items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onToggleSidebar}
                        aria-label="Toggle navigation"
                        className="shrink-0 text-muted-foreground hover:text-foreground [&_svg]:size-5"
                    >
                        <Menu />
                    </Button>
                    <Link href="/" className="flex shrink-0 items-center gap-2.5 rounded-lg focus-ring">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary shadow-sm">
                            <Zap className="h-4 w-4 text-primary-foreground" aria-hidden="true" />
                        </span>
                        <span className="text-[15px] font-semibold tracking-tight text-foreground">Sendora</span>
                    </Link>
                </div>
                <UserMenu />
            </div>
        </header>
    );
}
