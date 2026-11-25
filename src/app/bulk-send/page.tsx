"use client";

import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
    FileText,
    Building2,
    Tags,
    Users,
    Search,
    X,
    Braces,
    Eye,
    Send,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Square,
    RotateCcw,
    Briefcase,
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
}

interface Recipient {
    email: string;
    name: string;
    company: string;
}

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

    // Step 1 — template
    const [templateId, setTemplateId] = useState<string>(searchParams?.get("template") ?? "");

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
                    fetch("/api/templates"),
                    fetch("/api/contacts"),
                    fetch("/api/signatures"),
                ]);
                const [tData, cData, sData] = await Promise.all([
                    tRes.json().catch(() => ({})),
                    cRes.json().catch(() => ({})),
                    sRes.json().catch(() => ({})),
                ]);
                if (cancelled) return;
                setTemplates(
                    (tData.items ?? []).map((t: TemplateItem) => ({
                        id: t.id,
                        name: t.name,
                        subject: t.subject,
                        description: t.description ?? "",
                        body: t.body ?? "",
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
                const res = await fetch("/api/send", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ...base, to: chunk }),
                });
                const data = await res.json().catch(() => ({}));
                if (res.ok && res.status !== 207) {
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
            <div className="p-4 md:p-8 max-w-7xl mx-auto">
                <PageHeader title="Bulk Send" description="Send a template to organisations, groups or people in one go" />
                <div className="h-96 rounded-xl bg-muted/40 animate-pulse" />
            </div>
        );
    }

    const visibleRecipients = showAllRecipients ? recipients : recipients.slice(0, RECIPIENT_PREVIEW_LIMIT);

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
            <PageHeader title="Bulk Send" description="Send a template to organisations, groups or people in one go" />

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
            >
                {/* ── Left: choose ─────────────────────────────────────── */}
                <div className="space-y-6">
                    {/* Step 1 — Template */}
                    <section className="bg-card rounded-xl border border-border shadow-card p-6 space-y-4">
                        <StepTitle n={1} icon={FileText} title="Template" />
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
                                <Select value={templateId} onValueChange={setTemplateId} disabled={sending}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Choose a template" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {templates.map((t) => (
                                            <SelectItem key={t.id} value={t.id}>
                                                {t.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {template && (
                                    <div className="text-xs text-muted-foreground space-y-1">
                                        <p>
                                            <span className="font-medium text-foreground">Subject:</span> {template.subject}
                                        </p>
                                        {template.description && <p>{template.description}</p>}
                                    </div>
                                )}
                            </>
                        )}
                    </section>

                    {/* Step 2 — Audience */}
                    <section className="bg-card rounded-xl border border-border shadow-card p-6 space-y-5">
                        <StepTitle n={2} icon={Users} title="Recipients" />

                        {contacts.length === 0 && (
                            <p className="text-sm text-muted-foreground">
                                No contacts yet —{" "}
                                <Link href="/contacts" className="text-primary hover:underline">
                                    add contacts
                                </Link>{" "}
                                with a company to send by organisation, or type addresses below.
                            </p>
                        )}

                        {companies.length > 0 && (
                            <ChipPicker
                                label="Organisations"
                                icon={Building2}
                                items={companies}
                                selected={selectedCompanies}
                                disabled={sending}
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
                                disabled={sending}
                                onToggle={(v) => setSelectedRoles((s) => toggleInSet(s, v))}
                                onAll={() =>
                                    setSelectedRoles(
                                        selectedRoles.size === roles.length
                                            ? new Set()
                                            : new Set(roles.map(([r]) => r))
                                    )
                                }
                            />
                        )}

                        {filterSummary && (
                            <p className="text-xs text-muted-foreground -mt-2">
                                Sending to: <span className="font-medium text-foreground">{filterSummary}</span>
                                {(selectedCompanies.size === 0 || selectedRoles.size === 0) &&
                                    companies.length > 0 &&
                                    roles.length > 0 && (
                                        <> — pick both an organisation and a role to narrow it down.</>
                                    )}
                            </p>
                        )}

                        {groups.length > 0 && (
                            <ChipPicker
                                label="Groups"
                                icon={Tags}
                                items={groups}
                                selected={selectedGroups}
                                disabled={sending}
                                onToggle={(v) => setSelectedGroups((s) => toggleInSet(s, v))}
                                onAll={() =>
                                    setSelectedGroups(
                                        selectedGroups.size === groups.length
                                            ? new Set()
                                            : new Set(groups.map(([g]) => g))
                                    )
                                }
                            />
                        )}

                        {contacts.length > 0 && (
                            <div className="space-y-2">
                                <Label className="flex items-center gap-1.5">
                                    <Users className="w-3.5 h-3.5 text-muted-foreground" />
                                    Individual contacts
                                </Label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search by name, email or company…"
                                        value={contactSearch}
                                        onChange={(e) => setContactSearch(e.target.value)}
                                        className="pl-9"
                                    />
                                </div>
                                <div className="max-h-56 overflow-y-auto rounded-md border border-border divide-y divide-border">
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
                                                    disabled={sending}
                                                    onCheckedChange={() =>
                                                        setSelectedContactIds((s) => toggleInSet(s, c.id))
                                                    }
                                                />
                                                <span className="min-w-0 flex-1">
                                                    <span className="font-medium">{c.name || c.email}</span>
                                                    <span className="block text-xs text-muted-foreground truncate">
                                                        {c.email}
                                                        {c.company ? ` · ${c.company}` : ""}
                                                    </span>
                                                </span>
                                            </label>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <Label htmlFor="extra-emails">Other email addresses</Label>
                            <Textarea
                                id="extra-emails"
                                rows={2}
                                placeholder="someone@example.com, another@example.com"
                                value={extraEmails}
                                disabled={sending}
                                onChange={(e) => setExtraEmails(e.target.value)}
                            />
                            {invalidExtras.length > 0 && (
                                <p className="text-xs text-destructive">
                                    Not valid: {invalidExtras.join(", ")}
                                </p>
                            )}
                        </div>

                        {/* Summary */}
                        <div className="rounded-lg bg-muted/40 border border-border p-3 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-sm">
                                    <span className="font-semibold">{recipients.length}</span>{" "}
                                    recipient{recipients.length === 1 ? "" : "s"}
                                    {orgCount > 0 && (
                                        <>
                                            {" "}across <span className="font-semibold">{orgCount}</span>{" "}
                                            organisation{orgCount === 1 ? "" : "s"}
                                        </>
                                    )}
                                </p>
                                {excluded.size > 0 && (
                                    <button
                                        type="button"
                                        className="text-xs text-primary hover:underline"
                                        onClick={() => setExcluded(new Set())}
                                        disabled={sending}
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
                                                disabled={sending}
                                                className="rounded-full p-0.5 hover:bg-muted"
                                                onClick={() =>
                                                    setExcluded((s) => new Set(s).add(r.email.toLowerCase()))
                                                }
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
                                            {showAllRecipients
                                                ? "Show fewer"
                                                : `+${recipients.length - RECIPIENT_PREVIEW_LIMIT} more`}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Step 3 — Custom placeholders */}
                    {customPlaceholders.length > 0 && (
                        <section className="bg-card rounded-xl border border-border shadow-card p-6 space-y-4">
                            <StepTitle n={3} icon={Braces} title="Fill in placeholders" />
                            <p className="text-xs text-muted-foreground">
                                These aren&apos;t filled in automatically. The same value is used for every recipient.
                            </p>
                            <div className="grid gap-3 sm:grid-cols-2">
                                {customPlaceholders.map((key) => (
                                    <div key={key} className="space-y-1.5">
                                        <Label htmlFor={`var-${key}`} className="font-mono text-xs">
                                            [{key}]
                                        </Label>
                                        <Input
                                            id={`var-${key}`}
                                            value={customVariables[key] ?? ""}
                                            disabled={sending}
                                            onChange={(e) =>
                                                setCustomVariables((prev) => ({ ...prev, [key]: e.target.value }))
                                            }
                                        />
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                </div>

                {/* ── Right: preview + send ────────────────────────────── */}
                <div className="space-y-6 lg:sticky lg:top-6 self-start">
                    <section className="bg-card rounded-xl border border-border shadow-card p-6 space-y-4">
                        <div className="flex items-center justify-between gap-3">
                            <StepTitle n={customPlaceholders.length > 0 ? 4 : 3} icon={Eye} title="Preview" />
                            {recipients.length > 1 && (
                                <Select
                                    value={previewRecipient?.email ?? ""}
                                    onValueChange={setPreviewEmail}
                                >
                                    <SelectTrigger className="w-56 h-8 text-xs">
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
                                        {mailConfig?.fromName
                                            ? `${mailConfig.fromName} <${mailConfig.fromEmail}>`
                                            : "—"}
                                    </p>
                                    <p>
                                        <span className="text-muted-foreground w-14 inline-block">To</span>
                                        {preview.to}
                                    </p>
                                    <p className="font-medium text-sm pt-1">
                                        <span
                                            dangerouslySetInnerHTML={{ __html: highlightPlaceholders(preview.subject) }}
                                        />
                                    </p>
                                </div>
                                <div
                                    className="prose prose-sm dark:prose-invert max-w-none text-foreground leading-relaxed p-4 max-h-[420px] overflow-y-auto"
                                    dangerouslySetInnerHTML={{ __html: highlightPlaceholders(preview.html) }}
                                />
                            </div>
                        )}
                    </section>

                    <section className="bg-card rounded-xl border border-border shadow-card p-6 space-y-4">
                        <StepTitle n={customPlaceholders.length > 0 ? 5 : 4} icon={Send} title="Send" />

                        {mailConfigured ? (
                            <p className="text-xs text-muted-foreground">
                                Each recipient gets their own copy via{" "}
                                <span className="font-medium text-foreground">
                                    {PROVIDER_NAMES[mailConfig!.provider] ?? mailConfig!.provider}
                                </span>
                                , from {mailConfig!.fromName} &lt;{mailConfig!.fromEmail}&gt;.
                            </p>
                        ) : (
                            <p className="text-xs text-muted-foreground">
                                No mail provider yet —{" "}
                                <Link href="/settings" className="text-primary hover:underline">
                                    set one up in Settings → Mail
                                </Link>
                                .
                            </p>
                        )}

                        {!sending && !finished && blockers.length > 0 && (
                            <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
                                {blockers.map((b) => (
                                    <li key={b}>{b}</li>
                                ))}
                            </ul>
                        )}

                        {(sending || finished) && (
                            <div className="space-y-3">
                                <Progress value={total ? (done / total) * 100 : 0} />
                                <div className="flex items-center gap-4 text-sm">
                                    <span className="flex items-center gap-1.5 text-success">
                                        <CheckCircle2 className="w-4 h-4" /> {sentCount} sent
                                    </span>
                                    <span className="flex items-center gap-1.5 text-destructive">
                                        <AlertCircle className="w-4 h-4" /> {failedResults.length} failed
                                    </span>
                                    <span className="text-muted-foreground ml-auto">
                                        {done} / {total}
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

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                            {sending ? (
                                <Button type="button" variant="outline" onClick={() => (cancelRef.current = true)}>
                                    <Square className="w-4 h-4" />
                                    Stop
                                </Button>
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
                                    <Button type="button" onClick={resetForAnother}>
                                        Done
                                    </Button>
                                </>
                            ) : (
                                <Button
                                    type="button"
                                    disabled={blockers.length > 0}
                                    onClick={() => setConfirmOpen(true)}
                                >
                                    <Send className="w-4 h-4" />
                                    Send to {recipients.length} recipient{recipients.length === 1 ? "" : "s"}
                                </Button>
                            )}
                            {sending && (
                                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Sending…
                                </span>
                            )}
                        </div>
                    </section>
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

function StepTitle({ n, icon: Icon, title }: { n: number; icon: typeof FileText; title: string }) {
    return (
        <h2 className="flex items-center gap-2 text-sm font-semibold">
            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] flex items-center justify-center">
                {n}
            </span>
            <Icon className="w-4 h-4 text-muted-foreground" />
            {title}
        </h2>
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
