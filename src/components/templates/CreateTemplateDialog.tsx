"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { FileText, Braces, ChevronDown, Info, Sparkles } from "lucide-react";
import type { Editor } from "@tiptap/react";
import {
    Dialog, DialogContent, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RichTextEditor, type Attachment } from "@/components/email/RichTextEditor";
import { cn } from "@/lib/utils";

interface TemplateData {
    id?: string;
    name: string;
    subject: string;
    description: string;
    body?: string;
}

interface CreateTemplateDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (template: {
        id?: string;
        name: string;
        subject: string;
        description: string;
        body: string;
    }) => void;
    editTemplate?: TemplateData | null;
}

// ─── Variable palette ────────────────────────────────────────────────────────

const variableGroups = [
    {
        label: "Recipient",
        accent: "text-blue-600 dark:text-blue-400",
        items: [
            { value: "[Employee Name]", description: 'Their name — or "team" for multiple' },
            { value: "[Job Title]", description: "Their role from your contacts" },
            { value: "[Email]", description: "Their email address" },
        ],
    },
    {
        label: "Sender",
        accent: "text-emerald-600 dark:text-emerald-400",
        items: [
            { value: "[Your Name]", description: "From your mail provider config" },
            { value: "[Signature]", description: "Your default signature" },
        ],
    },
];

function VariablePicker({ onInsert }: { onInsert: (value: string) => void }) {
    const [open, setOpen] = useState(false);
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5">
                    <Braces className="w-3.5 h-3.5" />
                    Insert variable
                    <ChevronDown className="w-3 h-3 opacity-60" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-1.5" align="end" sideOffset={6}>
                {variableGroups.map((group, gi) => (
                    <div key={group.label} className={cn(gi > 0 && "mt-2 pt-2 border-t border-border")}>
                        <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground px-2 mb-1">
                            {group.label}
                        </p>
                        {group.items.map((item) => (
                            <button
                                key={item.value}
                                type="button"
                                onClick={() => {
                                    onInsert(item.value);
                                    setOpen(false);
                                }}
                                className="w-full text-left px-2 py-2 rounded-md hover:bg-muted transition-colors"
                            >
                                <code className={cn("text-[12px] font-mono font-semibold", group.accent)}>
                                    {item.value}
                                </code>
                                <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                                    {item.description}
                                </p>
                            </button>
                        ))}
                    </div>
                ))}
            </PopoverContent>
        </Popover>
    );
}

// ─── Main dialog ─────────────────────────────────────────────────────────────

