"use client";

import { motion } from "framer-motion";
import {
    User,
    Palette,
    Mailbox,
    Sun,
    Moon,
    Monitor,
    Building2,
    Mail,
    UserCircle,
    LogOut,
    ExternalLink,
    ShieldCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SignatureManager } from "@/components/settings/SignatureManager";
import { MailProviderConfig } from "@/components/settings/MailProviderConfig";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

// ─── Microsoft logo ──────────────────────────────────────────────────────────

function MicrosoftLogo({ className = "" }: { className?: string }) {
    return (
        <svg
            className={className}
            width="20"
            height="20"
            viewBox="0 0 23 23"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
        >
            <rect x="0" y="0" width="10" height="10" fill="#F25022" />
            <rect x="13" y="0" width="10" height="10" fill="#7FBA00" />
            <rect x="0" y="13" width="10" height="10" fill="#00A4EF" />
            <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
        </svg>
    );
}

// ─── Read-only profile field ─────────────────────────────────────────────────

function ProfileField({
    label,
    value,
    icon: Icon,
}: {
    label: string;
    value: string;
    icon: typeof Mail;
}) {
    return (
        <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</Label>
            <div className="flex items-center gap-2.5 h-10 px-3 rounded-md bg-muted/40 border border-border text-sm">
                <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="truncate">{value || "—"}</span>
            </div>
        </div>
    );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
    const { theme, setTheme } = useTheme();
    const { user, logout } = useAuth();
    const router = useRouter();

    const fullName = user ? `${user.firstName} ${user.lastName}`.trim() || "Microsoft User" : "—";
    const email = user?.email ?? "—";
    const company = user?.company ?? "—";

    const handleSignOut = async () => {
        await logout();
        router.replace("/login");
    };

    return (
        <div className="p-4 md:p-8 max-w-4xl mx-auto">
            <PageHeader title="Settings" description="Manage your account and preferences" />

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Tabs defaultValue="profile" className="space-y-6">
                    <TabsList className="grid w-full grid-cols-4 bg-muted/50 p-1 rounded-lg">
                        <TabsTrigger value="profile" className="gap-2">
                            <User className="w-4 h-4" />
                            <span className="hidden sm:inline">Profile</span>
                        </TabsTrigger>
                        <TabsTrigger value="account" className="gap-2">
                            <ShieldCheck className="w-4 h-4" />
                            <span className="hidden sm:inline">Account</span>
                        </TabsTrigger>
                        <TabsTrigger value="mail" className="gap-2">
                            <Mailbox className="w-4 h-4" />
                            <span className="hidden sm:inline">Mail</span>
                        </TabsTrigger>
                        <TabsTrigger value="appearance" className="gap-2">
                            <Palette className="w-4 h-4" />
                            <span className="hidden sm:inline">Appearance</span>
                        </TabsTrigger>
                    </TabsList>

                    {/* ── Profile (read-only from Microsoft) ─────────────── */}
                    <TabsContent value="profile" className="space-y-6">
                        <div className="bg-card rounded-xl border border-border shadow-card p-6 space-y-6">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <h3 className="text-heading-4 font-heading mb-1">Profile</h3>
                                    <p className="text-body-sm text-muted-foreground">
                                        Synced from your Microsoft account.
                                    </p>
                                </div>
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-muted/40 text-xs font-medium">
                                    <MicrosoftLogo className="w-3.5 h-3.5" />
                                    Microsoft Entra
                                </span>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <ProfileField label="Full name" value={fullName} icon={UserCircle} />
                                <ProfileField label="Email" value={email} icon={Mail} />
                                <div className="sm:col-span-2">
                                    <ProfileField label="Company" value={company} icon={Building2} />
                                </div>
                            </div>

                            <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-md bg-muted/40 text-xs text-muted-foreground">
                                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
                                <span>
                                    To update name, email, or company, edit your profile at{" "}
                                    <a
                                        href="https://myaccount.microsoft.com"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="underline hover:text-foreground"
                                    >
                                        myaccount.microsoft.com
                                    </a>
                                    . Changes sync automatically on next sign-in.
                                </span>
                            </div>
                        </div>

                        {/* Multi-signature manager */}
                        <div className="bg-card rounded-xl border border-border shadow-card p-6">
                            <SignatureManager />
                        </div>
                    </TabsContent>

                    {/* ── Account (replaces Security) ────────────────────── */}
                    <TabsContent value="account">
                        <div className="bg-card rounded-xl border border-border shadow-card p-6 space-y-6">
                            <div>
                                <h3 className="text-heading-4 font-heading mb-1">Connected Account</h3>
                                <p className="text-body-sm text-muted-foreground">
                                    You&apos;re signed in with Microsoft Entra single sign-on.
                                </p>
                            </div>

                            {/* Connection card */}
                            <div className="rounded-lg border border-border p-4 flex items-center gap-4">
                                <div className="w-11 h-11 rounded-lg bg-white border border-border flex items-center justify-center flex-shrink-0">
                                    <MicrosoftLogo />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold">Microsoft</p>
                                    <p className="text-xs text-muted-foreground truncate">{email}</p>
                                </div>
                                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-success/10 text-success text-[11px] font-semibold">
                                    <span className="w-1.5 h-1.5 rounded-full bg-success" />
                                    Connected
                                </span>
                            </div>

                            {/* Info note: where security is actually managed */}
                            <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-primary/[0.04] border border-primary/15">
                                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
                                <div className="text-xs text-foreground/80 leading-relaxed">
                                    Sign-in security — including password, multi-factor authentication, and session
                                    management — is handled by your organization through Microsoft Entra ID. Use the
                                    Microsoft account portal to update these settings.
                                </div>
                            </div>

                            {/* Outbound link */}
                            <a
                                href="https://myaccount.microsoft.com/security"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 text-sm text-primary hover:underline font-medium"
                            >
                                Manage Microsoft account security
                                <ExternalLink className="w-3.5 h-3.5" />
                            </a>

                            {/* Sign out */}
                            <div className="border-t border-border pt-6 flex items-center justify-between gap-4 flex-wrap">
                                <div>
                                    <p className="text-sm font-medium">Sign out of Sendora</p>
                                    <p className="text-xs text-muted-foreground">
                                        You&apos;ll need to sign in with Microsoft again to return.
                                    </p>
                                </div>
                                <Button variant="outline" onClick={handleSignOut} className="text-destructive hover:text-destructive">
                                    <LogOut className="w-4 h-4" />
                                    Sign out
                                </Button>
                            </div>
                        </div>
                    </TabsContent>

                    {/* ── Mail Provider ──────────────────────────────────── */}
                    <TabsContent value="mail">
                        <div className="bg-card rounded-xl border border-border shadow-card p-6">
                            <MailProviderConfig />
                        </div>
                    </TabsContent>

                    {/* ── Appearance ─────────────────────────────────────── */}
                    <TabsContent value="appearance">
                        <div className="bg-card rounded-xl border border-border shadow-card p-6 space-y-6">
                            <div>
                                <h3 className="text-heading-4 font-heading mb-1">Appearance</h3>
                                <p className="text-body-sm text-muted-foreground">Customize how Sendora looks for you.</p>
                            </div>

                            <div className="space-y-3">
                                <Label className="font-medium">Theme</Label>
                                <div className="grid grid-cols-3 gap-3">
                                    {([
                                        { value: "light", label: "Light", icon: Sun },
                                        { value: "dark", label: "Dark", icon: Moon },
                                        { value: "system", label: "System", icon: Monitor },
                                    ] as const).map(({ value, label, icon: Icon }) => (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => setTheme(value)}
                                            className={cn(
                                                "flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all hover:border-primary/50",
                                                theme === value
                                                    ? "border-primary bg-accent text-accent-foreground"
                                                    : "border-border bg-background text-muted-foreground"
                                            )}
                                        >
                                            <Icon className="h-5 w-5" />
                                            <span className="text-xs font-medium">{label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-4 pt-2 border-t border-border">
                                <div className="flex items-center justify-between py-3 border-b border-border">
                                    <div>
                                        <Label className="font-medium">Compact Mode</Label>
                                        <p className="text-body-sm text-muted-foreground">Show more content with smaller spacing</p>
                                    </div>
                                    <Switch />
                                </div>
                                <div className="flex items-center justify-between py-3">
                                    <div>
                                        <Label className="font-medium">Reduce Animations</Label>
                                        <p className="text-body-sm text-muted-foreground">Minimize motion for accessibility</p>
                                    </div>
                                    <Switch />
                                </div>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </motion.div>
        </div>
    );
}
