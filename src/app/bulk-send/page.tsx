"use client";

import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
    FileText,
    Building2,
    Tags,
    Search,
    X,
    Send,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Square,
    RotateCcw,
    Briefcase,
    Mails,
    Check,
    ChevronLeft,
    ChevronRight,
    Paperclip,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { MAIL_CONFIG_STORAGE_KEY, type MailConfigState } from "@/components/settings/MailProviderConfig";
import { apiErrorMessage } from "@/contexts/AuthContext";
import {
    AUTO_PLACEHOLDER_KEYS,
    extractPlaceholders,
    buildPersonalizationContext,
    substitute,
    appendSignatureIfMissing,
} from "@/lib/mail/substitute";
import { formatBytes, type UploadedFile } from "@/lib/files";
import { anyStatus, backend } from "@/lib/axios";

// ─── Types ────────────────────────────────────────────────────────────────

interface ContactItem {
    id: string;
    name: string;
    email: string;
    company: string;
    role: string;
    groups: string[];
}

interface TemplateItem {
    id: string;
    name: string;
    subject: string;
    description: string;
    body: string;
    attachments: UploadedFile[];
}

interface Recipient {
    email: string;
    name: string;
    company: string;
}

type StepId = "template" | "audience" | "personalise" | "review";

interface SendResult {
    email: string;
    ok: boolean;
    error?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Recipients per /api/send request — keeps each request short and lets us show progress. */
const CHUNK_SIZE = 10;
const RECIPIENT_PREVIEW_LIMIT = 40;

const PROVIDER_NAMES: Record<string, string> = {
    resend: "Resend",
    sendgrid: "SendGrid",
    ses: "AWS SES",
    graph: "Microsoft 365",
};

// Wrap leftover [Anything] in chip spans so unfilled placeholders stand out in the preview
function highlightPlaceholders(html: string): string {
    if (!html) return "";
    return html
        .split(/(<[^>]+>)/)
        .map((part) =>
            part.startsWith("<")
                ? part
                : part.replace(
                    /\[([^\]\n<>]{1,80})\]/g,
                    (match) => `<span class="sd-placeholder-chip">${match}</span>`
                )
        )
        .join("");
}

function toggleInSet<T>(set: Set<T>, value: T): Set<T> {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
}

// ─── Page ─────────────────────────────────────────────────────────────────

