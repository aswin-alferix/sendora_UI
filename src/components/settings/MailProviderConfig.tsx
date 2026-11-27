"use client";

import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Mail,
    Send,
    Cloud,
    CheckCircle2,
    AlertCircle,
    Loader2,
    Check,
    KeyRound,
    Lock,
    Globe,
    User as UserIcon,
    Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { apiErrorMessage } from "@/contexts/AuthContext";
import { anyStatus, backend } from "@/lib/axios";

// ─── Types ────────────────────────────────────────────────────────────────

export type ProviderId = "sendgrid" | "resend" | "ses" | "graph";

export interface MailConfigState {
    provider: ProviderId;
    fromName: string;
    fromEmail: string;
    sendgridApiKey: string;
    resendApiKey: string;
    sesAccessKeyId: string;
    sesSecretAccessKey: string;
    sesRegion: string;
}

export const MAIL_CONFIG_STORAGE_KEY = "sendora_mail_config";

const defaultConfig: MailConfigState = {
    provider: "resend",
    fromName: "",
    fromEmail: "",
    sendgridApiKey: "",
    resendApiKey: "",
    sesAccessKeyId: "",
    sesSecretAccessKey: "",
    sesRegion: "us-east-1",
};

// ─── Provider catalog ─────────────────────────────────────────────────────

const providers: Array<{
    id: ProviderId;
    name: string;
    description: string;
    icon: typeof Mail;
    accent: string;
    docsUrl: string;
}> = [
    {
        id: "resend",
        name: "Resend",
        description: "Email for developers",
        icon: Send,
        accent: "bg-zinc-900 dark:bg-zinc-700",
        docsUrl: "https://resend.com/api-keys",
    },
    {
        id: "sendgrid",
        name: "SendGrid",
        description: "Twilio's email API",
        icon: Mail,
        accent: "bg-sky-500",
        docsUrl: "https://app.sendgrid.com/settings/api_keys",
    },
    {
        id: "ses",
        name: "AWS SES",
        description: "Amazon Simple Email Service",
        icon: Cloud,
        accent: "bg-amber-500",
        docsUrl: "https://console.aws.amazon.com/ses",
    },
    {
        id: "graph",
        name: "Microsoft 365",
        description: "Microsoft Graph, server-configured",
        icon: Building2,
        accent: "bg-blue-600",
        docsUrl: "",
    },
];

const SES_REGIONS = [
    { value: "us-east-1", label: "US East (N. Virginia)" },
    { value: "us-east-2", label: "US East (Ohio)" },
    { value: "us-west-2", label: "US West (Oregon)" },
    { value: "eu-west-1", label: "EU (Ireland)" },
    { value: "eu-central-1", label: "EU (Frankfurt)" },
    { value: "ap-south-1", label: "Asia Pacific (Mumbai)" },
    { value: "ap-southeast-1", label: "Asia Pacific (Singapore)" },
    { value: "ap-southeast-2", label: "Asia Pacific (Sydney)" },
    { value: "ap-northeast-1", label: "Asia Pacific (Tokyo)" },
];

// ─── Component ────────────────────────────────────────────────────────────

