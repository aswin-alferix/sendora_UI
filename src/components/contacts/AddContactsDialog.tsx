"use client";

import { useMemo, useState } from "react";
import { AlertCircle, ClipboardPaste, Loader2, Plus, Trash2, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { emailProblem } from "@/lib/email";

export interface NewContact {
    name: string;
    email: string;
    company: string;
    role: string;
    groups: string[];
}

export interface AddContactsResult {
    /** Emails that could not be saved, with the reason; those rows stay open in the dialog. */
    failed: { email: string; message: string }[];
}

interface Row {
    key: number;
    name: string;
    email: string;
    company: string;
    role: string;
}

type RowErrors = Partial<Record<"name" | "email" | "company", string>>;

interface AddContactsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (contacts: NewContact[]) => Promise<AddContactsResult>;
    roleOptions: string[];
    groupOptions: string[];
    /** Emails already saved, to flag duplicates before sending. */
    existingEmails: string[];
}

const isBlank = (r: Row) => !r.name.trim() && !r.email.trim() && !r.company.trim();

/** Stable React keys for rows (module counter, so no ref is read during render). */
let rowSeq = 0;
const nextRowKey = () => ++rowSeq;

/**
 * Add several contacts in one go: one row per person (Name, Email, Company, Role),
 * groups applied to everyone in the batch. Rows can be pasted straight from Excel.
 */
