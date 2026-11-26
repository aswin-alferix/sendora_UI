"use client";

import { useEffect, useCallback, useState, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { Send, X, Clock, ChevronDown, ChevronUp, Loader2, Users, Braces, Check, PenTool } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { RichTextEditor, type Attachment } from "@/components/email/RichTextEditor";
import { MAIL_CONFIG_STORAGE_KEY, type MailConfigState } from "@/components/settings/MailProviderConfig";
import { AUTO_PLACEHOLDER_KEYS, extractPlaceholders } from "@/lib/mail/substitute";
import { apiErrorMessage } from "@/contexts/AuthContext";
import { formatBytes, type UploadedFile } from "@/lib/files";

const emailListSchema = z
    .string()
    .refine(
        (val) =>
            val
                .split(",")
                .map((e) => e.trim())
                .filter(Boolean)
                .every((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)),
        { message: "Enter valid email address(es), comma-separated" }
    );

const schema = z.object({
    to: emailListSchema,
    cc: z
        .string()
        .optional()
        .refine(
            (val) =>
                !val ||
                val
                    .split(",")
                    .map((e) => e.trim())
                    .filter(Boolean)
                    .every((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)),
            { message: "Enter valid CC email address(es)" }
        ),
    bcc: z
        .string()
        .optional()
        .refine(
            (val) =>
                !val ||
                val
                    .split(",")
                    .map((e) => e.trim())
                    .filter(Boolean)
                    .every((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)),
            { message: "Enter valid BCC email address(es)" }
        ),
    subject: z.string().min(1, "Subject is required"),
    body: z.string().min(1, "Message body is required"),
    scheduledAt: z.string().optional(),
    sendSeparately: z.boolean().optional(),
});

type FormData = z.infer<typeof schema>;

const DRAFT_KEY = "compose_draft";

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
    const [showCcBcc, setShowCcBcc] = useState(false);
    const [scheduleOpen, setScheduleOpen] = useState(false);
    const [editorKey, setEditorKey] = useState(0);

    const {
        register,
        handleSubmit,
        control,
        reset,
        watch,
        setValue,
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
        }, 1000);
        return () => clearTimeout(timeout);
    }, [watchedValues]);

    const clearDraft = useCallback(() => {
        localStorage.removeItem(DRAFT_KEY);
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
            const res = await fetch("/api/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const result = await res.json().catch(() => ({}));

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

            if (!res.ok) {
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

    // Live recipient count for the Send Separately hint
    const toValue = watch("to") ?? "";
    const recipientCount = toValue
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean).length;
    const sendSeparately = watch("sendSeparately");

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
                const res = await fetch("/api/signatures");
                if (!res.ok) return;
                const data = await res.json();
                const def = (data.items ?? []).find((s: { isDefault?: boolean }) => s.isDefault);
                if (!cancelled && def) setDefaultSig({ id: def.id, name: def.name });
            } catch { /* ignore */ }
        })();
        return () => { cancelled = true; };
    }, []);
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
            className="bg-card rounded-xl border border-border shadow-card"
        >
            <div className="p-6 space-y-4">
                {/* To */}
                <div className="space-y-1.5">
                    <Label htmlFor="to">
                        To <span className="text-destructive">*</span>
                    </Label>
                    <Input
                        id="to"
                        placeholder="recipient@example.com, another@example.com"
                        {...register("to")}
                        aria-invalid={!!errors.to}
                        className={errors.to ? "border-destructive focus-visible:ring-destructive" : ""}
                    />
                    {errors.to && <p className="text-xs text-destructive">{errors.to.message}</p>}
                </div>

                {/* CC / BCC + Send-separately toggles share a row */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <button
                        type="button"
                        onClick={() => setShowCcBcc((v) => !v)}
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                        {showCcBcc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        {showCcBcc ? "Hide CC / BCC" : "Add CC / BCC"}
                    </button>

                    <div className="flex items-center gap-2">
                        <Switch
                            id="send-separately"
                            checked={!!sendSeparately}
                            onCheckedChange={(v) => setValue("sendSeparately", v, { shouldDirty: true })}
                        />
                        <Label
                            htmlFor="send-separately"
                            className="text-xs cursor-pointer flex items-center gap-1.5 select-none"
                        >
                            <Users className="w-3.5 h-3.5 text-muted-foreground" />
                            Send separately
                        </Label>
                    </div>
                </div>

                {/* Send-separately context callout */}
                {sendSeparately && (
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

                {showCcBcc && (
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="cc">CC</Label>
                            <Input id="cc" placeholder="cc@example.com" {...register("cc")} aria-invalid={!!errors.cc}
                                className={errors.cc ? "border-destructive focus-visible:ring-destructive" : ""} />
                            {errors.cc && <p className="text-xs text-destructive">{errors.cc.message}</p>}
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="bcc">BCC</Label>
                            <Input id="bcc" placeholder="bcc@example.com" {...register("bcc")} aria-invalid={!!errors.bcc}
                                className={errors.bcc ? "border-destructive focus-visible:ring-destructive" : ""} />
                            {errors.bcc && <p className="text-xs text-destructive">{errors.bcc.message}</p>}
                        </div>
                    </div>
                )}

                {/* Subject */}
                <div className="space-y-1.5">
                    <Label htmlFor="subject">
                        Subject <span className="text-destructive">*</span>
                    </Label>
                    <Input
                        id="subject"
                        placeholder="Email subject"
                        {...register("subject")}
                        aria-invalid={!!errors.subject}
                        className={errors.subject ? "border-destructive focus-visible:ring-destructive" : ""}
                    />
                    {errors.subject && <p className="text-xs text-destructive">{errors.subject.message}</p>}
                </div>

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

                {/* Body — Tiptap rich editor */}
                <div className="space-y-1.5">
                    <Label>
                        Message <span className="text-destructive">*</span>
                    </Label>
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
                        Scheduled for {new Date(watch("scheduledAt")!).toLocaleString()}
                        <button type="button" onClick={() => setValue("scheduledAt", "")} className="ml-auto hover:text-destructive">
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-4 px-6 py-4 border-t border-border bg-muted/30 rounded-b-xl">
                <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={handleClear}>
                        <X className="w-4 h-4" />
                        Clear
                    </Button>

                    {/* Schedule send */}
                    <Popover open={scheduleOpen} onOpenChange={setScheduleOpen}>
                        <PopoverTrigger asChild>
                            <Button type="button" variant="outline" size="sm">
                                <Clock className="w-4 h-4" />
                                Schedule
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 p-4 space-y-3" align="start">
                            <p className="text-sm font-medium">Schedule Send</p>
                            <div className="space-y-1.5">
                                <Label htmlFor="schedule-dt" className="text-xs">Send at</Label>
                                <input
                                    id="schedule-dt"
                                    type="datetime-local"
                                    min={new Date().toISOString().slice(0, 16)}
                                    className="w-full text-sm border border-border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                                    onChange={(e) => {
                                        setValue("scheduledAt", e.target.value);
                                        setScheduleOpen(false);
                                    }}
                                />
                            </div>
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
