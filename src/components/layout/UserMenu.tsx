"use client";

import { useRouter } from "next/navigation";
import {
    Check,
    ChevronDown,
    CircleUserRound,
    ExternalLink,
    KeyRound,
    LogOut,
    Monitor,
    Moon,
    Sun,
    SunMoon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuPortal,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

/** Where Microsoft (Entra) accounts manage their password. */
const MICROSOFT_SECURITY_URL = "https://myaccount.microsoft.com/security";

const THEME_OPTIONS = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
] as const;

function getInitials(firstName?: string, lastName?: string, email?: string) {
    const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
    return initials || (email?.[0] ?? "U").toUpperCase();
}

const itemClass = "cursor-pointer gap-2.5 py-2 text-sm [&_svg]:text-muted-foreground";

export function UserMenu() {
    const { theme, setTheme } = useTheme();
    const { user, isLoading, logout } = useAuth();
    const router = useRouter();

    if (isLoading) {
        return (
            <div className="flex items-center gap-2.5 rounded-full border border-border bg-card py-1 pl-1 pr-4">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="hidden sm:block space-y-1.5">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-2.5 w-16" />
                </div>
            </div>
        );
    }

    const fullName = user ? `${user.firstName} ${user.lastName}`.trim() || user.email : "Account";
    const email = user?.email ?? "";
    const initials = getInitials(user?.firstName, user?.lastName, user?.email);

    const handleLogout = async () => {
        await logout();
        router.replace("/login");
    };

    return (
        <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    aria-label="Account menu"
                    className={cn(
                        "group flex items-center gap-2.5 rounded-full border border-border bg-card py-1 pl-1 pr-1 sm:pr-3",
                        "shadow-card transition-colors hover:bg-muted/60",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        "data-[state=open]:border-primary/40 data-[state=open]:ring-2 data-[state=open]:ring-primary/10"
                    )}
                >
                    <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary text-primary-foreground text-[11px] font-semibold">
                            {initials}
                        </AvatarFallback>
                    </Avatar>
                    <span className="hidden sm:flex flex-col items-start text-left leading-tight min-w-0">
                        <span className="text-sm font-semibold text-foreground truncate max-w-[160px]">{fullName}</span>
                        {email && (
                            <span className="text-[11px] text-muted-foreground truncate max-w-[160px]">{email}</span>
                        )}
                    </span>
                    <ChevronDown className="hidden sm:block h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" sideOffset={8} className="w-60 p-1.5">
                {/* Name + email repeated on small screens, where the trigger shows only the avatar */}
                <DropdownMenuLabel className="sm:hidden px-2 py-2 font-normal">
                    <p className="text-sm font-semibold truncate">{fullName}</p>
                    {email && <p className="text-xs text-muted-foreground truncate">{email}</p>}
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="sm:hidden" />

                <DropdownMenuItem className={itemClass} onSelect={() => router.push("/settings?tab=profile")}>
                    <CircleUserRound className="h-4 w-4" />
                    My profile
                </DropdownMenuItem>

                <DropdownMenuSub>
                    <DropdownMenuSubTrigger className={itemClass}>
                        <SunMoon className="h-4 w-4" />
                        Display mode
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                        <DropdownMenuSubContent sideOffset={6} className="w-40 p-1.5">
                            {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                                <DropdownMenuItem
                                    key={value}
                                    className={cn(itemClass, theme === value && "text-primary [&_svg]:text-primary")}
                                    onSelect={() => setTheme(value)}
                                >
                                    <Icon className="h-4 w-4" />
                                    <span className="flex-1">{label}</span>
                                    {theme === value && <Check className="h-3.5 w-3.5" />}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                </DropdownMenuSub>

                {/* Microsoft sign-in: password lives in Microsoft. Email/password accounts have no
                    change-password endpoint yet, so the item is hidden for them. */}
                {user && !user.hasPassword && (
                    <DropdownMenuItem
                        className={itemClass}
                        onSelect={() => window.open(MICROSOFT_SECURITY_URL, "_blank", "noopener,noreferrer")}
                    >
                        <KeyRound className="h-4 w-4" />
                        Change password
                        <ExternalLink className="ml-auto h-3.5 w-3.5" />
                    </DropdownMenuItem>
                )}

                <DropdownMenuSeparator className="my-1.5" />

                <DropdownMenuItem
                    className={cn(itemClass, "text-destructive focus:text-destructive focus:bg-destructive/10 [&_svg]:text-destructive")}
                    onSelect={handleLogout}
                >
                    <LogOut className="h-4 w-4" />
                    Logout
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
