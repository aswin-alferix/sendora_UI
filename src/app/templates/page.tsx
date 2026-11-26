"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, Search, FileText, MoreVertical, Copy, Edit2, Trash2, Eye, Send } from "lucide-react";

import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    updatedAt: string;
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

const container = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: { staggerChildren: 0.05 },
    },
};

const item = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 },
};

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
    const [searchQuery, setSearchQuery] = useState("");
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

    const filteredTemplates = templates.filter(
        (template) =>
            template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            template.subject.toLowerCase().includes(searchQuery.toLowerCase())
    );

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
                    prev.map((t) => (t.id === templateData.id ? { ...t, ...updated, updatedAt: relativeTime(updated.updatedAt) } : t))
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
                setTemplates((prev) => [{ ...created, updatedAt: relativeTime(created.updatedAt) }, ...prev]);
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
            setTemplates((prev) => [{ ...created, updatedAt: relativeTime(created.updatedAt) }, ...prev]);
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

    return (
        <>
            <div className="p-4 md:p-8 max-w-7xl mx-auto">
                <PageHeader
                    title="Email Templates"
                    description="Create and manage reusable email templates"
                    action={
                        <Button onClick={() => setIsCreateDialogOpen(true)}>
                            <Plus className="w-4 h-4" />
                            Create Template
                        </Button>
                    }
                />

                {/* Search */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6"
                >
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search templates..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                </motion.div>

                {/* Templates Grid */}
                {filteredTemplates.length > 0 ? (
                    <motion.div
                        variants={container}
                        initial="hidden"
                        animate="show"
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                    >
                        {filteredTemplates.map((template) => (
                            <motion.div
                                key={template.id}
                                variants={item}
                                whileHover={{ y: -4 }}
                                className="bg-card rounded-xl border border-border shadow-card p-6 transition-shadow hover:shadow-md"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent">
                                        <FileText className="w-5 h-5 text-accent-foreground" />
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon-sm">
                                                <MoreVertical className="w-4 h-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
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
                                            <DropdownMenuItem
                                                className="text-destructive"
                                                onClick={() => handleDeleteClick(template)}
                                            >
                                                <Trash2 className="w-4 h-4 mr-2" />
                                                Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                                <h3 className="text-heading-4 font-heading text-foreground mb-1">
                                    {template.name}
                                </h3>
                                <p className="text-body-sm text-muted-foreground mb-3 truncate">
                                    {template.subject}
                                </p>
                                <p className="text-body-xs text-muted-foreground">
                                    Updated {template.updatedAt}
                                </p>
                            </motion.div>
                        ))}
                    </motion.div>
                ) : (
                    <EmptyState
                        icon={<FileText className="w-8 h-8 text-muted-foreground" />}
                        title="No templates found"
                        description="Create your first email template to save time on repetitive emails."
                        action={
                            <Button onClick={() => setIsCreateDialogOpen(true)}>
                                <Plus className="w-4 h-4" />
                                Create Template
                            </Button>
                        }
                    />
                )}
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