function BulkSendContent() {
    const searchParams = useSearchParams();
    const { toast } = useToast();

    // Data
    const [templates, setTemplates] = useState<TemplateItem[]>([]);
    const [contacts, setContacts] = useState<ContactItem[]>([]);
    const [signatureHtml, setSignatureHtml] = useState("");
    // Read once on the client; the page shows a skeleton until data loads, so SSR output matches.
    const [mailConfig] = useState<MailConfigState | null>(() => {
        if (typeof window === "undefined") return null;
        try {
            const stored = localStorage.getItem(MAIL_CONFIG_STORAGE_KEY);
            return stored ? (JSON.parse(stored) as MailConfigState) : null;
        } catch {
            return null;
        }
    });
    const [loading, setLoading] = useState(true);

    // Which step is open (a template passed in the URL starts on the audience step)
    const [step, setStep] = useState<StepId>(() => (searchParams?.get("template") ? "audience" : "template"));
    const [audienceTab, setAudienceTab] = useState<"filters" | "people" | "addresses">("filters");

    // Step 1 — template
    const [templateId, setTemplateId] = useState<string>(searchParams?.get("template") ?? "");
    const [templateSearch, setTemplateSearch] = useState("");

    // Step 2 — audience
    const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set());
    const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
    const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
    const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
    const [extraEmails, setExtraEmails] = useState("");
    const [excluded, setExcluded] = useState<Set<string>>(new Set());
    const [contactSearch, setContactSearch] = useState("");
    const [showAllRecipients, setShowAllRecipients] = useState(false);

    // Step 3 — custom placeholders
    const [customVariables, setCustomVariables] = useState<Record<string, string>>({});

    // Step 4 — preview
    const [previewEmail, setPreviewEmail] = useState<string>("");

    // Step 5 — send
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [sending, setSending] = useState(false);
    const [results, setResults] = useState<SendResult[]>([]);
    const [total, setTotal] = useState(0);
    const [stoppedReason, setStoppedReason] = useState<string | null>(null);
    const cancelRef = useRef(false);

    // ── Load templates, contacts, default signature, mail config ─────────
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const [tRes, cRes, sRes] = await Promise.all([
                    backend.get("/api/templates"),
                    backend.get("/api/contacts"),
                    backend.get("/api/signatures"),
                ]);
                const [tData, cData, sData] = [tRes.data ?? {}, cRes.data ?? {}, sRes.data ?? {}];
                if (cancelled) return;
                setTemplates(
                    (tData.items ?? []).map((t: TemplateItem) => ({
                        id: t.id,
                        name: t.name,
                        subject: t.subject,
                        description: t.description ?? "",
                        body: t.body ?? "",
                        attachments: t.attachments ?? [],
                    }))
                );
                setContacts(
                    (cData.items ?? []).map((c: ContactItem) => ({
                        id: c.id,
                        name: c.name,
                        email: c.email,
                        company: c.company ?? "",
                        role: c.role ?? "",
                        groups: c.groups ?? [],
                    }))
                );
                const def = (sData.items ?? []).find((s: { isDefault?: boolean }) => s.isDefault);
                setSignatureHtml(def?.content ?? "");
            } catch (err) {
                console.error("Failed to load bulk send data", err);
                toast({
                    title: "Couldn't load your data",
                    description: "Check that the server and database are running.",
                    variant: "destructive",
                });
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [toast]);

    // ── Derived: audience ─────────────────────────────────────────────────
    const contactsByEmail = useMemo(() => {
        const map = new Map<string, { name: string; role: string; company: string; email: string }>();
        contacts.forEach((c) =>
            map.set(c.email.toLowerCase(), { name: c.name, role: c.role, company: c.company, email: c.email })
        );
        return map;
    }, [contacts]);

    // Organisations × Roles narrow each other: "Contractor" alone = every contractor,
    // "Contractor" + "Acme" = only Acme's contractors. Counts reflect the other filter.
    const companies = useMemo(() => {
        const counts = new Map<string, number>();
        contacts.forEach((c) => {
            const key = c.company.trim();
            if (!key) return;
            const roleOk = selectedRoles.size === 0 || selectedRoles.has(c.role.trim());
            counts.set(key, (counts.get(key) ?? 0) + (roleOk ? 1 : 0));
        });
        return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    }, [contacts, selectedRoles]);

    const roles = useMemo(() => {
        const counts = new Map<string, number>();
        contacts.forEach((c) => {
            const key = c.role.trim();
            if (!key) return;
            const companyOk = selectedCompanies.size === 0 || selectedCompanies.has(c.company.trim());
            counts.set(key, (counts.get(key) ?? 0) + (companyOk ? 1 : 0));
        });
        return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    }, [contacts, selectedCompanies]);

    const groups = useMemo(() => {
        const counts = new Map<string, number>();
        contacts.forEach((c) => c.groups.forEach((g) => counts.set(g, (counts.get(g) ?? 0) + 1)));
        return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    }, [contacts]);

    const filteredTemplates = useMemo(() => {
        const q = templateSearch.trim().toLowerCase();
        if (!q) return templates;
        return templates.filter(
            (t) =>
                t.name.toLowerCase().includes(q) ||
                t.subject.toLowerCase().includes(q) ||
                t.description.toLowerCase().includes(q)
        );
    }, [templates, templateSearch]);

    const filteredContacts = useMemo(() => {
        const q = contactSearch.trim().toLowerCase();
        if (!q) return contacts;
        return contacts.filter(
            (c) =>
                c.name.toLowerCase().includes(q) ||
                c.email.toLowerCase().includes(q) ||
                c.company.toLowerCase().includes(q)
        );
    }, [contacts, contactSearch]);

    const { invalidExtras, allRecipients } = useMemo(() => {
        const byEmail = new Map<string, Recipient>();
        const add = (email: string, name: string, company: string) => {
            const key = email.trim().toLowerCase();
            if (!key || byEmail.has(key)) return;
            byEmail.set(key, { email: email.trim(), name, company });
        };

        const filterActive = selectedCompanies.size > 0 || selectedRoles.size > 0;
        contacts.forEach((c) => {
            const matchesFilter =
                filterActive &&
                (selectedCompanies.size === 0 || selectedCompanies.has(c.company.trim())) &&
                (selectedRoles.size === 0 || selectedRoles.has(c.role.trim()));
            const picked =
                matchesFilter ||
                selectedContactIds.has(c.id) ||
                c.groups.some((g) => selectedGroups.has(g));
            if (picked) add(c.email, c.name, c.company);
        });

        const invalid: string[] = [];
        extraEmails
            .split(/[\s,;]+/)
            .map((s) => s.trim())
            .filter(Boolean)
            .forEach((e) => {
                if (!EMAIL_RE.test(e)) {
                    invalid.push(e);
                    return;
                }
                const known = contactsByEmail.get(e.toLowerCase());
                add(e, known?.name ?? "", known?.company ?? "");
            });

        return { invalidExtras: invalid, allRecipients: [...byEmail.values()] };
    }, [contacts, contactsByEmail, selectedCompanies, selectedRoles, selectedGroups, selectedContactIds, extraEmails]);

    // Plain-English description of the organisation × role filter, e.g. "Contractor at Acme Corp"
    const filterSummary = useMemo(() => {
        if (selectedCompanies.size === 0 && selectedRoles.size === 0) return "";
        const join = (s: Set<string>) => [...s].join(" or ");
        const who = selectedRoles.size ? join(selectedRoles) : "Everyone";
        const where = selectedCompanies.size ? ` at ${join(selectedCompanies)}` : " in every organisation";
        return `${who}${where}`;
    }, [selectedCompanies, selectedRoles]);

    const recipients = useMemo(
        () => allRecipients.filter((r) => !excluded.has(r.email.toLowerCase())),
        [allRecipients, excluded]
    );
    const orgCount = useMemo(
        () => new Set(recipients.map((r) => r.company.trim()).filter(Boolean)).size,
        [recipients]
    );

    // ── Derived: template + placeholders ──────────────────────────────────
    const template = templates.find((t) => t.id === templateId) ?? null;

    const customPlaceholders = useMemo(() => {
        if (!template) return [];
        return extractPlaceholders(`${template.subject} ${template.body}`).filter(
            (key) => !AUTO_PLACEHOLDER_KEYS.has(key)
        );
    }, [template]);

    const filledCustom = useMemo(() => {
        const out: Record<string, string> = {};
        for (const key of customPlaceholders) {
            const v = customVariables[key]?.trim();
            if (v) out[key] = v;
        }
        return out;
    }, [customPlaceholders, customVariables]);

    const missingCustom = customPlaceholders.filter((k) => !filledCustom[k]);

    // ── Derived: preview for one recipient ────────────────────────────────
    const previewRecipient =
        recipients.find((r) => r.email.toLowerCase() === previewEmail.toLowerCase()) ?? recipients[0] ?? null;

    const preview = useMemo(() => {
        if (!template) return null;
        const email = previewRecipient?.email ?? "recipient@example.com";
        const ctx = buildPersonalizationContext({
            recipientEmails: [email],
            contactsByEmail,
            senderName: mailConfig?.fromName ?? "",
            signatureHtml,
            customVariables: filledCustom,
        });
        return {
            to: email,
            subject: substitute(template.subject, ctx),
            html: appendSignatureIfMissing(substitute(template.body, ctx), template.body, signatureHtml),
        };
    }, [template, previewRecipient, contactsByEmail, mailConfig, signatureHtml, filledCustom]);

    // ── Readiness ─────────────────────────────────────────────────────────
    const mailConfigured = !!(mailConfig?.provider && mailConfig.fromEmail && mailConfig.fromName);
    const blockers: string[] = [];
    if (!template) blockers.push("Choose a template");
    if (template && !template.body.trim()) blockers.push("The chosen template has no message body");
    if (recipients.length === 0) blockers.push("Pick at least one recipient");
    if (invalidExtras.length) blockers.push(`Fix ${invalidExtras.length} invalid email address(es)`);
    if (missingCustom.length) blockers.push(`Fill in ${missingCustom.map((k) => `[${k}]`).join(", ")}`);
    if (!mailConfigured) blockers.push("Set up a mail provider in Settings → Mail");

    const sentCount = results.filter((r) => r.ok).length;
    const failedResults = results.filter((r) => !r.ok);
    const done = results.length;
    const finished = !sending && total > 0;

    // ── Send ──────────────────────────────────────────────────────────────
    const buildProviderFields = (config: MailConfigState): Record<string, unknown> => {
        if (config.provider === "resend") return { apiKey: config.resendApiKey };
        if (config.provider === "sendgrid") return { apiKey: config.sendgridApiKey };
        if (config.provider === "ses") {
            return {
                awsAccessKeyId: config.sesAccessKeyId,
                awsSecretAccessKey: config.sesSecretAccessKey,
                awsRegion: config.sesRegion,
            };
        }
        return {}; // graph: credentials live on the server
    };

    const handleSend = async () => {
        if (!template || !mailConfig || blockers.length) return;
        const list = recipients.map((r) => r.email);
        const base = {
            provider: mailConfig.provider,
            fromName: mailConfig.fromName,
            fromEmail: mailConfig.fromEmail,
            subject: template.subject,
            html: template.body,
            sendSeparately: true,
            customVariables: Object.keys(filledCustom).length ? filledCustom : undefined,
            attachmentIds: template.attachments.map((a) => a.id),
            ...buildProviderFields(mailConfig),
        };

        cancelRef.current = false;
        setSending(true);
        setResults([]);
        setStoppedReason(null);
        setTotal(list.length);

        const collected: SendResult[] = [];
        for (let i = 0; i < list.length; i += CHUNK_SIZE) {
            if (cancelRef.current) {
                setStoppedReason("Stopped — the remaining recipients were not sent.");
                break;
            }
            const chunk = list.slice(i, i + CHUNK_SIZE);
            let chunkResults: SendResult[];
            let fatal: string | null = null;
            try {
                const res = await backend.post("/api/send", { ...base, to: chunk }, anyStatus);
                const data = res.data ?? {};
                if (res.status >= 200 && res.status < 300 && res.status !== 207) {
                    chunkResults = chunk.map((email) => ({ email, ok: true }));
                } else if (Array.isArray(data.failures)) {
                    // 207 (some failed) or 502 (all failed) from send-separately mode
                    const failed = new Map<string, string>(
                        data.failures.map((f: { email: string; error: string }) => [f.email.toLowerCase(), f.error])
                    );
                    chunkResults = chunk.map((email) => {
                        const error = failed.get(email.toLowerCase());
                        return error ? { email, ok: false, error } : { email, ok: true };
                    });
                } else {
                    // Whole request rejected — usually configuration (bad key, provider not set up)
                    const error = apiErrorMessage(data, `Server returned HTTP ${res.status}`);
                    chunkResults = chunk.map((email) => ({ email, ok: false, error }));
                    fatal = error;
                }
            } catch (err) {
                const error = err instanceof Error ? err.message : "Network error";
                chunkResults = chunk.map((email) => ({ email, ok: false, error }));
                fatal = error;
            }
            collected.push(...chunkResults);
            setResults([...collected]);
            if (fatal) {
                setStoppedReason(`Stopped after an error: ${fatal}`);
                break;
            }
        }

        setSending(false);
        const ok = collected.filter((r) => r.ok).length;
        const failed = collected.length - ok;
        toast({
            title: failed === 0 && collected.length === list.length ? "Bulk send complete" : "Bulk send finished with problems",
            description: `${ok} sent, ${failed} failed${collected.length < list.length ? `, ${list.length - collected.length} not sent` : ""}.`,
            variant: failed === 0 && collected.length === list.length ? "success" : "destructive",
        });
    };

    const resetForAnother = () => {
        setResults([]);
        setTotal(0);
        setStoppedReason(null);
    };

    const retryFailed = () => {
        const failedEmails = new Set(failedResults.map((r) => r.email.toLowerCase()));
        setExcluded(new Set(allRecipients.map((r) => r.email.toLowerCase()).filter((e) => !failedEmails.has(e))));
        resetForAnother();
    };

    // ── Render ────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="px-4 py-6 md:px-8">
                <PageHeader icon={Mails} title="Bulk Send" description="Send a template to organisations, groups or people in one go" />
                <div className="h-96 rounded-2xl bg-muted/40 animate-pulse" />
            </div>
        );
    }

    const visibleRecipients = showAllRecipients ? recipients : recipients.slice(0, RECIPIENT_PREVIEW_LIMIT);

    // ── Steps ─────────────────────────────────────────────────────────────
    const hasPersonalise = customPlaceholders.length > 0;
    const steps: { id: StepId; title: string; hint: string }[] = [
        { id: "template", title: "Template", hint: template ? template.name : "Pick what to send" },
        {
            id: "audience",
            title: "Audience",
            hint: recipients.length ? `${recipients.length} recipient${recipients.length === 1 ? "" : "s"}` : "Who gets it",
        },
        ...(hasPersonalise
            ? [{ id: "personalise" as StepId, title: "Personalise", hint: missingCustom.length ? `${missingCustom.length} to fill` : "All filled" }]
            : []),
        { id: "review", title: "Review & send", hint: "Preview, then send" },
    ];
    // Lock to the last step while a send is running or its results are on screen.
    const activeId: StepId = sending || finished ? "review" : steps.some((s) => s.id === step) ? step : "review";
    const activeIndex = steps.findIndex((s) => s.id === activeId);
    const stepProblem = (id: StepId): string | null => {
        if (id === "template") {
            if (!template) return "Choose a template to continue";
            if (!template.body.trim()) return "The chosen template has no message body";
        }
        if (id === "audience") {
            if (recipients.length === 0) return "Pick at least one recipient";
            if (invalidExtras.length) return `Fix ${invalidExtras.length} invalid email address(es)`;
        }
        if (id === "personalise" && missingCustom.length) {
            return `Fill in ${missingCustom.map((k) => `[${k}]`).join(", ")}`;
        }
        return null;
    };
    // A step can be opened when every step before it is complete.
    const canOpen = (index: number) => !sending && !finished && steps.slice(0, index).every((s) => !stepProblem(s.id));
    const currentProblem = activeId === "review" ? null : stepProblem(activeId);
    const nextStep = steps[activeIndex + 1];
    const goTo = (index: number) => {
        if (index >= 0 && index < steps.length && canOpen(index)) setStep(steps[index].id);
    };
    const attachmentBytes = template ? template.attachments.reduce((n, a) => n + a.size, 0) : 0;

    return (
        <div className="px-4 py-6 md:px-8">
            <PageHeader icon={Mails} title="Bulk Send" description="Send a template to organisations, groups or people in one go" />

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-5"
            >
                {/* ── Step bar ─────────────────────────────────────────── */}
                <nav aria-label="Steps" className="bg-card rounded-2xl border border-border shadow-card px-5 py-3.5">
                    <ol className="flex flex-wrap items-center gap-3">
                        {steps.map((s, i) => {
                            const done = i < activeIndex;
                            const current = i === activeIndex;
                            return (
                                <li key={s.id} className="flex flex-1 min-w-[150px] items-center gap-3 last:flex-none">
                                    <button
                                        type="button"
                                        onClick={() => goTo(i)}
                                        disabled={current || !canOpen(i)}
                                        aria-current={current ? "step" : undefined}
                                        className="flex items-center gap-2.5 rounded-lg text-left disabled:cursor-default enabled:hover:opacity-80"
                                    >
                                        <span
                                            className={cn(
                                                "w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold",
                                                done && "bg-success text-success-foreground",
                                                current && "bg-primary text-primary-foreground",
                                                !done && !current && "border-2 border-border text-muted-foreground"
                                            )}
                                        >
                                            {done ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : i + 1}
                                        </span>
                                        <span className="min-w-0">
                                            <span className={cn("block text-sm font-semibold", current ? "text-primary" : !done && "text-muted-foreground")}>
                                                {s.title}
                                            </span>
                                            <span className="block text-xs text-muted-foreground truncate max-w-[180px]">{s.hint}</span>
                                        </span>
                                    </button>
                                    {i < steps.length - 1 && (
                                        <span aria-hidden="true" className={cn("hidden sm:block h-0.5 flex-1 rounded", done ? "bg-success" : "bg-border")} />
                                    )}
                                </li>
                            );
                        })}
                    </ol>
                </nav>

                <div className="flex flex-wrap items-start gap-5">
                    {/* ── Current step ─────────────────────────────────── */}
                    <section className="flex-[999_1_560px] min-w-0 bg-card rounded-2xl border border-border shadow-card p-5 md:p-6 space-y-5">
                        {activeId === "template" && (
                            <>
                                <StepHeading title="Which template?" description="The template sets the subject, the message and any attachments." />
                                {templates.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">
                                        No templates yet.{" "}
                                        <Link href="/templates" className="text-primary hover:underline">
                                            Create one
                                        </Link>{" "}
                                        first.
                                    </p>
                                ) : (
                                    <>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <Input
                                            aria-label="Search templates"
                                            placeholder="Search templates by name or subject…"
                                            value={templateSearch}
                                            onChange={(e) => setTemplateSearch(e.target.value)}
                                            className="pl-9"
                                        />
                                    </div>
                                    {filteredTemplates.length === 0 && (
                                        <p className="text-sm text-muted-foreground">
                                            No templates match &ldquo;{templateSearch.trim()}&rdquo;.
                                        </p>
                                    )}
                                    <div role="radiogroup" aria-label="Templates" className="grid gap-3 sm:grid-cols-2">
                                        {filteredTemplates.map((t) => {
                                            const on = t.id === templateId;
                                            return (
                                                <button
                                                    key={t.id}
                                                    type="button"
                                                    role="radio"
                                                    aria-checked={on}
                                                    onClick={() => setTemplateId(t.id)}
                                                    className={cn(
                                                        "rounded-xl border p-4 text-left transition-colors",
                                                        on ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/40"
                                                    )}
                                                >
                                                    <span className="flex items-start justify-between gap-2">
                                                        <span className="font-semibold text-sm">{t.name}</span>
                                                        {on && <Check className="w-4 h-4 text-primary shrink-0" />}
                                                    </span>
                                                    <span className="mt-1 block text-xs text-muted-foreground truncate">
                                                        Subject: {t.subject || "—"}
                                                    </span>
                                                    {t.description && (
                                                        <span className="mt-1 block text-xs text-muted-foreground line-clamp-2">{t.description}</span>
                                                    )}
                                                    {t.attachments.length > 0 && (
                                                        <span className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                                                            <Paperclip className="w-3 h-3" />
                                                            {t.attachments.length} attachment{t.attachments.length === 1 ? "" : "s"}
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    </>
                                )}
                            </>
                        )}

                        {activeId === "audience" && (
                            <>
                                <StepHeading
                                    title="Who should get this email?"
                                    description="Use filters, pick people, or paste addresses. Everything you choose is added together."
                                />

                                <div role="tablist" aria-label="Choose recipients by" className="inline-flex flex-wrap gap-1 rounded-lg bg-muted p-1">
                                    {(
                                        [
                                            ["filters", "Filters"],
                                            ["people", "Pick people"],
                                            ["addresses", "Paste addresses"],
                                        ] as const
                                    ).map(([id, label]) => (
                                        <button
                                            key={id}
                                            type="button"
                                            role="tab"
                                            aria-selected={audienceTab === id}
                                            onClick={() => setAudienceTab(id)}
                                            className={cn(
                                                "rounded-md px-3.5 py-1.5 text-sm transition-colors",
                                                audienceTab === id ? "bg-card font-semibold shadow-sm" : "text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>

                                {audienceTab === "filters" && (
                                    <div className="space-y-5">
                                        {contacts.length === 0 && (
                                            <p className="text-sm text-muted-foreground">
                                                No contacts yet —{" "}
                                                <Link href="/contacts" className="text-primary hover:underline">
                                                    add contacts
                                                </Link>{" "}
                                                with a company to send by organisation, or paste addresses instead.
                                            </p>
                                        )}
                                        {companies.length > 0 && (
                                            <ChipPicker
                                                label="Organisations"
                                                icon={Building2}
                                                items={companies}
                                                selected={selectedCompanies}
                                                onToggle={(v) => setSelectedCompanies((s) => toggleInSet(s, v))}
                                                onAll={() =>
                                                    setSelectedCompanies(
                                                        selectedCompanies.size === companies.length
                                                            ? new Set()
                                                            : new Set(companies.map(([c]) => c))
                                                    )
                                                }
                                            />
                                        )}
                                        {roles.length > 0 && (
                                            <ChipPicker
                                                label="Roles"
                                                icon={Briefcase}
                                                items={roles}
                                                selected={selectedRoles}
                                                onToggle={(v) => setSelectedRoles((s) => toggleInSet(s, v))}
                                                onAll={() =>
                                                    setSelectedRoles(
                                                        selectedRoles.size === roles.length ? new Set() : new Set(roles.map(([r]) => r))
                                                    )
                                                }
                                            />
                                        )}
                                        {filterSummary && (
                                            <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
                                                <span className="font-semibold">{filterSummary}</span>
                                                {(selectedCompanies.size === 0 || selectedRoles.size === 0) &&
                                                    companies.length > 0 &&
                                                    roles.length > 0 && (
                                                        <span className="text-muted-foreground"> — pick both an organisation and a role to narrow it down.</span>
                                                    )}
                                            </div>
                                        )}
                                        {groups.length > 0 && (
                                            <ChipPicker
                                                label="Groups"
                                                icon={Tags}
                                                items={groups}
                                                selected={selectedGroups}
                                                onToggle={(v) => setSelectedGroups((s) => toggleInSet(s, v))}
                                                onAll={() =>
                                                    setSelectedGroups(
                                                        selectedGroups.size === groups.length ? new Set() : new Set(groups.map(([g]) => g))
                                                    )
                                                }
                                            />
                                        )}
                                    </div>
                                )}

                                {audienceTab === "people" && (
                                    <div className="space-y-2">
                                        {contacts.length === 0 ? (
                                            <p className="text-sm text-muted-foreground">
                                                No contacts yet —{" "}
                                                <Link href="/contacts" className="text-primary hover:underline">
                                                    add contacts
                                                </Link>{" "}
                                                first, or paste addresses instead.
                                            </p>
                                        ) : (
                                            <>
                                                <div className="relative">
                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                                    <Input
                                                        aria-label="Search contacts"
                                                        placeholder="Search by name, email or company…"
                                                        value={contactSearch}
                                                        onChange={(e) => setContactSearch(e.target.value)}
                                                        className="pl-9"
                                                    />
                                                </div>
                                                <div className="max-h-80 overflow-y-auto rounded-md border border-border divide-y divide-border">
                                                    {filteredContacts.length === 0 ? (
                                                        <p className="p-3 text-xs text-muted-foreground">No matching contacts.</p>
                                                    ) : (
                                                        filteredContacts.map((c) => (
                                                            <label
                                                                key={c.id}
                                                                className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-muted/40"
                                                            >
                                                                <Checkbox
                                                                    checked={selectedContactIds.has(c.id)}
                                                                    onCheckedChange={() => setSelectedContactIds((s) => toggleInSet(s, c.id))}
                                                                />
                                                                <span className="min-w-0 flex-1">
                                                                    <span className="font-medium">{c.name || c.email}</span>
                                                                    <span className="block text-xs text-muted-foreground truncate">
                                                                        {c.email}
                                                                        {c.company ? ` · ${c.company}` : ""}
                                                                        {c.role ? ` · ${c.role}` : ""}
                                                                    </span>
                                                                </span>
                                                            </label>
                                                        ))
                                                    )}
                                                </div>
                                                {selectedContactIds.size > 0 && (
                                                    <p className="text-xs text-muted-foreground">{selectedContactIds.size} picked by hand</p>
                                                )}
                                            </>
                                        )}
                                    </div>
                                )}

                                {audienceTab === "addresses" && (
                                    <div className="space-y-1.5">
                                        <Label htmlFor="extra-emails">Email addresses</Label>
                                        <Textarea
                                            id="extra-emails"
                                            rows={4}
                                            placeholder="someone@example.com, another@example.com"
                                            value={extraEmails}
                                            onChange={(e) => setExtraEmails(e.target.value)}
                                        />
                                        <p className="text-xs text-muted-foreground">Separate with commas, spaces or new lines.</p>
                                        {invalidExtras.length > 0 && (
                                            <p className="text-xs text-destructive">Not valid: {invalidExtras.join(", ")}</p>
                                        )}
                                    </div>
                                )}

                                {/* Everyone chosen so far, from all three tabs */}
                                <div className="rounded-lg bg-muted/40 border border-border p-3 space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-sm">
                                            <span className="font-semibold">{recipients.length}</span> recipient{recipients.length === 1 ? "" : "s"}
                                            {orgCount > 0 && (
                                                <>
                                                    {" "}across <span className="font-semibold">{orgCount}</span> organisation{orgCount === 1 ? "" : "s"}
                                                </>
                                            )}
                                        </p>
                                        {excluded.size > 0 && (
                                            <button
                                                type="button"
                                                className="text-xs text-primary hover:underline"
                                                onClick={() => setExcluded(new Set())}
                                            >
                                                Restore {excluded.size} removed
                                            </button>
                                        )}
                                    </div>
                                    {recipients.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5">
                                            {visibleRecipients.map((r) => (
                                                <span
                                                    key={r.email}
                                                    className="inline-flex items-center gap-1 rounded-full border border-border bg-card pl-2.5 pr-1 py-0.5 text-xs"
                                                    title={r.company ? `${r.email} · ${r.company}` : r.email}
                                                >
                                                    {r.name || r.email}
                                                    <button
                                                        type="button"
                                                        aria-label={`Remove ${r.email}`}
                                                        className="rounded-full p-0.5 hover:bg-muted"
                                                        onClick={() => setExcluded((s) => new Set(s).add(r.email.toLowerCase()))}
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </span>
                                            ))}
                                            {recipients.length > RECIPIENT_PREVIEW_LIMIT && (
                                                <button
                                                    type="button"
                                                    className="text-xs text-primary hover:underline px-1"
                                                    onClick={() => setShowAllRecipients((v) => !v)}
                                                >
                                                    {showAllRecipients ? "Show fewer" : `+${recipients.length - RECIPIENT_PREVIEW_LIMIT} more`}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {activeId === "personalise" && (
                            <>
                                <StepHeading
                                    title="Fill in placeholders"
                                    description="These aren't filled in automatically. The same value is used for every recipient."
                                />
                                <div className="grid gap-4 sm:grid-cols-2">
                                    {customPlaceholders.map((key) => (
                                        <div key={key} className="space-y-1.5">
                                            <Label htmlFor={`var-${key}`} className="font-mono text-xs">
                                                [{key}]
                                            </Label>
                                            <Input
                                                id={`var-${key}`}
                                                value={customVariables[key] ?? ""}
                                                onChange={(e) => setCustomVariables((prev) => ({ ...prev, [key]: e.target.value }))}
                                            />
                                        </div>
                                    ))}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    [Name], [Company] and the other standard placeholders are filled in for each person automatically.
                                </p>
                            </>
                        )}

                        {activeId === "review" && (
                            <>
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <StepHeading title="Review & send" description="Check the email as one recipient will see it." />
                                    {recipients.length > 1 && (
                                        <Select value={previewRecipient?.email ?? ""} onValueChange={setPreviewEmail}>
                                            <SelectTrigger className="w-64 h-9 text-xs" aria-label="Preview as">
                                                <SelectValue placeholder="Preview as…" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {recipients.slice(0, 100).map((r) => (
                                                    <SelectItem key={r.email} value={r.email} className="text-xs">
                                                        {r.name ? `${r.name} — ${r.email}` : r.email}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                </div>

                                {!preview ? (
                                    <p className="text-sm text-muted-foreground">Choose a template to see the email.</p>
                                ) : (
                                    <div className="rounded-lg border border-border overflow-hidden">
                                        <div className="px-4 py-3 border-b border-border bg-muted/30 text-xs space-y-1">
                                            <p>
                                                <span className="text-muted-foreground w-14 inline-block">From</span>
                                                {mailConfig?.fromName ? `${mailConfig.fromName} <${mailConfig.fromEmail}>` : "—"}
                                            </p>
                                            <p>
                                                <span className="text-muted-foreground w-14 inline-block">To</span>
                                                {preview.to}
                                            </p>
                                            <p className="font-medium text-sm pt-1">
                                                <span dangerouslySetInnerHTML={{ __html: highlightPlaceholders(preview.subject) }} />
                                            </p>
                                        </div>
                                        <div
                                            className="prose prose-sm dark:prose-invert max-w-none text-foreground leading-relaxed p-4 max-h-[460px] overflow-y-auto"
                                            dangerouslySetInnerHTML={{ __html: highlightPlaceholders(preview.html) }}
                                        />
                                    </div>
                                )}

                                {!sending && !finished && blockers.length > 0 && (
                                    <div className="rounded-lg border border-warning/40 bg-warning/10 p-3">
                                        <p className="text-sm font-medium">Before you can send</p>
                                        <ul className="mt-1 text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
                                            {blockers.map((b) => (
                                                <li key={b}>{b}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {(sending || finished) && (
                                    <div className="space-y-3 rounded-lg border border-border p-4">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="font-medium">
                                                {sending ? `Sending ${done} of ${total}…` : `Finished: ${done} of ${total}`}
                                            </span>
                                            <span className="text-muted-foreground">{total ? Math.round((done / total) * 100) : 0}%</span>
                                        </div>
                                        <Progress value={total ? (done / total) * 100 : 0} />
                                        <div className="flex items-center gap-4 text-sm">
                                            <span className="flex items-center gap-1.5 text-success">
                                                <CheckCircle2 className="w-4 h-4" /> {sentCount} sent
                                            </span>
                                            <span className="flex items-center gap-1.5 text-destructive">
                                                <AlertCircle className="w-4 h-4" /> {failedResults.length} failed
                                            </span>
                                        </div>
                                        {stoppedReason && <p className="text-xs text-destructive">{stoppedReason}</p>}
                                        {failedResults.length > 0 && (
                                            <div className="max-h-40 overflow-y-auto rounded-md border border-destructive/20 bg-destructive/5 p-2 space-y-1">
                                                {failedResults.map((r) => (
                                                    <p key={r.email} className="text-xs">
                                                        <span className="font-medium">{r.email}</span>{" "}
                                                        <span className="text-muted-foreground">— {r.error}</span>
                                                    </p>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </section>

                    {/* ── Summary ──────────────────────────────────────── */}
                    <aside className="flex-[1_1_300px] min-w-0 space-y-4 lg:sticky lg:top-6">
                        <div className="bg-card rounded-2xl border border-border shadow-card p-5 space-y-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Summary</p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-4xl font-bold leading-none">{recipients.length}</span>
                                <span className="text-sm text-muted-foreground">recipient{recipients.length === 1 ? "" : "s"}</span>
                            </div>
                            <dl className="space-y-1.5 text-sm">
                                <div className="flex justify-between gap-2">
                                    <dt className="text-muted-foreground">Organisations</dt>
                                    <dd>{orgCount}</dd>
                                </div>
                                <div className="flex justify-between gap-2">
                                    <dt className="text-muted-foreground">Picked by hand</dt>
                                    <dd>{selectedContactIds.size}</dd>
                                </div>
                                <div className="flex justify-between gap-2">
                                    <dt className="text-muted-foreground">Removed</dt>
                                    <dd>{excluded.size}</dd>
                                </div>
                            </dl>
                            <div className="h-px bg-border" />
                            {template ? (
                                <div className="flex items-start gap-3">
                                    <span className="w-11 h-11 shrink-0 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                                        <FileText className="w-5 h-5" />
                                    </span>
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold truncate">{template.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {template.attachments.length
                                                ? `${template.attachments.length} attachment${template.attachments.length === 1 ? "" : "s"} · ${formatBytes(attachmentBytes)}`
                                                : "No attachments"}
                                        </p>
                                        {activeId !== "template" && !sending && !finished && (
                                            <button
                                                type="button"
                                                onClick={() => setStep("template")}
                                                className="mt-1 text-xs text-primary hover:underline"
                                            >
                                                Change template
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">No template chosen yet.</p>
                            )}
                        </div>
                        <div className="bg-card rounded-2xl border border-border shadow-card p-4 text-xs text-muted-foreground leading-relaxed">
                            {mailConfigured ? (
                                <>
                                    Each person gets their own email via{" "}
                                    <span className="font-medium text-foreground">
                                        {PROVIDER_NAMES[mailConfig!.provider] ?? mailConfig!.provider}
                                    </span>
                                    , from {mailConfig!.fromName} &lt;{mailConfig!.fromEmail}&gt;, with [Name] and [Company] filled in.
                                </>
                            ) : (
                                <>
                                    No mail provider yet —{" "}
                                    <Link href="/settings" className="text-primary hover:underline">
                                        set one up in Settings → Mail
                                    </Link>
                                    .
                                </>
                            )}
                        </div>
                    </aside>
                </div>

                {/* ── Back / Continue ──────────────────────────────────── */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-card rounded-2xl border border-border shadow-card px-5 py-3.5">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => goTo(activeIndex - 1)}
                        disabled={activeIndex === 0 || sending || finished}
                    >
                        <ChevronLeft className="w-4 h-4" />
                        Back
                    </Button>

                    <div className="flex flex-wrap items-center justify-end gap-3">
                        {activeId !== "review" ? (
                            <>
                                <span className="text-sm text-muted-foreground">
                                    {currentProblem ?? (nextStep ? `Next: ${nextStep.title.toLowerCase()}` : "")}
                                </span>
                                <Button type="button" onClick={() => goTo(activeIndex + 1)} disabled={!!currentProblem}>
                                    Continue
                                    <ChevronRight className="w-4 h-4" />
                                </Button>
                            </>
                        ) : sending ? (
                            <>
                                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Sending…
                                </span>
                                <Button type="button" variant="outline" onClick={() => (cancelRef.current = true)}>
                                    <Square className="w-4 h-4" />
                                    Stop
                                </Button>
                            </>
                        ) : finished ? (
                            <>
                                {failedResults.length > 0 && (
                                    <Button type="button" variant="outline" onClick={retryFailed}>
                                        <RotateCcw className="w-4 h-4" />
                                        Retry failed
                                    </Button>
                                )}
                                <Button type="button" variant="outline" asChild>
                                    <Link href="/sent">View sent</Link>
                                </Button>
                                <Button
                                    type="button"
                                    onClick={() => {
                                        resetForAnother();
                                        setStep("template");
                                    }}
                                >
                                    Done
                                </Button>
                            </>
                        ) : (
                            <Button type="button" disabled={blockers.length > 0} onClick={() => setConfirmOpen(true)}>
                                <Send className="w-4 h-4" />
                                Send to {recipients.length} recipient{recipients.length === 1 ? "" : "s"}
                            </Button>
                        )}
                    </div>
                </div>
            </motion.div>

            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Send {recipients.length} email{recipients.length === 1 ? "" : "s"}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            &ldquo;{template?.name}&rdquo; goes to {recipients.length} recipient
                            {recipients.length === 1 ? "" : "s"}
                            {orgCount > 0 ? ` across ${orgCount} organisation${orgCount === 1 ? "" : "s"}` : ""}, each
                            as their own personalised copy from {mailConfig?.fromName} &lt;{mailConfig?.fromEmail}&gt;.
                            Sent emails can&apos;t be recalled.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                setConfirmOpen(false);
                                void handleSend();
                            }}
                        >
                            Send now
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

// ─── Local helpers ────────────────────────────────────────────────────────

function StepHeading({ title, description }: { title: string; description: string }) {
    return (
        <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        </div>
    );
}

function ChipPicker({
    label,
    icon: Icon,
    items,
    selected,
    disabled,
    onToggle,
    onAll,
}: {
    label: string;
    icon: typeof FileText;
    items: Array<[string, number]>;
    selected: Set<string>;
    disabled?: boolean;
    onToggle: (value: string) => void;
    onAll: () => void;
}) {
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5">
                    <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                    {label}
                </Label>
                <button type="button" className="text-xs text-primary hover:underline" onClick={onAll} disabled={disabled}>
                    {selected.size === items.length ? "Clear" : "Select all"}
                </button>
            </div>
            <div className="flex flex-wrap gap-2">
                {items.map(([value, count]) => {
                    const on = selected.has(value);
                    return (
                        <button
                            key={value}
                            type="button"
                            disabled={disabled}
                            onClick={() => onToggle(value)}
                            className={cn(
                                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
                                on
                                    ? "border-primary bg-primary/10 text-primary font-medium"
                                    : "border-border bg-card hover:border-primary/40"
                            )}
                        >
                            {value}
                            <span className={cn("text-[10px]", on ? "text-primary/80" : "text-muted-foreground")}>
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export default function BulkSendPage() {
    return (
        <Suspense fallback={<div className="p-8">Loading...</div>}>
            <BulkSendContent />
        </Suspense>
    );
}
