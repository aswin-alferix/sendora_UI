"use client";

import { motion } from "framer-motion";
import {
    User,
    Mailbox,
    Building2,
    Mail,
    UserCircle,
    ShieldCheck,
    Settings,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shared/PageHeader";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SignatureManager } from "@/components/settings/SignatureManager";
import { MailProviderConfig } from "@/components/settings/MailProviderConfig";
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

const SETTINGS_TABS = ["profile", "mail"];

// ─── Component ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
    const { user } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();

    // ?tab=… lets other parts of the app (e.g. the account menu) open a specific tab.
    const requestedTab = searchParams.get("tab");
    const activeTab = requestedTab && SETTINGS_TABS.includes(requestedTab) ? requestedTab : "profile";
    const handleTabChange = (value: string) => {
        router.replace(`/settings?tab=${value}`, { scroll: false });
    };

    const fullName = user ? `${user.firstName} ${user.lastName}`.trim() || "Microsoft User" : "—";
    const email = user?.email ?? "—";
    const company = user?.company ?? "—";

    return (
        <div className="px-4 py-6 md:px-8">
            <PageHeader icon={Settings} title="Settings" description="Manage your account and preferences" />

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
                    <TabsList className="grid w-full max-w-md grid-cols-2 bg-muted/50 p-1 rounded-lg">
                        <TabsTrigger value="profile" className="gap-2">
                            <User className="w-4 h-4" />
                            <span className="hidden sm:inline">Profile</span>
                        </TabsTrigger>
                        <TabsTrigger value="mail" className="gap-2">
                            <Mailbox className="w-4 h-4" />
                            <span className="hidden sm:inline">Mail</span>
                        </TabsTrigger>
                    </TabsList>

                    {/* ── Profile (read-only from Microsoft) ─────────────── */}
                    <TabsContent value="profile" className="space-y-6">
                        <div className="bg-card rounded-2xl border border-border shadow-card p-5 space-y-6">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <h3 className="text-base font-semibold mb-1">Profile</h3>
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
                        <div className="bg-card rounded-2xl border border-border shadow-card p-5">
                            <SignatureManager />
                        </div>
                    </TabsContent>


                    {/* ── Mail Provider ──────────────────────────────────── */}
                    <TabsContent value="mail">
                        <div className="bg-card rounded-2xl border border-border shadow-card p-5">
                            <MailProviderConfig />
                        </div>
                    </TabsContent>

                </Tabs>
            </motion.div>
        </div>
    );
}
