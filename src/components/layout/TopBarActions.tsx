"use client";

import { useRouter } from "next/navigation";
import { Sun, Moon, Monitor, Check, Settings as SettingsIcon, LogOut } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";

function getInitials(firstName?: string, lastName?: string, email?: string) {
    const f = firstName?.[0]?.toUpperCase() ?? "";
    const l = lastName?.[0]?.toUpperCase() ?? "";
    const initials = `${f}${l}`.trim();
    if (initials) return initials;
    return (email?.[0] ?? "U").toUpperCase();
}

export function TopBarActions() {
    const { theme, setTheme } = useTheme();
    const { user, logout } = useAuth();
    const router = useRouter();

    const fullName =
        user && (user.firstName || user.lastName)
            ? `${user.firstName} ${user.lastName}`.trim()
            : "Microsoft User";
    const email = user?.email ?? "";
    const initials = getInitials(user?.firstName, user?.lastName, user?.email);

    const handleSignOut = async () => {
        await logout();
        router.replace("/login");
    };

    return (
        <div className="inline-flex items-center rounded-full border border-border bg-card p-0.5 shadow-card">
            {/* User avatar → menu */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button
                        className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-opacity hover:opacity-90"
                        aria-label="Account menu"
                    >
                        <Avatar className="h-8 w-8 ring-1 ring-border">
                            <AvatarFallback className="text-[11px] font-semibold bg-primary/10 text-primary">
                                {initials}
                            </AvatarFallback>
                        </Avatar>
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={10} className="w-64">
                    <DropdownMenuLabel className="px-2 py-2.5 font-normal">
                        <div className="flex items-start gap-3">
                            <Avatar className="h-9 w-9 ring-1 ring-border">
                                <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                                    {initials}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold truncate">{fullName}</p>
                                {email && (
                                    <p className="text-xs text-muted-foreground truncate">{email}</p>
                                )}
                            </div>
                        </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => router.push("/settings")} className="cursor-pointer gap-2">
                        <SettingsIcon className="w-4 h-4" />
                        Settings
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        onClick={handleSignOut}
                        className="cursor-pointer gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                    >
                        <LogOut className="w-4 h-4" />
                        Sign out
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Hairline divider */}
            <span className="w-px h-5 bg-border mx-0.5" aria-hidden="true" />

            {/* Theme toggle */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        className="relative h-8 w-8 rounded-full hover:bg-muted"
                        aria-label="Toggle theme"
                    >
                        <Sun className="w-[17px] h-[17px] rotate-0 scale-100 transition-transform duration-300 dark:-rotate-90 dark:scale-0" />
                        <Moon className="absolute w-[17px] h-[17px] rotate-90 scale-0 transition-transform duration-300 dark:rotate-0 dark:scale-100" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={10} className="w-40">
                    <DropdownMenuItem onClick={() => setTheme("light")} className="gap-2 cursor-pointer">
                        <Sun className="w-4 h-4" />
                        <span className="flex-1">Light</span>
                        {theme === "light" && <Check className="w-3.5 h-3.5 text-primary" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTheme("dark")} className="gap-2 cursor-pointer">
                        <Moon className="w-4 h-4" />
                        <span className="flex-1">Dark</span>
                        {theme === "dark" && <Check className="w-3.5 h-3.5 text-primary" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTheme("system")} className="gap-2 cursor-pointer">
                        <Monitor className="w-4 h-4" />
                        <span className="flex-1">System</span>
                        {theme === "system" && <Check className="w-3.5 h-3.5 text-primary" />}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