export const CreateTemplateDialog = ({
    open,
    onOpenChange,
    onSubmit,
    editTemplate,
}: CreateTemplateDialogProps) => {
    const isEditMode = !!editTemplate;
    const [name, setName] = useState("");
    const [subject, setSubject] = useState("");
    const [description, setDescription] = useState("");
    const [body, setBody] = useState("");
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [editorKey, setEditorKey] = useState(0);
    const [editorInstance, setEditorInstance] = useState<Editor | null>(null);

    useEffect(() => {
        if (open && editTemplate) {
            setName(editTemplate.name);
            setSubject(editTemplate.subject);
            setDescription(editTemplate.description);
            setBody(editTemplate.body ?? "");
            setEditorKey((k) => k + 1);
        } else if (open && !editTemplate) {
            setName("");
            setSubject("");
            setDescription("");
            setBody("");
            setEditorKey((k) => k + 1);
        }
    }, [open, editTemplate]);

    const isValid = name.trim().length > 0 && subject.trim().length > 0;
    const wordCount = useMemo(
        () =>
            body
                .replace(/<[^>]*>/g, " ")
                .replace(/\s+/g, " ")
                .trim()
                .split(" ")
                .filter(Boolean).length,
        [body]
    );

    const handleInsertVariable = (variable: string) => {
        editorInstance?.chain().focus().insertContent(variable).run();
    };

    const handleSubmit = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!isValid) return;
        onSubmit({
            id: editTemplate?.id,
            name: name.trim(),
            subject: subject.trim(),
            description: description.trim(),
            body,
        });
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[860px] h-[92vh] max-h-[92vh] p-0 gap-0 flex flex-col overflow-hidden">
                <DialogTitle className="sr-only">
                    {isEditMode ? "Edit template" : "New template"}
                </DialogTitle>

                {/* ─── Header ─────────────────────────────────────── */}
                <div className="flex items-center gap-3 px-6 py-3.5 border-b border-border bg-background/95 backdrop-blur pr-14">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                        <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground leading-tight">
                            {isEditMode ? "Editing" : "New template"}
                        </p>
                        <p className="text-sm font-semibold leading-tight truncate">
                            {name.trim() || (
                                <span className="text-muted-foreground/60 font-normal">Untitled template</span>
                            )}
                        </p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
                    {/* ─── Compact metadata (label-aligned, low chrome) ─── */}
                    <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        className="px-6 pt-5 pb-4 border-b border-border/80 space-y-2.5"
                    >
                        <Field label="Name" required>
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Welcome Email"
                                autoFocus={!isEditMode}
                                className="h-9 text-sm"
                            />
                        </Field>
                        <Field label="Description" hint="(optional)">
                            <Input
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="What's this template for?"
                                className="h-9 text-sm"
                            />
                        </Field>
                        <Field label="Subject" required>
                            <Input
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                placeholder="What's the subject line?"
                                className="h-9 text-sm font-medium"
                            />
                        </Field>
                    </motion.div>

                    {/* ─── Body editor — fills the rest ────────────── */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <div className="flex items-center justify-between gap-3 px-6 pt-4 pb-2.5">
                            <div className="flex items-center gap-2">
                                <Label className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">
                                    Body
                                </Label>
                                {wordCount > 0 && (
                                    <span className="text-[11px] text-muted-foreground tabular-nums">
                                        · {wordCount} {wordCount === 1 ? "word" : "words"}
                                    </span>
                                )}
                            </div>
                            <VariablePicker onInsert={handleInsertVariable} />
                        </div>
                        <div className="flex-1 flex flex-col overflow-hidden px-6 pb-3">
                            <div className="flex-1 min-h-0">
                                <RichTextEditor
                                    key={editorKey}
                                    content={body}
                                    onChange={setBody}
                                    attachments={attachments}
                                    onAttachmentsChange={setAttachments}
                                    showAttachments={false}
                                    compact
                                    minHeight="100%"
                                    placeholder="Start writing… variables like [Employee Name] highlight as you type."
                                    onReady={setEditorInstance}
                                />
                            </div>
                            <p className="text-[11px] text-muted-foreground/80 mt-2 flex items-start gap-1.5 leading-relaxed">
                                <Info className="w-3 h-3 shrink-0 mt-0.5" />
                                <span>
                                    Tip: use{" "}
                                    <code className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">
                                        [Signature]
                                    </code>{" "}
                                    at the end instead of typing your sign-off — it&apos;ll expand to your saved default signature when sending.
                                </span>
                            </p>
                        </div>
                    </div>

                    {/* ─── Footer ─────────────────────────────────── */}
                    <div className="flex items-center justify-between gap-3 px-6 py-3.5 border-t border-border bg-muted/30">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
                            {isValid ? (
                                <>
                                    <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                                    <span className="truncate">
                                        {isEditMode ? "Changes ready to save" : "Ready to create"}
                                    </span>
                                </>
                            ) : (
                                <>
                                    <Info className="w-3.5 h-3.5 shrink-0" />
                                    <span className="truncate">Add a name and subject to continue</span>
                                </>
                            )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={!isValid}>
                                {isEditMode ? "Save Changes" : "Create Template"}
                            </Button>
                        </div>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
};

// ─── Local helper: label-aligned form row ───────────────────────────────────

function Field({
    label,
    required,
    hint,
    children,
}: {
    label: string;
    required?: boolean;
    hint?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="grid grid-cols-[88px_1fr] items-center gap-3">
            <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1 justify-end">
                {label}
                {required && <span className="text-destructive">*</span>}
                {hint && <span className="text-muted-foreground/60 font-normal text-[10px]">{hint}</span>}
            </Label>
            <div>{children}</div>
        </div>
    );
}
