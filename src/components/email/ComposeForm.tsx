"use client";

import { useEffect, useCallback, useState, useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { Send, X, Clock, Loader2, Users, Braces, Check, PenTool, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { RichTextEditor, type Attachment } from "@/components/email/RichTextEditor";
import { TemplatePicker, type ComposeTemplate } from "@/components/email/TemplatePicker";
import { SchedulePicker } from "@/components/email/SchedulePicker";
import { RecipientInput, useHydrated, isRecipientDrag, readRecipientDrag, type RecipientContact } from "@/components/email/RecipientInput";
import { MAIL_CONFIG_STORAGE_KEY, type MailConfigState } from "@/components/settings/MailProviderConfig";
import { AUTO_PLACEHOLDER_KEYS, extractPlaceholders } from "@/lib/mail/substitute";
import { apiErrorMessage } from "@/contexts/AuthContext";
import { formatBytes, type UploadedFile } from "@/lib/files";
import { isValidEmail } from "@/lib/email";
import { anyStatus, backend } from "@/lib/axios";

/** The chips already explain bad addresses, so this message is not shown again under the field. */
const INVALID_ADDRESSES_MSG = "Fix or remove the invalid addresses";

const splitAddresses = (val?: string) =>
    (val ?? "")
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean);

const optionalEmailList = z
    .string()
    .optional()
    .refine((val) => splitAddresses(val).every(isValidEmail), { message: INVALID_ADDRESSES_MSG });

const schema = z.object({
    to: z
        .string()
        .refine((val) => splitAddresses(val).length > 0, { message: "Add at least one recipient" })
        .refine((val) => splitAddresses(val).every(isValidEmail), { message: INVALID_ADDRESSES_MSG }),
    cc: optionalEmailList,
    bcc: optionalEmailList,
    subject: z.string().min(1, "Subject is required"),
    body: z.string().min(1, "Message body is required"),
    scheduledAt: z.string().optional(),
    sendSeparately: z.boolean().optional(),
});

type FormData = z.infer<typeof schema>;

const DRAFT_KEY = "compose_draft";

// ─── Sender (from the saved mail provider config) ────────────────────────────

function readSenderSnapshot(): string {
    try {
        const raw = localStorage.getItem(MAIL_CONFIG_STORAGE_KEY);
        if (!raw) return "";
        const c = JSON.parse(raw) as Partial<MailConfigState>;
        return c.fromEmail ? JSON.stringify({ name: c.fromName ?? "", email: c.fromEmail }) : "";
    } catch {
        return "";
    }
}

function subscribeStorage(cb: () => void) {
    window.addEventListener("storage", cb);
    return () => window.removeEventListener("storage", cb);
}

/** Sender name/email saved in Settings → Mail (null until set, and during SSR). */
function useSender(): { name: string; email: string } | null {
    const snap = useSyncExternalStore(subscribeStorage, readSenderSnapshot, () => "");
    return useMemo(() => (snap ? (JSON.parse(snap) as { name: string; email: string }) : null), [snap]);
}

// ─── Outlook-style field pieces ──────────────────────────────────────────────

function underlineInput(invalid: boolean) {
    return cn(
        "h-9 w-full rounded-none border-0 border-b bg-transparent px-1 text-sm text-foreground outline-none transition-colors",
        "placeholder:text-muted-foreground focus:border-b-2",
        invalid ? "border-destructive focus:border-destructive" : "border-input focus:border-primary"
    );
}

function RecipientRow({
    id,
    label,
    input,
    trailing,
    error,
}: {
    id: string;
    label: string;
    input: React.ReactNode;
    trailing?: React.ReactNode;
    error?: string;
}) {
    return (
        <div>
            <div className="flex items-start gap-3">
                <label
                    htmlFor={id}
                    className="mt-0.5 inline-flex h-8 w-14 shrink-0 cursor-pointer items-center justify-center rounded-md border border-border bg-card text-xs font-semibold text-foreground shadow-sm transition-colors hover:bg-muted"
                >
                    {label}
                </label>
                <div className="relative min-w-0 flex-1">
                    {input}
                    {trailing}
                </div>
            </div>
            {error && error !== INVALID_ADDRESSES_MSG && <p className="ml-[68px] mt-1 text-xs text-destructive">{error}</p>}
        </div>
    );
}

interface ComposeFormProps {
    onSend?: (data: FormData) => void;
    initialTo?: string;
    initialSubject?: string;
    initialBody?: string;
    /** Files from the chosen template, sent as attachments. */
    initialAttachments?: UploadedFile[];
}

export function ComposeForm({ onSend, initialTo = "", initialSubject, initialBody, initialAttachments }: ComposeFormProps) {
    const { toast } = useToast();
    const [attachments, setAttachments] = useState<Attachment[]>(() =>
        (initialAttachments ?? []).map((a) => ({
            id: a.id,
            name: a.filename,
            size: formatBytes(a.size),
            type: a.contentType,
            isImage: a.contentType.startsWith("image/"),
            preview: a.contentType.startsWith("image/") ? a.url : undefined,
        }))
    );
    const [showBcc, setShowBcc] = useState(false);
    const sender = useSender();
    const senderDomain = sender?.email.split("@")[1]?.toLowerCase();
    const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);

    // Address book for recipient chips + suggestions
    const [contacts, setContacts] = useState<RecipientContact[]>([]);
    useEffect(() => {
        let cancelled = false;
        backend
            .get<{ items?: { name?: string; email?: string }[] }>("/api/contacts")
            .then(({ data }) => {
                if (cancelled) return;
                setContacts(
                    (data.items ?? [])
                        .filter((c) => c.email)
                        .map((c) => ({ name: c.name || c.email!, email: c.email! }))
                );
            })
            .catch(() => {
                /* suggestions are optional */
            });
        return () => {
            cancelled = true;
        };
    }, []);
    const [scheduleOpen, setScheduleOpen] = useState(false);
    const [editorKey, setEditorKey] = useState(0);

    const {
        register,
        handleSubmit,
        control,
        reset,
        watch,
        setValue,
        getValues,
        formState: { errors, isSubmitting },
    } = useForm<FormData>({
        resolver: zodResolver(schema),
        defaultValues: (() => {
            const base = { to: initialTo, cc: "", bcc: "", subject: initialSubject ?? "", body: initialBody ?? "", sendSeparately: false };
            if (typeof window === "undefined") return base;
            try {
                const saved = localStorage.getItem(DRAFT_KEY);
                const draft = saved ? JSON.parse(saved) : {};
                return {
                    to: initialTo || draft.to || "",
                    cc: draft.cc || "",
                    bcc: draft.bcc || "",
                    subject: initialSubject ?? draft.subject ?? "",
                    body: initialBody ?? draft.body ?? "",
                    sendSeparately: !!draft.sendSeparately,
                };
            } catch {
                return base;
            }
        })(),
    });

    // Auto-save draft every time form values change
    const watchedValues = watch();
    useEffect(() => {
        const timeout = setTimeout(() => {
            localStorage.setItem(DRAFT_KEY, JSON.stringify(watchedValues));
            const { to, cc, bcc, subject, body } = watchedValues;
            const hasContent = [to, cc, bcc, subject].some((v) => v?.trim()) || !!body?.replace(/<[^>]*>/g, "").trim();
            // Minute-level label: same string = no re-render, so this can't loop.
            setDraftSavedAt(hasContent ? new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : null);
        }, 1000);
        return () => clearTimeout(timeout);
    }, [watchedValues]);

    const clearDraft = useCallback(() => {
        localStorage.removeItem(DRAFT_KEY);
        setDraftSavedAt(null);
    }, []);

    const onSubmit = async (data: FormData) => {
        // Load the saved mail provider config
        const stored = localStorage.getItem(MAIL_CONFIG_STORAGE_KEY);
        if (!stored) {
            toast({
                title: "Mail provider not configured",
                description: "Set one up in Settings → Mail before sending.",
                variant: "destructive",
            });
            return;
        }

        let config: MailConfigState;
        try {
            config = JSON.parse(stored) as MailConfigState;
        } catch {
            toast({
                title: "Mail config is corrupted",
                description: "Re-save your provider in Settings → Mail.",
                variant: "destructive",
            });
            return;
        }

        if (!config.fromEmail || !config.fromName) {
            toast({
                title: "Sender details missing",
                description: "Add a sender name and email in Settings → Mail.",
                variant: "destructive",
            });
            return;
        }

        const splitList = (val?: string) =>
            val ? val.split(",").map((s) => s.trim()).filter(Boolean) : undefined;

        // datetime-local returns local time without timezone (e.g. "2024-04-29T15:30")
        // — convert to a real ISO string so providers interpret it correctly.
        let scheduledIso: string | undefined;
        if (data.scheduledAt) {
            const d = new Date(data.scheduledAt);
            if (!Number.isNaN(d.getTime())) scheduledIso = d.toISOString();
        }

        // Only pass non-empty custom variables
        const filteredCustom: Record<string, string> = {};
        for (const [key, value] of Object.entries(customVariables)) {
            if (value?.trim()) filteredCustom[key] = value.trim();
        }

        const payload: Record<string, unknown> = {
            provider: config.provider,
            fromName: config.fromName,
            fromEmail: config.fromEmail,
            to: splitList(data.to) ?? [],
            cc: splitList(data.cc),
            bcc: splitList(data.bcc),
            subject: data.subject,
            html: data.body,
            scheduledAt: scheduledIso,
            sendSeparately: data.sendSeparately,
            customVariables: Object.keys(filteredCustom).length ? filteredCustom : undefined,
            attachmentIds: attachments.flatMap((a) => (a.id ? [a.id] : [])),
        };

        if (config.provider === "resend") payload.apiKey = config.resendApiKey;
        else if (config.provider === "sendgrid") payload.apiKey = config.sendgridApiKey;
        else if (config.provider === "ses") {
            payload.awsAccessKeyId = config.sesAccessKeyId;
            payload.awsSecretAccessKey = config.sesSecretAccessKey;
            payload.awsRegion = config.sesRegion;
        }

        try {
            const res = await backend.post("/api/send", payload, anyStatus);
            const result = res.data ?? {};

            // Multi-status (207) means partial success in send-separately mode
            if (res.status === 207) {
                toast({
                    title: `Sent ${result.sent} of ${result.total}`,
                    description: result.failures?.length
                        ? `${result.failed} failed: ${result.failures.map((f: { email: string; error: string }) => f.email).join(", ")}`
                        : "Some recipients failed.",
                    variant: "destructive",
                });
                clearDraft();
                onSend?.(data);
                reset({ to: "", cc: "", bcc: "", subject: "", body: "", sendSeparately: false });
                setAttachments([]);
                setCustomVariables({});
                setEditorKey((k) => k + 1);
                return;
            }

            if (res.status < 200 || res.status >= 300) {
                toast({
                    title: "Send failed",
                    description: apiErrorMessage(result, `Provider returned HTTP ${res.status}`),
                    variant: "destructive",
                });
                return;
            }

            // Build a friendly success message
            const recipients = (payload.to as string[]) ?? [];
            const successDesc = data.scheduledAt
                ? `Scheduled for ${new Date(data.scheduledAt).toLocaleString()}`
                : data.sendSeparately && recipients.length > 1
                  ? `${result.sent ?? recipients.length} individual emails sent`
                  : `Sent to ${data.to}`;

            toast({
                title: data.scheduledAt ? "Email scheduled" : "Email sent",
                description: successDesc,
                variant: "success",
            });
            clearDraft();
            onSend?.(data);
            reset({ to: "", cc: "", bcc: "", subject: "", body: "", sendSeparately: false });
            setAttachments([]);
            setCustomVariables({});
            setEditorKey((k) => k + 1);
        } catch (err) {
            toast({
                title: "Send failed",
                description: err instanceof Error ? err.message : "Network error",
                variant: "destructive",
            });
        }
    };

    const handleClear = () => {
        reset({ to: "", cc: "", bcc: "", subject: "", body: "", sendSeparately: false });
        setAttachments([]);
        setCustomVariables({});
        clearDraft();
        setEditorKey((k) => k + 1);
    };

    /** Drag & drop: move one address between To / Cc / Bcc (no duplicates in the target). */
    type RecipientField = "to" | "cc" | "bcc";
    const moveRecipient = (email: string, from: string, to: RecipientField) => {
        if (from === to || !["to", "cc", "bcc"].includes(from)) return;
        const source = from as RecipientField;
        const split = (v?: string) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
        const fromList = split(getValues(source));
        const idx = fromList.findIndex((e) => e.toLowerCase() === email.toLowerCase());
        if (idx === -1) return;
        fromList.splice(idx, 1);
        const toList = split(getValues(to));
        if (!toList.some((e) => e.toLowerCase() === email.toLowerCase())) toList.push(email);
        const opts = { shouldDirty: true, shouldValidate: !!(errors[source] || errors[to]) };
        setValue(source, fromList.join(", "), opts);
        setValue(to, toList.join(", "), opts);
        if (to === "bcc") setShowBcc(true);
    };

    const handleDiscard = () => {
        handleClear();
        setShowBcc(false);
        toast({ title: "Draft discarded" });
    };

    // Live recipient count for the Send Separately hint
    const toValue = watch("to") ?? "";
    const recipientCount = toValue
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean).length;
    const sendSeparately = watch("sendSeparately");
    // Bcc row shows once asked for, or when a restored draft already has Bcc recipients.
    const hydrated = useHydrated();
    const bccVisible = showBcc || (hydrated && !!watch("bcc"));

    // ── Custom template variables ──────────────────────────────────────
    // Detect [Placeholders] in subject + body that aren't auto-resolved, so
    // we can ask the user to fill them in once before sending.
    const bodyValue = watch("body") ?? "";
    const subjectValue = watch("subject") ?? "";
    const [customVariables, setCustomVariables] = useState<Record<string, string>>({});

    const customPlaceholders = useMemo(() => {
        const all = extractPlaceholders(`${subjectValue} ${bodyValue}`);
        return all.filter((key) => !AUTO_PLACEHOLDER_KEYS.has(key));
    }, [bodyValue, subjectValue]);

    // Prune custom values for placeholders that no longer exist in the template
    useEffect(() => {
        setCustomVariables((prev) => {
            const next: Record<string, string> = {};
            for (const key of customPlaceholders) {
                if (prev[key] !== undefined) next[key] = prev[key];
            }
            return next;
        });
    }, [customPlaceholders]);

    const filledCount = customPlaceholders.filter((k) => !!customVariables[k]?.trim()).length;

    // ── Default signature awareness ────────────────────────────────────
    // Show users which signature will be appended so they trust the output.
    const [defaultSig, setDefaultSig] = useState<{ id: string; name: string } | null>(null);
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const { data } = await backend.get("/api/signatures");
                const def = (data.items ?? []).find((s: { isDefault?: boolean }) => s.isDefault);
                if (!cancelled && def) setDefaultSig({ id: def.id, name: def.name });
            } catch { /* ignore */ }
        })();
        return () => { cancelled = true; };
    }, []);
    // Fill subject, body and attachments from a saved template (recipients are kept).
    const handleApplyTemplate = useCallback(
        (t: ComposeTemplate) => {
            setValue("subject", t.subject, { shouldDirty: true, shouldValidate: true });
            setValue("body", t.body, { shouldDirty: true, shouldValidate: true });
            setAttachments(
                t.attachments.map((a) => ({
                    id: a.id,
                    name: a.filename,
                    size: formatBytes(a.size),
                    type: a.contentType,
                    isImage: a.contentType.startsWith("image/"),
                    preview: a.contentType.startsWith("image/") ? a.url : undefined,
                }))
            );
            setEditorKey((k) => k + 1);
            toast({ title: "Template applied", description: `"${t.name}" is in your message. Edit it as you like before sending.` });
        },
        [setValue, toast]
    );
    const handleClearTemplate = useCallback(() => {
        setValue("subject", "", { shouldDirty: true });
        setValue("body", "", { shouldDirty: true });
        setAttachments([]);
        setEditorKey((k) => k + 1);
    }, [setValue]);
    const hasMessageContent = subjectValue.trim().length > 0 || bodyValue.replace(/<[^>]*>/g, "").trim().length > 0 || /<img\b/i.test(bodyValue);

    const hasSignaturePlaceholder = useMemo(
        () => /\[\s*Signature\s*\]/i.test(bodyValue),
        [bodyValue]
    );

    return (
        <motion.form
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-1 flex-col bg-card rounded-2xl border border-border shadow-card"
        >
            {/* ─── Header: From · Send separately · Discard (Outlook style) ─── */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
                <div className="flex min-w-0 items-center gap-1.5 text-sm">
                    <span className="font-semibold text-foreground">From:</span>
                    {sender ? (
                        <span className="truncate text-foreground" title={`${sender.name} <${sender.email}>`}>
                            {sender.email}
                        </span>
                    ) : (
                        <Link href="/settings?tab=mail" className="truncate text-primary hover:underline">
                            Set up a sender in Settings
                        </Link>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <TemplatePicker hasContent={hydrated && hasMessageContent} onApply={handleApplyTemplate} onClear={handleClearTemplate} />
                    <span className="h-5 w-px bg-border" aria-hidden="true" />
                    <div className="flex items-center gap-2">
                        <Switch
                            id="send-separately"
                            checked={hydrated && !!sendSeparately}
                            onCheckedChange={(v) => setValue("sendSeparately", v, { shouldDirty: true })}
                        />
                        <Label htmlFor="send-separately" className="flex cursor-pointer select-none items-center gap-1.5 text-xs">
                            <Users className="h-3.5 w-3.5 text-muted-foreground" />
                            Send separately
                        </Label>
                    </div>
                    <span className="h-5 w-px bg-border" aria-hidden="true" />
                    <TooltipProvider delayDuration={300}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={handleDiscard}
                                    aria-label="Discard"
                                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom"><p className="text-xs">Discard</p></TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </div>

            <div className="flex flex-1 flex-col space-y-4 p-5">
                {/* ─── Recipients + subject: label buttons and underline fields ─── */}
                <div className="space-y-2.5">
                    <RecipientRow
                        id="to"
                        label="To"
                        error={errors.to?.message}
                        input={
                            <Controller
                                name="to"
                                control={control}
                                render={({ field }) => (
                                    <RecipientInput
                                        id="to"
                                        onRecipientDrop={(email, from) => moveRecipient(email, from, "to")}
                                        value={field.value ?? ""}
                                        onChange={field.onChange}
                                        contacts={contacts}
                                        internalDomain={senderDomain}
                                        invalid={!!errors.to}
                                    />
                                )}
                            />
                        }
                        trailing={
                            !bccVisible && (
                                <button
                                    type="button"
                                    onClick={() => setShowBcc(true)}
                                    onDragOver={(e) => {
                                        if (!isRecipientDrag(e)) return;
                                        e.preventDefault();
                                        e.stopPropagation();
                                        e.dataTransfer.dropEffect = "move";
                                    }}
                                    onDrop={(e) => {
                                        const drag = readRecipientDrag(e);
                                        if (!drag) return;
                                        e.preventDefault();
                                        e.stopPropagation();
                                        moveRecipient(drag.email, drag.from, "bcc");
                                    }}
                                    title="Show Bcc (or drop an address here)"
                                    className="absolute right-1 top-[18px] -translate-y-1/2 rounded px-1.5 py-0.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                                >
                                    Bcc
                                </button>
                            )
                        }
                    />
                    <RecipientRow
                        id="cc"
                        label="Cc"
                        error={errors.cc?.message}
                        input={
                            <Controller
                                name="cc"
                                control={control}
                                render={({ field }) => (
                                    <RecipientInput
                                        id="cc"
                                        onRecipientDrop={(email, from) => moveRecipient(email, from, "cc")}
                                        value={field.value ?? ""}
                                        onChange={field.onChange}
                                        contacts={contacts}
                                        internalDomain={senderDomain}
                                        invalid={!!errors.cc}
                                    />
                                )}
                            />
                        }
                    />
                    {bccVisible && (
                        <RecipientRow
                            id="bcc"
                            label="Bcc"
                            error={errors.bcc?.message}
                            input={
                            <Controller
                                name="bcc"
                                control={control}
                                render={({ field }) => (
                                    <RecipientInput
                                        id="bcc"
                                        onRecipientDrop={(email, from) => moveRecipient(email, from, "bcc")}
                                        value={field.value ?? ""}
                                        onChange={field.onChange}
                                        contacts={contacts}
                                        internalDomain={senderDomain}
                                        invalid={!!errors.bcc}
                                        autoFocus={showBcc}
                                    />
                                )}
                            />
                        }
                        />
                    )}
                    <div className="relative pt-1">
                        <input
                            id="subject"
                            placeholder="Add a subject"
                            aria-label="Subject"
                            autoComplete="off"
                            {...register("subject")}
                            aria-invalid={!!errors.subject}
                            className={cn(underlineInput(!!errors.subject), "pr-40")}
                        />
                        {draftSavedAt && (
                            <span className="pointer-events-none absolute right-1 top-[22px] -translate-y-1/2 text-xs text-muted-foreground">
                                Draft saved at {draftSavedAt}
                            </span>
                        )}
                        {errors.subject && <p className="mt-1 text-xs text-destructive">{errors.subject.message}</p>}
                    </div>
                </div>

                {/* Send-separately context callout */}
                {hydrated && sendSeparately && (
                    <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-primary/[0.05] border border-primary/15 text-xs text-foreground"
                    >
                        <Users className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" />
                        <div className="leading-relaxed">
                            {recipientCount > 1 ? (
                                <>
                                    <span className="font-semibold">{recipientCount} individual emails</span>{" "}
                                    will be sent — each recipient gets a personalized copy with their name
                                    filled in. CC and BCC are skipped in this mode.
                                </>
                            ) : recipientCount === 1 ? (
                                <>
                                    Only one recipient — the toggle has no effect until you add more.
                                </>
                            ) : (
                                <>Add multiple recipients to send personalized copies to each.</>
                            )}
                        </div>
                    </motion.div>
                )}

                {/* Template variables panel — only shows when the template has unresolved placeholders */}
                {customPlaceholders.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-xl border border-primary/20 bg-primary/[0.03] overflow-hidden"
                    >
                        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-primary/15">
                            <div className="flex items-center gap-2 min-w-0">
                                <div className="w-7 h-7 rounded-md bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                                    <Braces className="w-3.5 h-3.5" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold leading-tight">Template variables</p>
                                    <p className="text-[11px] text-muted-foreground leading-tight">
                                        Fill these once — they replace the bracketed placeholders before sending.
                                    </p>
                                </div>
                            </div>
                            <span
                                className={`text-[11px] font-semibold tabular-nums shrink-0 flex items-center gap-1 ${filledCount === customPlaceholders.length
                                        ? "text-success"
                                        : "text-muted-foreground"
                                    }`}
                            >
                                {filledCount === customPlaceholders.length && <Check className="w-3 h-3" />}
                                {filledCount}/{customPlaceholders.length}
                            </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2 p-4">
                            {customPlaceholders.map((key) => {
                                const isFilled = !!customVariables[key]?.trim();
                                return (
                                    <div key={key} className="space-y-1">
                                        <Label
                                            htmlFor={`var-${key}`}
                                            className="text-[11px] font-medium flex items-center gap-1.5"
                                        >
                                            <span className="sd-placeholder-chip text-[10px]">
                                                [{key}]
                                            </span>
                                            {isFilled && (
                                                <Check className="w-3 h-3 text-success" />
                                            )}
                                        </Label>
                                        <Input
                                            id={`var-${key}`}
                                            value={customVariables[key] ?? ""}
                                            onChange={(e) =>
                                                setCustomVariables((prev) => ({
                                                    ...prev,
                                                    [key]: e.target.value,
                                                }))
                                            }
                                            placeholder={`Enter ${key.toLowerCase()}`}
                                            className="h-8 text-sm"
                                        />
                                    </div>
                                );
                            })}
                        </div>
                        {filledCount < customPlaceholders.length && (
                            <p className="px-4 pb-3 text-[11px] text-muted-foreground">
                                Unfilled variables will be sent as literal text (e.g. <code className="px-1 rounded bg-muted text-[10px] font-mono">[Start Date]</code>) — fill them in to avoid placeholder leaks.
                            </p>
                        )}
                    </motion.div>
                )}

                {/* Body — Tiptap rich editor (takes the remaining height) */}
                <div className="flex flex-1 flex-col space-y-1.5">
                    <Controller
                        name="body"
                        control={control}
                        render={({ field }) => (
                            <RichTextEditor
                                key={editorKey}
                                content={field.value}
                                onChange={field.onChange}
                                attachments={attachments}
                                onAttachmentsChange={setAttachments}
                                minHeight="240px"
                                fill
                                placeholder="Write your email message here..."
                            />
                        )}
                    />
                    {errors.body && <p className="text-xs text-destructive">{errors.body.message}</p>}

                    {/* Signature awareness — shows what will be appended automatically */}
                    {defaultSig && (
                        <div className="flex items-center justify-between gap-2 mt-2 px-3 py-2 rounded-md bg-muted/40 border border-border/60 text-xs">
                            <span className="flex items-center gap-2 text-muted-foreground min-w-0">
                                <PenTool className="w-3.5 h-3.5 text-primary shrink-0" />
                                <span className="truncate">
                                    {hasSignaturePlaceholder ? (
                                        <>
                                            <span className="sd-placeholder-chip text-[10px] mr-1">[Signature]</span>
                                            will expand to <span className="font-medium text-foreground">&ldquo;{defaultSig.name}&rdquo;</span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="font-medium text-foreground">&ldquo;{defaultSig.name}&rdquo;</span>
                                            {" "}signature will be appended automatically
                                        </>
                                    )}
                                </span>
                            </span>
                            <a
                                href="/settings"
                                className="text-[11px] text-primary hover:underline shrink-0"
                            >
                                Manage
                            </a>
                        </div>
                    )}
                </div>

                {/* Scheduled send display */}
                {watch("scheduledAt") && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-md px-3 py-2">
                        <Clock className="h-3.5 w-3.5 text-primary" />
                        Scheduled for{" "}
                        <span className="font-medium text-foreground">
                            {new Date(watch("scheduledAt")!).toLocaleString([], { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}
                        </span>
                        <button type="button" onClick={() => setValue("scheduledAt", "")} className="ml-auto hover:text-destructive">
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-4 px-5 py-4 border-t border-border bg-muted/30 rounded-b-2xl">
                <div className="flex items-center gap-2">
                    {/* Schedule send */}
                    <Popover open={scheduleOpen} onOpenChange={setScheduleOpen}>
                        <PopoverTrigger asChild>
                            <Button type="button" variant="outline" size="sm">
                                <Clock className="w-4 h-4" />
                                Schedule
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent
                            className="w-auto overflow-hidden rounded-xl p-0"
                            align="start"
                            sideOffset={8}
                            // Don't jump focus to the first quick pick (it looked pre-selected)
                            onOpenAutoFocus={(e) => e.preventDefault()}
                        >
                            <SchedulePicker
                                value={watch("scheduledAt")}
                                onSchedule={(v) => {
                                    setValue("scheduledAt", v, { shouldDirty: true });
                                    setScheduleOpen(false);
                                }}
                                onCancel={() => setScheduleOpen(false)}
                            />
                        </PopoverContent>
                    </Popover>
                </div>

                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Send className="w-4 h-4" />
                    )}
                    {watch("scheduledAt") ? "Schedule Send" : "Send Email"}
                </Button>
            </div>
        </motion.form>
    );
}
