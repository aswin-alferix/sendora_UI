"use client";

import { useState, useEffect } from "react";
import { Plus, FileText, MoreVertical, Copy, Edit2, Trash2, Eye, Send, Paperclip } from "lucide-react";

import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/PageHeader";
import { PlayOnceImage } from "@/components/shared/PlayOnceImage";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table/DataTable";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CreateTemplateDialog } from "@/components/templates/CreateTemplateDialog";
import { useToast } from "@/hooks/use-toast";
import type { UploadedFile } from "@/lib/files";
import { MAIL_CONFIG_STORAGE_KEY, type MailConfigState } from "@/components/settings/MailProviderConfig";

// Wrap [Anything] in chip spans so the preview matches the editor's chip styling
function highlightPlaceholders(html: string): string {
    if (!html) return "";
    const parts = html.split(/(<[^>]+>)/);
    return parts
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

function initialsOf(name: string): string {
    return (
        name
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((s) => s[0]?.toUpperCase() ?? "")
            .join("") || "Y"
    );
}

interface Template {
    id: string;
    name: string;
    subject: string;
    description: string;
    body?: string;
    attachments?: UploadedFile[];
    /** Friendly "2h ago" label. */
    updatedAt: string;
    /** Raw timestamp, for sorting. */
    updatedIso?: string;
}

function relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const min = 60_000, hr = 60 * min, day = 24 * hr, week = 7 * day;
    if (diff < min) return "Just now";
    if (diff < hr) return `${Math.floor(diff / min)}m ago`;
    if (diff < day) return `${Math.floor(diff / hr)}h ago`;
    if (diff < week) return `${Math.floor(diff / day)}d ago`;
    return new Date(iso).toLocaleDateString();
}

// "Welcome Email" → "Welcome Email (Copy)" → "Welcome Email (Copy 2)" → ...
function nextCopyName(baseName: string, existingNames: string[]): string {
    const stripRegex = /\s*\(Copy(?:\s+\d+)?\)\s*$/;
    const root = baseName.replace(stripRegex, "").trim();
    const escaped = root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matchRegex = new RegExp(`^${escaped}\\s*\\(Copy(?:\\s+(\\d+))?\\)\\s*$`);

    let maxN = 0;
    for (const name of existingNames) {
        const m = name.match(matchRegex);
        if (!m) continue;
        const n = m[1] ? parseInt(m[1], 10) : 1;
        if (n > maxN) maxN = n;
    }

    const next = maxN + 1;
    return next === 1 ? `${root} (Copy)` : `${root} (Copy ${next})`;
}