export function AddContactsDialog({ open, onOpenChange, onSubmit, roleOptions, groupOptions, existingEmails }: AddContactsDialogProps) {
    const defaultRole = roleOptions[0] ?? "";
    const newRow = (prev?: Row): Row => ({
        key: nextRowKey(),
        name: "",
        email: "",
        // Same company/role as the row above: the usual case when adding a team
        company: prev?.company ?? "",
        role: prev?.role || defaultRole,
    });

    const [rows, setRows] = useState<Row[]>(() => [newRow()]);
    const [groups, setGroups] = useState<string[]>([]);
    const [errors, setErrors] = useState<Record<number, RowErrors>>({});
    const [saving, setSaving] = useState(false);
    const [failedNote, setFailedNote] = useState<string | null>(null);

    const reset = () => {
        setRows([newRow()]);
        setGroups([]);
        setErrors({});
        setFailedNote(null);
    };

    const handleOpenChange = (next: boolean) => {
        if (saving) return;
        if (!next) reset();
        onOpenChange(next);
    };

    const filledRows = rows.filter((r) => !isBlank(r));
    const existing = useMemo(() => new Set(existingEmails.map((e) => e.toLowerCase())), [existingEmails]);

    const update = (key: number, field: keyof Omit<Row, "key">, value: string) => {
        setRows((rs) => rs.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
        if (field !== "role" && errors[key]?.[field]) {
            setErrors((e) => ({ ...e, [key]: { ...e[key], [field]: undefined } }));
        }
    };

    const addRow = (focus = true) => {
        setRows((rs) => [...rs, newRow(rs[rs.length - 1])]);
        if (focus) {
            requestAnimationFrame(() => {
                const inputs = document.querySelectorAll<HTMLInputElement>('[data-add-contacts-rows] input[data-field="name"]');
                inputs?.[inputs.length - 1]?.focus();
            });
        }
    };

    const removeRow = (key: number) => {
        setRows((rs) => (rs.length === 1 ? [newRow()] : rs.filter((r) => r.key !== key)));
        setErrors((e) => {
            const next = { ...e };
            delete next[key];
            return next;
        });
    };

    /** Paste from Excel/Sheets: tab-separated columns (Name, Email, Company, Role), one person per line. */
    const handlePaste = (key: number, e: React.ClipboardEvent<HTMLInputElement>) => {
        const text = e.clipboardData.getData("text");
        if (!/[\t\n]/.test(text.trim())) return; // single value: normal paste
        e.preventDefault();
        const lines = text.split(/\r?\n/).map((l) => l.split("\t").map((c) => c.trim())).filter((c) => c.some(Boolean));
        if (!lines.length) return;
        setRows((rs) => {
            const idx = rs.findIndex((r) => r.key === key);
            const before = rs.slice(0, idx);
            const after = rs.slice(idx + 1).filter((r) => !isBlank(r));
            let prev = before[before.length - 1];
            const pasted = lines.map(([name = "", email = "", company = "", role = ""]) => {
                const base = newRow(prev);
                const matchedRole = roleOptions.find((o) => o.toLowerCase() === role.toLowerCase());
                const row = { ...base, name, email, company: company || base.company, role: matchedRole ?? base.role };
                prev = row;
                return row;
            });
            return [...before, ...pasted, ...after];
        });
        setErrors({});
    };

    const validate = (): boolean => {
        const next: Record<number, RowErrors> = {};
        const seen = new Map<string, number>();
        for (const r of filledRows) {
            const e: RowErrors = {};
            if (!r.name.trim()) e.name = "Required";
            if (!r.company.trim()) e.company = "Required";
            const email = r.email.trim();
            const lower = email.toLowerCase();
            if (!email) e.email = "Required";
            else if (emailProblem(email)) e.email = emailProblem(email)!;
            else if (existing.has(lower)) e.email = "Already in your contacts";
            else if (seen.has(lower)) e.email = "Same email as another row";
            if (email) seen.set(lower, r.key);
            if (Object.keys(e).length) next[r.key] = e;
        }
        setErrors(next);
        return Object.keys(next).length === 0;
    };

    const handleSave = async () => {
        setFailedNote(null);
        if (filledRows.length === 0) {
            setErrors({ [rows[0].key]: { name: "Required", email: "Required", company: "Required" } });
            return;
        }
        if (!validate()) return;
        setSaving(true);
        try {
            const result = await onSubmit(
                filledRows.map((r) => ({
                    name: r.name.trim(),
                    email: r.email.trim(),
                    company: r.company.trim(),
                    role: r.role,
                    groups,
                }))
            );
            if (result.failed.length === 0) {
                reset();
                onOpenChange(false);
                return;
            }
            // Keep only the rows that failed, with their reason, so they can be fixed and retried
            const failedBy = new Map(result.failed.map((f) => [f.email.toLowerCase(), f.message]));
            const remaining = filledRows.filter((r) => failedBy.has(r.email.trim().toLowerCase()));
            setRows(remaining.length ? remaining : [newRow()]);
            setErrors(Object.fromEntries(remaining.map((r) => [r.key, { email: failedBy.get(r.email.trim().toLowerCase()) }])));
            const saved = filledRows.length - remaining.length;
            setFailedNote(
                `${saved ? `${saved} added. ` : ""}${remaining.length} couldn't be saved. Fix them below and try again.`
            );
        } finally {
            setSaving(false);
        }
    };

    const errorCount = Object.keys(errors).length;

    const cellInput = (
        r: Row,
        field: "name" | "email" | "company",
        label: string,
        placeholder: string,
        extra?: React.InputHTMLAttributes<HTMLInputElement>
    ) => {
        const err = errors[r.key]?.[field];
        return (
            <div className="min-w-0">
                {/* Phone layout: label above each field (desktop uses the column header) */}
                <label className="mb-1 block text-xs font-medium text-muted-foreground md:hidden">
                    {label} <span className="text-destructive">*</span>
                </label>
                <Input
                    value={r[field]}
                    data-field={field}
                    placeholder={placeholder}
                    onChange={(e) => update(r.key, field, e.target.value)}
                    onPaste={field === "name" ? (e) => handlePaste(r.key, e) : undefined}
                    aria-invalid={!!err}
                    title={err}
                    className={cn("h-10 rounded-lg bg-card", err && "border-destructive focus-visible:ring-destructive/30")}
                    {...extra}
                />
                {err && <p className="mt-1 truncate text-[11px] text-destructive" title={err}>{err}</p>}
            </div>
        );
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[920px]">
                {/* Header */}
                <div className="flex items-center gap-3 border-b border-border px-4 py-4 pr-12 sm:px-6 sm:pr-14">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <UserPlus className="h-[18px] w-[18px]" />
                    </span>
                    <div>
                        <DialogTitle className="text-base font-semibold">Add contacts</DialogTitle>
                        <DialogDescription className="text-[13px]">
                            One row per person. Add as many as you need, then save them all at once.
                        </DialogDescription>
                    </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-foreground">
                            Contacts{" "}
                            <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
                                {filledRows.length}
                            </span>
                        </p>
                        <p className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
                            <ClipboardPaste className="h-3.5 w-3.5" />
                            Tip: copy rows from Excel (Name, Email, Company, Role) and paste into a Full name box.
                        </p>
                    </div>

                    {failedNote && (
                        <div className="mb-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            {failedNote}
                        </div>
                    )}

                    {/* Rows */}
                    <div data-add-contacts-rows className="overflow-hidden rounded-xl border border-border">
                        <div className="hidden grid-cols-[1.1fr_1.4fr_1.1fr_150px_40px] gap-3 bg-muted/50 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
                            <span>
                                Full name <span className="text-destructive">*</span>
                            </span>
                            <span>
                                Email <span className="text-destructive">*</span>
                            </span>
                            <span>
                                Company <span className="text-destructive">*</span>
                            </span>
                            <span>Role</span>
                            <span className="sr-only">Remove</span>
                        </div>
                        {rows.map((r, i) => (
                            <div
                                key={r.key}
                                className={cn(
                                    "px-4 py-3 md:grid md:grid-cols-[1.1fr_1.4fr_1.1fr_150px_40px] md:items-start md:gap-3",
                                    "border-border md:border-t",
                                    i > 0 && "border-t"
                                )}
                            >
                                {/* Phone: card header with number + delete */}
                                <div className="mb-2 flex items-center justify-between md:hidden">
                                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contact {i + 1}</span>
                                    <button
                                        type="button"
                                        onClick={() => removeRow(r.key)}
                                        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                        aria-label={`Remove contact ${i + 1}`}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                                <div className="space-y-2.5 md:contents">
                                {cellInput(r, "name", "Full name", "e.g. Dinesh Velladurai", { autoFocus: i === 0 && rows.length === 1 })}
                                {cellInput(r, "email", "Email", "name@company.com", { type: "email", autoComplete: "off" })}
                                {cellInput(r, "company", "Company", "Company name", {
                                    // Enter on the last row's company adds a new row
                                    onKeyDown: (e) => {
                                        if (e.key === "Enter" && i === rows.length - 1) {
                                            e.preventDefault();
                                            addRow();
                                        }
                                    },
                                })}
                                <div className="min-w-0">
                                    <label className="mb-1 block text-xs font-medium text-muted-foreground md:hidden">Role</label>
                                    <Select value={r.role} onValueChange={(v) => update(r.key, "role", v)}>
                                        <SelectTrigger className="h-10 rounded-lg bg-card" aria-label="Role">
                                            <SelectValue placeholder="Role" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {roleOptions.map((o) => (
                                                <SelectItem key={o} value={o}>
                                                    {o}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => removeRow(r.key)}
                                    className="mt-2.5 hidden h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive md:flex"
                                    aria-label={`Remove row ${i + 1}`}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                        <Button type="button" variant="outline" className="h-9 rounded-lg" onClick={() => addRow()}>
                            <Plus className="h-4 w-4" />
                            Add row
                        </Button>
                        {errorCount > 0 && !failedNote && (
                            <span className="flex items-center gap-1 text-xs text-destructive">
                                <AlertCircle className="h-3.5 w-3.5" />
                                {errorCount === 1 ? "1 row needs attention" : `${errorCount} rows need attention`}
                            </span>
                        )}
                    </div>

                    {/* Groups for the whole batch */}
                    <div className="mt-5 border-t border-border pt-4">
                        <p className="text-sm font-semibold text-foreground">
                            Add everyone to groups <span className="font-normal text-muted-foreground">(optional)</span>
                        </p>
                        {groupOptions.length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                                {groupOptions.map((g) => {
                                    const on = groups.includes(g);
                                    return (
                                        <button
                                            key={g}
                                            type="button"
                                            aria-pressed={on}
                                            onClick={() => setGroups((gs) => (on ? gs.filter((x) => x !== g) : [...gs, g]))}
                                            className={cn(
                                                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                                                on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-muted"
                                            )}
                                        >
                                            {g}
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="mt-1 text-xs text-muted-foreground">No groups yet. Create them from Manage → Groups.</p>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 border-t border-border bg-muted/30 px-4 py-3.5 sm:px-6">
                    <Button type="button" variant="outline" className="h-9 rounded-lg" onClick={() => handleOpenChange(false)} disabled={saving}>
                        Cancel
                    </Button>
                    <Button type="button" className="h-9 rounded-lg" onClick={handleSave} disabled={saving}>
                        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                        {filledRows.length > 1 ? `Add ${filledRows.length} contacts` : "Add contact"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
