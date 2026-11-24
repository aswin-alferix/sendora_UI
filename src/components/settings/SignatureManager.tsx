"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, PenTool, Star, Edit2, Trash2, Save, X, Sparkles, ChevronDown } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/email/RichTextEditor";
import { useToast } from "@/hooks/use-toast";

interface Signature {
    id: string;
    name: string;
    content: string;
    isDefault: boolean;
}

function stripHtml(html: string): string {
    if (!html) return "";
    return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

// ─── Starter signature templates ─────────────────────────────────────────
// Inline-styled HTML so it renders the same in the editor preview and the
// actual sent email (most email clients ignore <style> tags but respect inline).
const SIGNATURE_TEMPLATES: Array<{
    id: string;
    label: string;
    desc: string;
    name: string;
    html: string;
}> = [
    {
        id: "minimal",
        label: "Minimal",
        desc: "Just name, title, and email",
        name: "Minimal signature",
        html: `<p style="margin:0"><strong>Your Name</strong></p><p style="margin:0;color:#6b7280">Your Title · Your Company</p><p style="margin:0"><a href="mailto:you@company.com" style="color:#2563eb;text-decoration:none">you@company.com</a></p>`,
    },
    {
        id: "classic",
        label: "Classic",
        desc: "Name, title, contact info — stacked",
        name: "Classic signature",
        html: `<p style="margin:0"><strong style="color:#111827">Your Name</strong></p><p style="margin:0;color:#374151">Your Title</p><p style="margin:0;color:#374151">Your Company</p><p style="margin:0;color:#6b7280;font-size:13px">+1 (555) 123-4567 · <a href="mailto:you@company.com" style="color:#2563eb;text-decoration:none">you@company.com</a></p>`,
    },
    {
        id: "two-column",
        label: "Two-column with logo",
        desc: "Name and logo on the left, contact details on the right",
        name: "Two-column signature",
        html: `<table style="border-collapse:collapse;margin:8px 0" class="sd-editor-table"><tbody><tr><td style="padding:0 16px 0 0;border-right:2px solid #e5e7eb;vertical-align:top;width:40%"><p style="margin:0"><strong style="color:#dc2626;font-size:15px">Your Name</strong></p><p style="margin:0;color:#374151">Your Title</p><p style="margin:8px 0 0"><span style="color:#9ca3af;font-size:11px">[ Insert logo image here ]</span></p></td><td style="padding:0 0 0 16px;vertical-align:top"><p style="margin:0;color:#374151">+1 (555) 123-4567</p><p style="margin:0"><a href="mailto:you@company.com" style="color:#2563eb;text-decoration:none">you@company.com</a></p><p style="margin:0"><a href="https://yourcompany.com" style="color:#2563eb;text-decoration:none">www.yourcompany.com</a></p><p style="margin:8px 0 0"><strong>Your Company</strong></p><p style="margin:0;color:#6b7280;font-size:12px">123 Main Street, City, State 12345</p></td></tr></tbody></table>`,
    },
];

export function SignatureManager() {
    const [signatures, setSignatures] = useState<Signature[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [draftName, setDraftName] = useState("");
    const [draftContent, setDraftContent] = useState("");
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const { toast } = useToast();

    // Load from API
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch("/api/signatures");
                const data = await res.json();
                if (!cancelled) setSignatures(data.items ?? []);
            } catch (err) {
                console.error("Failed to load signatures", err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const startEdit = (sig: Signature) => {
        setEditingId(sig.id);
        setDraftName(sig.name);
        setDraftContent(sig.content);
    };

    const cancelEdit = () => {
        setEditingId(null);
        setDraftName("");
        setDraftContent("");
    };

    const saveEdit = async () => {
        const name = draftName.trim();
        if (!name) {
            toast({ title: "Name required", description: "Please give your signature a name.", variant: "destructive" });
            return;
        }
        try {
            const res = await fetch(`/api/signatures/${editingId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, content: draftContent }),
            });
            if (!res.ok) throw new Error("Save failed");
            const updated = await res.json();
            setSignatures((prev) => prev.map((s) => (s.id === editingId ? updated : s)));
            toast({ title: "Signature saved", description: `"${name}" has been saved.`, variant: "success" });
            cancelEdit();
        } catch (err) {
            toast({ title: "Save failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
        }
    };

    const handleNew = async (template?: { name: string; html: string }) => {
        if (isCreating) return;
        setIsCreating(true);
        try {
            const res = await fetch("/api/signatures", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: template?.name ?? `New signature ${signatures.length + 1}`,
                    content: template?.html ?? "",
                }),
            });
            if (!res.ok) throw new Error("Create failed");
            const created: Signature = await res.json();
            setSignatures((prev) => [...prev, created]);
            startEdit(created);
        } catch (err) {
            toast({ title: "Create failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
        } finally {
            setIsCreating(false);
        }
    };

    const handleDelete = async (id: string) => {
        const sig = signatures.find((s) => s.id === id);
        try {
            const res = await fetch(`/api/signatures/${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Delete failed");
            setSignatures((prev) => {
                const filtered = prev.filter((s) => s.id !== id);
                // If we deleted the default, the API promotes the oldest. Mirror that locally.
                if (sig?.isDefault && filtered.length > 0) {
                    const oldest = [...filtered][0];
                    return filtered.map((s) => (s.id === oldest.id ? { ...s, isDefault: true } : s));
                }
                return filtered;
            });
            if (editingId === id) cancelEdit();
            if (sig) {
                toast({ title: "Signature deleted", description: `"${sig.name}" has been deleted.`, variant: "destructive" });
            }
        } catch (err) {
            toast({ title: "Delete failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
        } finally {
            setPendingDeleteId(null);
        }
    };

    const handleSetDefault = async (id: string) => {
        try {
            const res = await fetch(`/api/signatures/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isDefault: true }),
            });
            if (!res.ok) throw new Error("Update failed");
            setSignatures((prev) => prev.map((s) => ({ ...s, isDefault: s.id === id })));
            const sig = signatures.find((s) => s.id === id);
            if (sig) {
                toast({ title: "Default updated", description: `"${sig.name}" is now your default signature.`, variant: "success" });
            }
        } catch (err) {
            toast({ title: "Update failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
        }
    };

    if (loading) {
        return (
            <div className="space-y-3">
                {[1, 2].map((i) => (
                    <div key={i} className="h-[88px] rounded-xl bg-muted/40 animate-pulse" />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h3 className="text-heading-4 font-heading mb-1">Email Signatures</h3>
                    <p className="text-body-sm text-muted-foreground">
                        Save multiple signatures (e.g. one for new mail, one for replies). The default is appended automatically.
                    </p>
                </div>
                <div className="inline-flex items-center rounded-md border border-border bg-card shadow-sm flex-shrink-0 overflow-hidden">
                    <Button
                        onClick={() => handleNew()}
                        variant="ghost"
                        size="sm"
                        className="rounded-none border-r border-border h-8"
                        disabled={isCreating}
                    >
                        <Plus className="w-4 h-4" />
                        Blank
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="rounded-none h-8 px-2"
                                disabled={isCreating}
                                aria-label="Start from template"
                            >
                                <Sparkles className="w-3.5 h-3.5" />
                                <ChevronDown className="w-3 h-3 opacity-60" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[280px]">
                            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                                Start from template
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {SIGNATURE_TEMPLATES.map((t) => (
                                <DropdownMenuItem
                                    key={t.id}
                                    onClick={() => handleNew({ name: t.name, html: t.html })}
                                    className="flex-col items-start gap-0.5 py-2 cursor-pointer"
                                >
                                    <span className="text-sm font-medium">{t.label}</span>
                                    <span className="text-[11px] text-muted-foreground">{t.desc}</span>
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {signatures.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-border py-12 px-6 text-center">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                        <PenTool className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium mb-1">No signatures yet</p>
                    <p className="text-xs text-muted-foreground mb-4">
                        Create your first signature to use it in emails.
                    </p>
                    <Button size="sm" onClick={() => handleNew()}>
                        <Plus className="w-4 h-4" />
                        Create signature
                    </Button>
                </div>
            ) : (
                <div className="space-y-3">
                    <AnimatePresence mode="popLayout" initial={false}>
                        {signatures.map((sig) => (
                            <motion.div
                                key={sig.id}
                                layout
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                                transition={{ duration: 0.18 }}
                                className={`rounded-xl border bg-card overflow-hidden ${editingId === sig.id ? "border-primary/40 shadow-card" : "border-border"
                                    }`}
                            >
                                {editingId === sig.id ? (
                                    <div className="p-4 space-y-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                                <PenTool className="w-4 h-4 text-primary" />
                                            </div>
                                            <Input
                                                value={draftName}
                                                onChange={(e) => setDraftName(e.target.value)}
                                                placeholder="Signature name (e.g. Mail signature)"
                                                className="h-9 font-medium"
                                                autoFocus
                                                maxLength={50}
                                            />
                                        </div>
                                        <RichTextEditor
                                            content={draftContent}
                                            onChange={setDraftContent}
                                            minHeight="220px"
                                            showAttachments={false}
                                            placeholder="Type your signature here. Use Insert → Table to build a 2-column layout like a business card."
                                        />
                                        <div className="flex items-center justify-end gap-2 pt-1">
                                            <Button variant="ghost" size="sm" onClick={cancelEdit}>
                                                <X className="w-4 h-4" />
                                                Cancel
                                            </Button>
                                            <Button size="sm" onClick={saveEdit}>
                                                <Save className="w-4 h-4" />
                                                Save signature
                                            </Button>
                                        </div>
                                    </div>
                                ) : pendingDeleteId === sig.id ? (
                                    <div className="p-4 flex items-center justify-between gap-3 bg-destructive/[0.04]">
                                        <p className="text-sm">
                                            Delete <span className="font-semibold">&quot;{sig.name}&quot;</span>?
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <Button variant="ghost" size="sm" onClick={() => setPendingDeleteId(null)}>
                                                Cancel
                                            </Button>
                                            <Button variant="destructive" size="sm" onClick={() => handleDelete(sig.id)}>
                                                <Trash2 className="w-4 h-4" />
                                                Delete
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-4 flex items-start gap-3 group">
                                        <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
                                            <PenTool className="w-4 h-4 text-accent-foreground" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                <p className="text-sm font-semibold truncate">{sig.name}</p>
                                                {sig.isDefault && (
                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">
                                                        <Star className="w-2.5 h-2.5 fill-current" />
                                                        Default
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                                                {stripHtml(sig.content) || (
                                                    <span className="italic opacity-70">Empty signature</span>
                                                )}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-0.5 flex-shrink-0">
                                            {!sig.isDefault && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    onClick={() => handleSetDefault(sig.id)}
                                                    aria-label="Set as default"
                                                    title="Set as default"
                                                    className="hover:text-primary"
                                                >
                                                    <Star className="w-4 h-4" />
                                                </Button>
                                            )}
                                            <Button variant="ghost" size="icon-sm" onClick={() => startEdit(sig)} aria-label="Edit signature" title="Edit">
                                                <Edit2 className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                onClick={() => setPendingDeleteId(sig.id)}
                                                aria-label="Delete signature"
                                                title="Delete"
                                                className="hover:text-destructive"
                                                disabled={signatures.length === 1}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
}