export default function TemplatesPage() {
    const router = useRouter();
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch("/api/templates");
                const data = await res.json();
                if (cancelled) return;
                const items: Template[] = (data.items ?? []).map((t: { id: string; name: string; subject: string; description: string; body?: string; attachments?: UploadedFile[]; updatedAt: string; }) => ({
                    id: t.id,
                    name: t.name,
                    subject: t.subject,
                    description: t.description,
                    body: t.body,
                    attachments: t.attachments ?? [],
                    updatedAt: relativeTime(t.updatedAt),
                    updatedIso: t.updatedAt,
                }));
                setTemplates(items);
            } catch (err) {
                console.error("Failed to load templates", err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [templateToDelete, setTemplateToDelete] = useState<Template | null>(null);
    const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
    const [mailConfig, setMailConfig] = useState<MailConfigState | null>(null);

    // Pull saved mail config for the preview's From row
    useEffect(() => {
        try {
            const stored = localStorage.getItem(MAIL_CONFIG_STORAGE_KEY);
            if (stored) setMailConfig(JSON.parse(stored));
        } catch { /* ignore */ }
    }, []);
    const { toast } = useToast();


    const handleCreateOrUpdateTemplate = async (templateData: {
        id?: string;
        name: string;
        subject: string;
        description: string;
        body: string;
        attachmentIds: string[];
    }) => {
        try {
            if (templateData.id) {
                const res = await fetch(`/api/templates/${templateData.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(templateData),
                });
                if (!res.ok) throw new Error("Update failed");
                const updated = await res.json();
                setTemplates((prev) =>
                    prev.map((t) => (t.id === templateData.id ? { ...t, ...updated, updatedAt: relativeTime(updated.updatedAt), updatedIso: updated.updatedAt } : t))
                );
                toast({
                    title: "Changes Saved",
                    description: `"${templateData.name}" has been updated successfully.`,
                    variant: "success",
                });
            } else {
                const res = await fetch("/api/templates", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(templateData),
                });
                if (!res.ok) throw new Error("Create failed");
                const created = await res.json();
                setTemplates((prev) => [{ ...created, updatedAt: relativeTime(created.updatedAt), updatedIso: created.updatedAt }, ...prev]);
                toast({
                    title: "Template Created",
                    description: `"${templateData.name}" has been created successfully.`,
                    variant: "success",
                });
            }
        } catch (err) {
            toast({ title: "Save failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
        }
        setEditingTemplate(null);
    };

    const handleDeleteClick = (template: Template) => {
        setTemplateToDelete(template);
        setDeleteDialogOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (templateToDelete) {
            try {
                const res = await fetch(`/api/templates/${templateToDelete.id}`, { method: "DELETE" });
                if (!res.ok) throw new Error("Delete failed");
                setTemplates((prev) => prev.filter((t) => t.id !== templateToDelete.id));
                toast({
                    title: "Template Deleted",
                    description: `"${templateToDelete.name}" has been deleted.`,
                    variant: "destructive",
                });
            } catch (err) {
                toast({ title: "Delete failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
            }
            setTemplateToDelete(null);
        }
        setDeleteDialogOpen(false);
    };

    const handleDuplicateTemplate = async (template: Template) => {
        const newName = nextCopyName(template.name, templates.map((t) => t.name));
        try {
            const res = await fetch("/api/templates", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: newName,
                    subject: template.subject,
                    description: template.description,
                    body: template.body ?? "",
                    attachmentIds: (template.attachments ?? []).map((a) => a.id),
                }),
            });
            if (!res.ok) throw new Error("Duplicate failed");
            const created = await res.json();
            setTemplates((prev) => [{ ...created, updatedAt: relativeTime(created.updatedAt), updatedIso: created.updatedAt }, ...prev]);
            toast({
                title: "Template Duplicated",
                description: `"${newName}" has been created.`,
                variant: "success",
            });
        } catch (err) {
            toast({ title: "Duplicate failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
        }
    };

    const handleEditTemplate = (template: Template) => {
        setEditingTemplate(template);
        setIsCreateDialogOpen(true);
    };

    const handleDialogClose = (open: boolean) => {
        setIsCreateDialogOpen(open);
        if (!open) {
            setEditingTemplate(null);
        }
    };

    const handleUseInCompose = (template: Template) => {
        sessionStorage.setItem(
            "pending_compose_template",
            JSON.stringify({ subject: template.subject, body: template.body ?? "", attachments: template.attachments ?? [] })
        );
        router.push("/compose");
    };

    const columns: DataTableColumn<Template>[] = [
        {
            id: "name",
            header: "Template",
            hideable: false,
            sortValue: (t) => t.name,
            className: "min-w-[260px]",
            cell: (t) => (
                <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <FileText className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                        <p className="truncate font-semibold" title={t.name}>{t.name}</p>
                        {t.description && (
                            <p className="max-w-[320px] truncate text-xs text-muted-foreground" title={t.description}>
                                {t.description}
                            </p>
                        )}
                    </div>
                </div>
            ),
        },
        {
            id: "subject",
            header: "Subject",
            sortValue: (t) => t.subject,
            className: "min-w-[240px]",
            cell: (t) => (
                <span className="block max-w-[420px] truncate text-muted-foreground" title={t.subject}>
                    {t.subject}
                </span>
            ),
        },
        {
            id: "attachments",
            header: "Attachments",
            sortValue: (t) => t.attachments?.length ?? 0,
            className: "whitespace-nowrap",
            cell: (t) =>
                t.attachments?.length ? (
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        <Paperclip className="h-3.5 w-3.5" />
                        {t.attachments.length}
                    </span>
                ) : (
                    <span className="text-muted-foreground/50">—</span>
                ),
        },
        {
            id: "updated",
            header: "Updated",
            sortValue: (t) => (t.updatedIso ? new Date(t.updatedIso) : null),
            className: "whitespace-nowrap",
            cell: (t) => <span className="text-muted-foreground">{t.updatedAt}</span>,
        },
    ];

    return (
        <>
            <div className="flex h-[calc(100dvh-4rem)] min-h-[600px] flex-col px-4 py-6 md:px-8">
                <PageHeader
                    icon={FileText}
                    title="Email Templates"
                    count={loading ? undefined : templates.length}
                    description="Create and manage reusable email templates"
                    action={
                        <Button className="h-9 rounded-lg" onClick={() => setIsCreateDialogOpen(true)}>
                            <Plus className="w-4 h-4" />
                            Create Template
                        </Button>
                    }
                />

                <DataTable
                    data={templates}
                    columns={columns}
                    getRowId={(t) => t.id}
                    loading={loading}
                    itemLabel="templates"
                    initialSort={{ id: "updated", desc: true }}
                    getSearchText={(t) => `${t.name} ${t.subject} ${t.description ?? ""}`}
                    searchPlaceholder="Search by name, subject or description…"
                    onRowClick={(t) => setPreviewTemplate(t)}
                    rowActions={(template) => (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon-sm" aria-label="Template actions">
                                    <MoreVertical className="w-4 h-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem onClick={() => setPreviewTemplate(template)}>
                                    <Eye className="w-4 h-4 mr-2" />
                                    Preview
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleUseInCompose(template)}>
                                    <Send className="w-4 h-4 mr-2" />
                                    Use in Compose
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleEditTemplate(template)}>
                                    <Edit2 className="w-4 h-4 mr-2" />
                                    Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDuplicateTemplate(template)}>
                                    <Copy className="w-4 h-4 mr-2" />
                                    Duplicate
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteClick(template)}>
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                    emptyState={({ searching, clearSearch }) => (
                        <>
                            <PlayOnceImage
                                animatedSrc="/illustrations/no-templates.webp"
                                staticSrc="/illustrations/no-templates.png"
                                durationMs={2000}
                                width={128}
                                height={128}
                                className="w-32 h-32"
                            />
                            {!searching ? (
                                <p className="text-sm text-muted-foreground">
                                    No templates yet. Hit Create Template to save your first one.
                                </p>
                            ) : (
                                <>
                                    <p className="text-sm text-muted-foreground">No templates match your search.</p>
                                    <Button variant="outline" size="sm" onClick={clearSearch}>
                                        Clear search
                                    </Button>
                                </>
                            )}
                        </>
                    )}
                />
            </div>

            <CreateTemplateDialog
                open={isCreateDialogOpen}
                onOpenChange={handleDialogClose}
                onSubmit={handleCreateOrUpdateTemplate}
                editTemplate={editingTemplate}
            />

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Template</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete &quot;{templateToDelete?.name}&quot;? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ─── Template Preview ─────────────────────────────────────── */}
            <Dialog open={!!previewTemplate} onOpenChange={(open) => !open && setPreviewTemplate(null)}>
                <DialogContent className="sm:max-w-[720px] max-h-[88vh] p-0 gap-0 flex flex-col overflow-hidden">
                    <DialogTitle className="sr-only">
                        Preview: {previewTemplate?.name}
                    </DialogTitle>

                    {/* Compact header */}
                    <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-background pr-12">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                            <Eye className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground leading-tight">
                                Preview
                            </p>
                            <p className="text-sm font-semibold leading-tight truncate">
                                {previewTemplate?.name}
                            </p>
                        </div>
                    </div>

                    {/* Inbox-style email card */}
                    <ScrollArea className="flex-1 bg-muted/30">
                        <div className="p-5">
                            <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
                                {/* Envelope header */}
                                <div className="px-5 py-4 border-b border-border bg-muted/40">
                                    <div className="flex items-start gap-3 mb-3">
                                        <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-xs flex-shrink-0">
                                            {initialsOf(mailConfig?.fromName ?? "")}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold leading-tight truncate text-foreground">
                                                {mailConfig?.fromName || (
                                                    <span className="text-muted-foreground/60 font-normal italic">
                                                        Set sender name in Settings → Mail
                                                    </span>
                                                )}
                                            </p>
                                            <p className="text-[11px] text-muted-foreground leading-tight truncate">
                                                {mailConfig?.fromEmail ? `<${mailConfig.fromEmail}>` : ""}
                                            </p>
                                        </div>
                                        <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                                            Now
                                        </span>
                                    </div>
                                    <div className="space-y-1 text-[11px]">
                                        <div className="flex gap-2 items-baseline">
                                            <span className="text-muted-foreground w-10 shrink-0">to</span>
                                            <span className="sd-placeholder-chip font-mono">[Recipient]</span>
                                        </div>
                                    </div>
                                    <h3 className="text-base font-semibold mt-3 leading-snug text-foreground">
                                        {previewTemplate?.subject || (
                                            <span className="text-muted-foreground/60 font-normal italic">
                                                (No subject)
                                            </span>
                                        )}
                                    </h3>
                                    {previewTemplate?.description && (
                                        <p className="text-[11px] text-muted-foreground mt-1.5 italic">
                                            Note: {previewTemplate.description}
                                        </p>
                                    )}
                                </div>

                                {/* Body */}
                                <div className="p-5">
                                    {previewTemplate?.body ? (
                                        <div
                                            className="prose prose-sm dark:prose-invert max-w-none text-foreground leading-relaxed"
                                            dangerouslySetInnerHTML={{
                                                __html: highlightPlaceholders(previewTemplate.body),
                                            }}
                                        />
                                    ) : (
                                        <p className="text-sm text-muted-foreground/60 italic text-center py-10">
                                            This template has no body content yet.
                                        </p>
                                    )}
                                </div>
                            </div>

                            <p className="text-[11px] text-muted-foreground/80 mt-3 text-center leading-relaxed">
                                Chips like{" "}
                                <span className="sd-placeholder-chip">[Name]</span>{" "}
                                get filled in at send time with the recipient&apos;s info.
                            </p>
                        </div>
                    </ScrollArea>

                    {/* Footer */}
                    <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-border bg-muted/30">
                        <Button variant="outline" onClick={() => setPreviewTemplate(null)}>
                            Close
                        </Button>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    if (previewTemplate) {
                                        handleEditTemplate(previewTemplate);
                                        setPreviewTemplate(null);
                                    }
                                }}
                            >
                                <Edit2 className="h-4 w-4" />
                                Edit
                            </Button>
                            <Button
                                onClick={() => {
                                    if (previewTemplate) {
                                        handleUseInCompose(previewTemplate);
                                        setPreviewTemplate(null);
                                    }
                                }}
                            >
                                <Send className="h-4 w-4" />
                                Use in Compose
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
