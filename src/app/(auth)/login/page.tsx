"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import { motion } from "framer-motion";
import { Instrument_Serif } from "next/font/google";
import { Loader2, ShieldCheck, Sparkles, MailOpen, Send } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const display = Instrument_Serif({
    weight: "400",
    style: ["normal", "italic"],
    subsets: ["latin"],
    display: "swap",
});

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

// ─── Floating email card used in the hero panel ────────────────────────────
function EmailCard({
    sender,
    initials,
    subject,
    preview,
    time,
    statusIcon: StatusIcon,
    statusText,
    statusColor,
    accent,
}: {
    sender: string;
    initials: string;
    subject: string;
    preview: string;
    time: string;
    statusIcon: typeof Send;
    statusText: string;
    statusColor: string;
    accent: string;
}) {
    return (
        <div className="w-[300px] rounded-2xl bg-white/[0.07] backdrop-blur-xl border border-white/[0.12] p-4 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.5)]">
            <div className="flex items-center gap-2.5 mb-3">
                <div
                    className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold text-white",
                        accent
                    )}
                >
                    {initials}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-white leading-tight truncate">{sender}</p>
                    <p className="text-[10px] text-white/50 leading-tight">{time}</p>
                </div>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 ring-2 ring-emerald-400/20" />
            </div>
            <p className="text-[13px] font-semibold text-white mb-1 truncate">{subject}</p>
            <p className="text-[11px] text-white/60 leading-relaxed line-clamp-2 mb-3">{preview}</p>
            <div className="flex items-center justify-between">
                <span className={cn("inline-flex items-center gap-1 text-[10px] font-medium", statusColor)}>
                    <StatusIcon className="w-3 h-3" />
                    {statusText}
                </span>
                <span className="text-[10px] text-white/40 tabular-nums">98.7%</span>
            </div>
        </div>
    );
}

