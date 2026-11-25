"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import { motion } from "framer-motion";
import { Instrument_Serif } from "next/font/google";
import { Loader2, ShieldCheck, Sparkles, MailOpen, Send } from "lucide-react";
import { hasMsalResponse, useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

// Codes the API's Microsoft flow redirects back with (?ms_error=…)
const MS_ERRORS: Record<string, string> = {
    not_configured:
        "Microsoft sign-in isn't set up on the server yet. Use your email and password, or ask an admin to configure it.",
    account_exists:
        "An account with this email already exists. Sign in with your password, then connect Microsoft from Settings.",
    already_linked: "That Microsoft account is already linked to another Sendora account.",
    access_denied: "Microsoft sign-in was cancelled.",
    invalid_state: "The sign-in took too long or was opened in another tab. Please try again.",
    missing_email: "Your Microsoft account didn't share an email address, so it can't be used to sign in.",
};

/** Only same-site paths, so ?from= can't send people to another site. */
function safeRedirect(from: string | null | undefined): string {
    return from && from.startsWith("/") && !from.startsWith("//") ? from : "/";
}

function LoginContent() {
    const {
        loginWithMicrosoft,
        completeMicrosoftSignIn,
        loginWithPassword,
        register,
        isAuthenticated,
        isLoading: authLoading,
    } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [loading, setLoading] = useState(false);
    const [formLoading, setFormLoading] = useState(false);
    const msError = searchParams?.get("ms_error");
    const [error, setError] = useState<string | null>(
        msError ? MS_ERRORS[msError] ?? "Microsoft sign-in failed. Please try again." : null
    );
    const [mode, setMode] = useState<"signin" | "signup">("signin");
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const redirectTo = safeRedirect(searchParams?.get("from"));

    // Already signed in (or just returned from Microsoft) → go on
    useEffect(() => {
        if (!authLoading && isAuthenticated) {
            router.replace(redirectTo);
        }
    }, [authLoading, isAuthenticated, redirectTo, router]);

    // Back from Microsoft (#code=…): finish sign-in through the API.
    useEffect(() => {
        if (!hasMsalResponse()) return;
        let cancelled = false;
        const finish = async () => {
            setLoading(true);
            try {
                const next = await completeMicrosoftSignIn();
                if (!cancelled && next) router.replace(safeRedirect(next));
                else if (!cancelled) setLoading(false);
            } catch (err) {
                if (cancelled) return;
                setError(err instanceof Error ? err.message : "Microsoft sign-in failed. Please try again.");
                setLoading(false);
                window.history.replaceState(null, "", window.location.pathname + window.location.search);
            }
        };
        void finish();
        return () => {
            cancelled = true;
        };
    }, [completeMicrosoftSignIn, router]);

    const handleMicrosoftLogin = async () => {
        setError(null);
        setLoading(true);
        try {
            await loginWithMicrosoft(redirectTo); // full-page redirect to Microsoft
        } catch (err) {
            setError(err instanceof Error ? err.message : "Microsoft sign-in failed. Please try again.");
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setFormLoading(true);
        try {
            if (mode === "signup") await register(name.trim(), email.trim(), password);
            else await loginWithPassword(email.trim(), password);
            router.replace(redirectTo);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Sign-in failed. Please try again.");
            setFormLoading(false);
        }
    };

    const busy = loading || formLoading;

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
                            {mode === "signup"
                                ? "Create your Sendora account to continue."
                                : "Sign in with Microsoft or your email to continue."}
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
                        disabled={busy}
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

                    <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-wider text-muted-foreground">
                        <span className="h-px flex-1 bg-border" />
                        or
                        <span className="h-px flex-1 bg-border" />
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-3" noValidate>
                        {mode === "signup" && (
                            <div className="space-y-1.5">
                                <Label htmlFor="name">Full name</Label>
                                <Input
                                    id="name"
                                    autoComplete="name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    disabled={busy}
                                    required
                                />
                            </div>
                        )}
                        <div className="space-y-1.5">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                autoComplete="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={busy}
                                required
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={busy}
                                required
                            />
                            {mode === "signup" && (
                                <p className="text-[11px] text-muted-foreground">At least 8 characters.</p>
                            )}
                        </div>
                        <Button
                            type="submit"
                            variant="outline"
                            className="w-full"
                            disabled={busy || !email || !password || (mode === "signup" && !name.trim())}
                        >
                            {formLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                            {mode === "signup" ? "Create account" : "Sign in with email"}
                        </Button>
                    </form>

                    <p className="mt-4 text-center text-xs text-muted-foreground">
                        {mode === "signup" ? "Already have an account?" : "New to Sendora?"}{" "}
                        <button
                            type="button"
                            className="text-primary hover:underline font-medium"
                            disabled={busy}
                            onClick={() => {
                                setMode(mode === "signup" ? "signin" : "signup");
                                setError(null);
                            }}
                        >
                            {mode === "signup" ? "Sign in" : "Create an account"}
                        </button>
                    </p>

                    <div className="mt-5 flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-muted/50 border border-border/60 text-xs text-muted-foreground">
                        <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
                        <span>
                            Your session is kept in secure, httpOnly cookies. Microsoft sign-in uses your
                            organization&apos;s Microsoft Entra ID.
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
