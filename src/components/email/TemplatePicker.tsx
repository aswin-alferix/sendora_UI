"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, FileText, Loader2, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
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
import { backend } from "@/lib/axios";
import type { UploadedFile } from "@/lib/files";

export interface ComposeTemplate {
    id: string;
    name: string;
    subject: string;
    body: string;
    attachments: UploadedFile[];
}

interface TemplatePickerProps {
    /** True when the subject or body already has text; applying then asks first. */
    hasContent: boolean;
    onApply: (template: ComposeTemplate) => void;
    /** Clears what the template filled in (subject, body, attachments). */
    onClear: () => void;
}

/** "Use a template" dropdown for Compose: fills subject, body and attachments. */
export function TemplatePicker({ hasContent, onApply, onClear }: TemplatePickerProps) {
    const [templates, setTemplates] = useState<ComposeTemplate[] | null>(null);
    const [selectedId, setSelectedId] = useState("");
    const [pending, setPending] = useState<ComposeTemplate | null>(null);
    const [confirmClear, setConfirmClear] = useState(false);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        let cancelled = false;
        backend
            .get<{ items?: Partial<ComposeTemplate>[] }>("/api/templates")
            .then(({ data }) => {
                if (cancelled) return;
                setTemplates(
                    (data.items ?? []).map((t) => ({
                        id: t.id ?? "",
                        name: t.name ?? "Untitled",
                        subject: t.subject ?? "",
                        body: t.body ?? "",
                        attachments: t.attachments ?? [],
                    }))
                );
            })
            .catch(() => {
                if (!cancelled) setTemplates([]);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const apply = (t: ComposeTemplate) => {
        setSelectedId(t.id);
        onApply(t);
    };

    const handleChange = (id: string) => {
        setOpen(false);
        const t = templates?.find((x) => x.id === id);
        if (!t || t.id === selectedId) return;
        if (hasContent) setPending(t);
        else apply(t);
    };

    const loading = templates === null;
    const selected = templates?.find((t) => t.id === selectedId) ?? null;

    const clear = () => {
        setSelectedId("");
        onClear();
    };

    return (
        <>
            <div className="flex items-center gap-1">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        aria-haspopup="dialog"
                        aria-expanded={open}
                        aria-label="Use a template"
                        disabled={loading || templates.length === 0}
                        className="flex h-8 w-[200px] items-center gap-1.5 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {loading ? (
                            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
                        ) : (
                            <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        )}
                        <span className={cn("min-w-0 flex-1 truncate text-left", !selected && "text-muted-foreground")}>
                            {selected ? selected.name : loading ? "Loading templates…" : templates.length === 0 ? "No templates yet" : "Use a template"}
                        </span>
                        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                    </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[280px] p-0">
                    <Command>
                        <CommandInput placeholder="Search templates…" className="h-9 text-xs" />
                        <CommandList>
                            <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">No templates match.</CommandEmpty>
                            <CommandGroup>
                                {(templates ?? []).map((t) => (
                                    <CommandItem
                                        key={t.id}
                                        value={`${t.name} ${t.subject} ${t.id}`}
                                        onSelect={() => handleChange(t.id)}
                                        className="flex items-start gap-2 text-xs"
                                    >
                                        <Check className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", t.id === selectedId ? "opacity-100" : "opacity-0")} />
                                        <span className="min-w-0">
                                            <span className="block truncate font-medium">{t.name}</span>
                                            {t.subject && <span className="block truncate text-muted-foreground">{t.subject}</span>}
                                        </span>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
            {selected && (
                <button
                    type="button"
                    onClick={() => (hasContent ? setConfirmClear(true) : clear())}
                    aria-label={`Remove template ${selected.name}`}
                    title="Remove template"
                    className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                    <X className="h-4 w-4" />
                </button>
            )}
            </div>

            <AlertDialog open={!!pending} onOpenChange={(open) => !open && setPending(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Replace your message?</AlertDialogTitle>
                        <AlertDialogDescription>
                            &ldquo;{pending?.name}&rdquo; will replace the current subject, body and attachments. Recipients stay as they are.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Keep my message</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (pending) apply(pending);
                                setPending(null);
                            }}
                        >
                            Use template
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove the template?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This clears the subject, body and attachments, including any edits you made. Recipients stay as they are.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Keep it</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                clear();
                                setConfirmClear(false);
                            }}
                        >
                            Remove
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