function LoginContent() {
    const { loginWithMicrosoft, isAuthenticated, isLoading: authLoading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const redirectTo = searchParams?.get("from") || "/";

    // Catches both fresh popup logins AND post-redirect-return logins
    useEffect(() => {
        if (!authLoading && isAuthenticated) {
            router.replace(redirectTo);
        }
    }, [authLoading, isAuthenticated, redirectTo, router]);

    const handleMicrosoftLogin = async () => {
        setError(null);
        setLoading(true);
        try {
            await loginWithMicrosoft();
            router.replace(redirectTo);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Microsoft sign-in failed. Please try again.");
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full grid lg:grid-cols-[1.1fr_1fr] bg-background">
            {/* ═══ LEFT — Hero panel ═══════════════════════════════════════ */}
            <div className="relative hidden lg:flex flex-col overflow-hidden bg-[#070b1f]">
                {/* Layered radial gradients for depth */}
                <div
                    className="absolute inset-0"
                    style={{
                        background:
                            "radial-gradient(120% 80% at 0% 0%, rgba(60,90,255,0.28) 0%, transparent 60%), radial-gradient(80% 60% at 100% 100%, rgba(180,80,255,0.22) 0%, transparent 65%), radial-gradient(70% 70% at 50% 50%, rgba(0,164,239,0.10) 0%, transparent 70%)",
                    }}
                />
                {/* Slow-rotating accent blob */}
                <motion.div
                    aria-hidden="true"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
                    className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full blur-3xl opacity-40 bg-gradient-to-br from-[#5b8def] via-[#7b3fff] to-transparent"
                />
                {/* Subtle grid */}
                <div
                    aria-hidden="true"
                    className="absolute inset-0 opacity-[0.07]"
                    style={{
                        backgroundImage:
                            "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
                        backgroundSize: "44px 44px",
                    }}
                />
                {/* Vignette toward bottom-right */}
                <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-tr from-black/30 via-transparent to-transparent"
                />

                {/* Sendora wordmark — top-left */}
                <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="relative z-10 flex items-center gap-2.5 px-10 pt-9"
                >
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#5b8def] to-[#7b3fff] flex items-center justify-center shadow-lg shadow-blue-500/30">
                        <span className="text-white font-bold">S</span>
                    </div>
                    <span className="text-white text-xl font-heading font-bold tracking-tight">Sendora</span>
                </motion.div>

                {/* Floating email card stack — center */}
                <div className="relative flex-1 flex items-center justify-center px-10">
                    <div className="relative w-[420px] h-[400px]">
                        {/* Card 1 — top left */}
                        <motion.div
                            initial={{ opacity: 0, y: 30, rotate: -10 }}
                            animate={{ opacity: 1, y: 0, rotate: -10 }}
                            transition={{ duration: 0.7, delay: 0.2, ease: [0.25, 0.4, 0.25, 1] }}
                            className="absolute top-0 left-0"
                        >
                            <motion.div
                                animate={{ y: [0, -10, 0] }}
                                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                            >
                                <EmailCard
                                    sender="Alex Mendez"
                                    initials="AM"
                                    subject="Q4 product launch — final"
                                    preview="Attaching the final brief for our Q4 launch. Loop me in if anything looks off…"
                                    time="2:34 PM"
                                    statusIcon={Send}
                                    statusText="Sent · 1.2k recipients"
                                    statusColor="text-blue-300"
                                    accent="bg-gradient-to-br from-blue-500 to-indigo-600"
                                />
                            </motion.div>
                        </motion.div>

                        {/* Card 2 — middle right */}
                        <motion.div
                            initial={{ opacity: 0, y: 30, rotate: 6 }}
                            animate={{ opacity: 1, y: 0, rotate: 6 }}
                            transition={{ duration: 0.7, delay: 0.4, ease: [0.25, 0.4, 0.25, 1] }}
                            className="absolute top-[120px] right-0"
                        >
                            <motion.div
                                animate={{ y: [0, -8, 0] }}
                                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                            >
                                <EmailCard
                                    sender="Riya Shah"
                                    initials="RS"
                                    subject="Re: Welcome aboard 👋"
                                    preview="Thanks so much for the warm welcome! Excited to dig into the new templates next week."
                                    time="Just now"
                                    statusIcon={MailOpen}
                                    statusText="Opened · 4 mins ago"
                                    statusColor="text-emerald-300"
                                    accent="bg-gradient-to-br from-rose-500 to-fuchsia-600"
                                />
                            </motion.div>
                        </motion.div>

                        {/* Card 3 — bottom left */}
                        <motion.div
                            initial={{ opacity: 0, y: 30, rotate: -4 }}
                            animate={{ opacity: 1, y: 0, rotate: -4 }}
                            transition={{ duration: 0.7, delay: 0.6, ease: [0.25, 0.4, 0.25, 1] }}
                            className="absolute bottom-0 left-12"
                        >
                            <motion.div
                                animate={{ y: [0, -6, 0] }}
                                transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                            >
                                <EmailCard
                                    sender="Sendora"
                                    initials="SD"
                                    subject="‘Spring Sale’ campaign was delivered"
                                    preview="98.7% inbox rate across 12,084 recipients. Avg open rate is trending +14% week-over-week."
                                    time="1m ago"
                                    statusIcon={Sparkles}
                                    statusText="Delivered"
                                    statusColor="text-amber-300"
                                    accent="bg-gradient-to-br from-amber-500 to-orange-600"
                                />
                            </motion.div>
                        </motion.div>
                    </div>
                </div>

                {/* Tagline — bottom-left */}
                <div className="relative z-10 px-10 pb-12 max-w-[520px]">
                    <motion.h2
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7, delay: 0.8 }}
                        className={cn(
                            display.className,
                            "text-white text-[56px] xl:text-[68px] leading-[0.98] tracking-[-0.02em]"
                        )}
                    >
                        Mail, with{" "}
                        <span className="italic text-transparent bg-clip-text bg-gradient-to-r from-[#a5c3ff] via-[#cdb1ff] to-[#ffd4a3]">
                            intent.
                        </span>
                    </motion.h2>
                    <motion.p
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 1 }}
                        className="mt-5 text-white/60 text-base max-w-md leading-relaxed"
                    >
                        The email workspace built for teams that care about every send — from the first
                        keystroke to the inbox.
                    </motion.p>

                    {/* Stats row */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.6, delay: 1.2 }}
                        className="mt-8 flex items-center gap-6 text-white/50 text-xs"
                    >
                        <div>
                            <p className="text-white text-2xl font-heading font-semibold tabular-nums">12M+</p>
                            <p>emails delivered</p>
                        </div>
                        <div className="h-8 w-px bg-white/15" />
                        <div>
                            <p className="text-white text-2xl font-heading font-semibold tabular-nums">99.9%</p>
                            <p>inbox rate</p>
                        </div>
                        <div className="h-8 w-px bg-white/15" />
                        <div>
                            <p className="text-white text-2xl font-heading font-semibold tabular-nums">1.2k</p>
                            <p>teams onboard</p>
                        </div>
                    </motion.div>
                </div>
            </div>

            {/* ═══ RIGHT — Sign-in panel ═══════════════════════════════════ */}
            <div className="flex items-center justify-center px-6 py-10 lg:p-12">
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="w-full max-w-sm"
                >
                    {/* Mobile-only logo (desktop has it on the left panel) */}
                    <div className="lg:hidden flex items-center justify-center gap-2 mb-10">
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#5b8def] to-[#7b3fff] flex items-center justify-center">
                            <span className="text-white font-bold">S</span>
                        </div>
                        <span className="text-xl font-heading font-bold tracking-tight">Sendora</span>
                    </div>

                    <div className="mb-8">
                        <h1
                            className={cn(
                                display.className,
                                "text-[40px] leading-tight tracking-tight italic"
                            )}
                        >
                            Welcome back.
                        </h1>
                        <p className="text-body-sm text-muted-foreground mt-2">
                            Sign in with your Microsoft work or school account to continue.
                        </p>
                    </div>

                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mb-4 rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive"
                        >
                            {error}
                        </motion.div>
                    )}

                    <motion.button
                        whileHover={!loading ? { y: -1 } : {}}
                        whileTap={!loading ? { y: 0 } : {}}
                        onClick={handleMicrosoftLogin}
                        disabled={loading}
                        className="group relative w-full flex items-center justify-center gap-3 px-4 py-3.5 rounded-xl bg-foreground text-background hover:bg-foreground/90 active:bg-foreground transition-colors font-medium text-sm disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-foreground/15"
                        aria-label="Sign in with Microsoft"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span>Connecting to Microsoft…</span>
                            </>
                        ) : (
                            <>
                                <span className="flex items-center justify-center w-7 h-7 rounded-md bg-white">
                                    <MicrosoftLogo className="w-[15px] h-[15px]" />
                                </span>
                                <span>Continue with Microsoft</span>
                            </>
                        )}
                    </motion.button>

                    <div className="mt-5 flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-muted/50 border border-border/60 text-xs text-muted-foreground">
                        <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
                        <span>
                            Single sign-on is the only supported sign-in method. Access is managed by your
                            organization through Microsoft Entra ID.
                        </span>
                    </div>

                    <p className="mt-10 text-center text-[11px] text-muted-foreground leading-relaxed">
                        By continuing, you agree to the{" "}
                        <a href="#" className="underline decoration-dotted hover:text-foreground transition-colors">
                            Terms of Service
                        </a>{" "}
                        and acknowledge our{" "}
                        <a href="#" className="underline decoration-dotted hover:text-foreground transition-colors">
                            Privacy Policy
                        </a>
                        .
                    </p>
                </motion.div>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-background" />}>
            <LoginContent />
        </Suspense>
    );
}