export function MailProviderConfig() {
    const [config, setConfig] = useState<MailConfigState>(defaultConfig);
    const [hydrated, setHydrated] = useState(false);
    const [testing, setTesting] = useState(false);
    const [saving, setSaving] = useState(false);
    const [testResult, setTestResult] = useState<
        { ok: true } | { ok: false; message: string } | null
    >(null);
    const { toast } = useToast();

    useEffect(() => {
        try {
            const stored = localStorage.getItem(MAIL_CONFIG_STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored) as Partial<MailConfigState>;
                setConfig((prev) => ({ ...prev, ...parsed }));
            }
        } catch {
            /* ignore */
        }
        setHydrated(true);
    }, []);

    const update = <K extends keyof MailConfigState>(key: K, value: MailConfigState[K]) => {
        setConfig((prev) => ({ ...prev, [key]: value }));
        setTestResult(null);
    };

    const activeProvider = useMemo(
        () => providers.find((p) => p.id === config.provider)!,
        [config.provider]
    );

    const validate = (): string | null => {
        if (!config.fromName.trim()) return "Sender name is required.";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.fromEmail)) return "Enter a valid sender email.";
        switch (config.provider) {
            case "sendgrid":
                if (!config.sendgridApiKey.trim()) return "SendGrid API key is required.";
                return null;
            case "resend":
                if (!config.resendApiKey.trim()) return "Resend API key is required.";
                return null;
            case "ses":
                if (!config.sesAccessKeyId.trim()) return "AWS access key ID is required.";
                if (!config.sesSecretAccessKey.trim()) return "AWS secret access key is required.";
                if (!config.sesRegion) return "Select a region.";
                return null;
            case "graph":
                // Credentials live in the API's env (sendors_API/.env)
                return null;
        }
    };

    const handleTest = async () => {
        const error = validate();
        if (error) {
            toast({ title: "Missing details", description: error, variant: "destructive" });
            return;
        }
        setTesting(true);
        setTestResult(null);
        try {
            const res = await backend.post(
                "/api/mail/test",
                {
                    provider: config.provider,
                    apiKey:
                        config.provider === "resend"
                            ? config.resendApiKey
                            : config.provider === "sendgrid"
                              ? config.sendgridApiKey
                              : undefined,
                    awsAccessKeyId: config.sesAccessKeyId,
                    awsSecretAccessKey: config.sesSecretAccessKey,
                    awsRegion: config.sesRegion,
                },
                anyStatus
            );
            const data = res.data;
            if (res.status >= 200 && res.status < 300) {
                setTestResult({ ok: true });
            } else {
                setTestResult({
                    ok: false,
                    message: apiErrorMessage(data, `${activeProvider.name} returned ${res.status}`),
                });
            }
        } catch (err) {
            setTestResult({
                ok: false,
                message: err instanceof Error ? err.message : "Test request failed",
            });
        } finally {
            setTesting(false);
        }
    };

    const handleSave = async () => {
        const error = validate();
        if (error) {
            toast({ title: "Missing details", description: error, variant: "destructive" });
            return;
        }
        setSaving(true);
        await new Promise((r) => setTimeout(r, 400));
        localStorage.setItem(MAIL_CONFIG_STORAGE_KEY, JSON.stringify(config));
        toast({
            title: "Configuration saved",
            description: `${activeProvider.name} is now your active mail provider.`,
            variant: "success",
        });
        setSaving(false);
    };

    if (!hydrated) {
        return <div className="h-96 rounded-xl bg-muted/40 animate-pulse" />;
    }

    return (
        <div className="space-y-7">
            {/* Header */}
            <div>
                <h3 className="text-base font-semibold mb-1">Mail Provider</h3>
                <p className="text-body-sm text-muted-foreground">
                    Choose how Sendora sends outgoing email. Each user can pick their own provider and
                    enter the credentials for their account.
                </p>
            </div>

            {/* Provider picker */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {providers.map((p) => {
                    const Icon = p.icon;
                    const selected = config.provider === p.id;
                    return (
                        <button
                            key={p.id}
                            type="button"
                            onClick={() => update("provider", p.id)}
                            className={cn(
                                "relative text-left rounded-xl border-2 p-4 transition-all hover:border-primary/40",
                                selected
                                    ? "border-primary bg-primary/[0.04] shadow-[0_0_0_4px_rgba(59,130,246,0.06)]"
                                    : "border-border bg-card"
                            )}
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center text-white", p.accent)}>
                                    <Icon className="w-4 h-4" />
                                </div>
                                {selected && (
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
                                    >
                                        <Check className="w-3 h-3" strokeWidth={3} />
                                    </motion.div>
                                )}
                            </div>
                            <p className="text-sm font-semibold">{p.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                                {p.description}
                            </p>
                        </button>
                    );
                })}
            </div>

            {/* Provider-specific config */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={config.provider}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-5"
                >
                    {/* Sender identity (common) */}
                    <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                            Sender identity
                        </p>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="fromName">Sender Name</Label>
                                <Input
                                    id="fromName"
                                    placeholder="Alex Johnson"
                                    value={config.fromName}
                                    onChange={(e) => update("fromName", e.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="fromEmail">Sender Email</Label>
                                <Input
                                    id="fromEmail"
                                    type="email"
                                    placeholder="alex@yourcompany.com"
                                    value={config.fromEmail}
                                    onChange={(e) => update("fromEmail", e.target.value)}
                                />
                            </div>
                        </div>
                        {config.provider === "resend" && (
                            <p className="text-[11px] text-muted-foreground mt-2">
                                Tip: Resend requires a verified domain. Use{" "}
                                <span className="font-mono">onboarding@resend.dev</span> while testing.
                            </p>
                        )}
                        {config.provider === "graph" && (
                            <p className="text-[11px] text-muted-foreground mt-2">
                                Mail is always sent from the server&apos;s{" "}
                                <span className="font-mono">MAIL_SENDER_ADDRESS</span> mailbox; the sender
                                name is used as the display name.
                            </p>
                        )}
                    </div>

                    {/* Credentials */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                {activeProvider.name} credentials
                            </p>
                            {activeProvider.docsUrl && (
                                <a
                                    href={activeProvider.docsUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-primary hover:underline"
                                >
                                    Get an API key →
                                </a>
                            )}
                        </div>

                        {config.provider === "resend" && (
                            <FieldRow label="API Key" icon={KeyRound} hint="Starts with re_">
                                <Input
                                    type="password"
                                    placeholder="re_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                                    value={config.resendApiKey}
                                    onChange={(e) => update("resendApiKey", e.target.value)}
                                    autoComplete="off"
                                />
                            </FieldRow>
                        )}

                        {config.provider === "sendgrid" && (
                            <FieldRow label="API Key" icon={KeyRound} hint="Starts with SG.">
                                <Input
                                    type="password"
                                    placeholder="SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                                    value={config.sendgridApiKey}
                                    onChange={(e) => update("sendgridApiKey", e.target.value)}
                                    autoComplete="off"
                                />
                            </FieldRow>
                        )}

                        {config.provider === "ses" && (
                            <div className="space-y-4">
                                <FieldRow label="Access Key ID" icon={UserIcon}>
                                    <Input
                                        placeholder="AKIAIOSFODNN7EXAMPLE"
                                        value={config.sesAccessKeyId}
                                        onChange={(e) => update("sesAccessKeyId", e.target.value)}
                                        autoComplete="off"
                                    />
                                </FieldRow>
                                <FieldRow label="Secret Access Key" icon={Lock}>
                                    <Input
                                        type="password"
                                        placeholder="••••••••••••••••••••••••••••••••"
                                        value={config.sesSecretAccessKey}
                                        onChange={(e) => update("sesSecretAccessKey", e.target.value)}
                                        autoComplete="off"
                                    />
                                </FieldRow>
                                <FieldRow label="Region" icon={Globe}>
                                    <Select
                                        value={config.sesRegion}
                                        onValueChange={(v) => update("sesRegion", v)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {SES_REGIONS.map((r) => (
                                                <SelectItem key={r.value} value={r.value}>
                                                    <span className="font-mono text-xs mr-2">{r.value}</span>
                                                    <span className="text-muted-foreground">{r.label}</span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </FieldRow>
                            </div>
                        )}

                        {config.provider === "graph" && (
                            <div className="rounded-md border border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground space-y-1.5">
                                <p>
                                    Credentials are read from the API&apos;s{" "}
                                    <span className="font-mono">sendors_API/.env</span>, never stored in the browser:
                                </p>
                                <p className="font-mono leading-relaxed">
                                    AZURE_AD_TENANT_ID, MAIL_APP_CLIENT_ID, AZURE_AD_CLIENT_SECRET,
                                    MAIL_SENDER_ADDRESS
                                </p>
                                <p>
                                    The app needs the Microsoft Graph application permission{" "}
                                    <span className="font-mono">Mail.Send</span> with admin consent. Use Test
                                    Connection to check them.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Test result banner */}
                    {testResult && (
                        <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={cn(
                                "flex items-center gap-2 px-4 py-3 rounded-md text-sm",
                                testResult.ok
                                    ? "bg-success/10 text-success border border-success/20"
                                    : "bg-destructive/10 text-destructive border border-destructive/20"
                            )}
                        >
                            {testResult.ok ? (
                                <CheckCircle2 className="h-4 w-4" />
                            ) : (
                                <AlertCircle className="h-4 w-4" />
                            )}
                            {testResult.ok
                                ? `${activeProvider.name} credentials look good.`
                                : testResult.message}
                        </motion.div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                        <Button type="button" variant="outline" onClick={handleTest} disabled={testing || saving}>
                            {testing ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Testing…
                                </>
                            ) : (
                                <>Test Connection</>
                            )}
                        </Button>
                        <Button type="button" onClick={handleSave} disabled={saving || testing}>
                            {saving ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Saving…
                                </>
                            ) : (
                                <>Save Configuration</>
                            )}
                        </Button>
                    </div>
                </motion.div>
            </AnimatePresence>
        </div>
    );
}

// ─── Local helper ──────────────────────────────────────────────────────────

function FieldRow({
    label,
    icon: Icon,
    hint,
    children,
}: {
    label: string;
    icon?: typeof Mail;
    hint?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5">
                    {Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground" />}
                    {label}
                </Label>
                {hint && <span className="text-[11px] text-muted-foreground font-mono">{hint}</span>}
            </div>
            {children}
        </div>
    );
}
