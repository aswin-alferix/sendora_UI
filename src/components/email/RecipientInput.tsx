"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { emailProblem, parseRecipients } from "@/lib/email";

export interface RecipientContact {
    name: string;
    email: string;
}

interface RecipientInputProps {
    id: string;
    /** Comma-separated addresses (same format the form schema validates). */
    value: string;
    onChange: (value: string) => void;
    /** Address book for names + suggestions. */
    contacts: RecipientContact[];
    /** Sender's domain: other domains get the "external" outline, like Outlook. */
    internalDomain?: string;
    invalid?: boolean;
    trailing?: React.ReactNode;
    autoFocus?: boolean;
    /** A chip from another recipient field was dropped here (drag & drop between To/Cc/Bcc). */
    onRecipientDrop?: (email: string, fromId: string) => void;
}

/** Drag payload type for moving recipients between fields. */
export const RECIPIENT_DRAG_TYPE = "application/x-sendora-recipient";

/** Reads a dragged recipient, or null if the drag isn't one of ours. */
export function readRecipientDrag(e: React.DragEvent): { email: string; from: string } | null {
    try {
        const raw = e.dataTransfer.getData(RECIPIENT_DRAG_TYPE);
        return raw ? (JSON.parse(raw) as { email: string; from: string }) : null;
    } catch {
        return null;
    }
}

export function isRecipientDrag(e: React.DragEvent) {
    return Array.from(e.dataTransfer.types).includes(RECIPIENT_DRAG_TYPE);
}


const noopSubscribe = () => () => {};
/**
 * False during SSR and hydration, true afterwards. The compose draft comes from
 * localStorage, so anything rendered from it must wait or React reports a mismatch.
 */
export function useHydrated() {
    return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

function toList(value: string) {
    return value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
}

/**
 * Outlook-style recipient field: addresses become chips (name + green dot for
 * known contacts, amber outline for external domains, red for invalid), with
 * contact suggestions while typing. The form value stays a comma-separated string.
 */
export function RecipientInput({ id, value, onChange, contacts, internalDomain, invalid, trailing, autoFocus, onRecipientDrop }: RecipientInputProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const skipSeq = useRef(0);
    const [text, setText] = useState("");
    const [focused, setFocused] = useState(false);
    const [highlight, setHighlight] = useState(0);
    const [dragOver, setDragOver] = useState(false);
    const [draggingEmail, setDraggingEmail] = useState<string | null>(null);
    /** Feedback when a paste/entry contained addresses already in this field. */
    const [skipped, setSkipped] = useState<{ count: number; emails: Set<string>; at: number } | null>(null);

    useEffect(() => {
        if (!skipped) return;
        const t = window.setTimeout(() => setSkipped(null), 4000);
        return () => window.clearTimeout(t);
    }, [skipped]);

    // A chip dropped into another field unmounts before its own dragend fires,
    // so also clear the "being dragged" look on any drop/dragend in the page.
    useEffect(() => {
        if (!draggingEmail) return;
        const clear = () => setDraggingEmail(null);
        window.addEventListener("dragend", clear, true);
        window.addEventListener("drop", clear, true);
        return () => {
            window.removeEventListener("dragend", clear, true);
            window.removeEventListener("drop", clear, true);
        };
    }, [draggingEmail]);

    const hydrated = useHydrated();
    const list = useMemo(() => (hydrated ? toList(value) : []), [value, hydrated]);
    const byEmail = useMemo(() => {
        const m = new Map<string, RecipientContact>();
        contacts.forEach((c) => c.email && m.set(c.email.toLowerCase(), c));
        return m;
    }, [contacts]);

    const suggestions = useMemo(() => {
        const q = text.trim().toLowerCase();
        if (!q) return [];
        const taken = new Set(list.map((e) => e.toLowerCase()));
        return contacts
            .filter((c) => !taken.has(c.email.toLowerCase()))
            .filter((c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q))
            .slice(0, 6);
    }, [text, contacts, list]);

    const invalidCount = useMemo(() => list.filter((e) => emailProblem(e)).length, [list]);

    /** Adds entries as chips (valid or not, so nothing vanishes), skipping duplicates. */
    const commit = (incoming: string[]) => {
        if (incoming.length === 0) return;
        const seen = new Set(list.map((e) => e.toLowerCase()));
        const next = [...list];
        const dupes = new Set<string>();
        for (const e of incoming) {
            if (!seen.has(e.toLowerCase())) {
                next.push(e);
                seen.add(e.toLowerCase());
            } else {
                dupes.add(e.toLowerCase());
            }
        }
        if (next.length !== list.length) onChange(next.join(", "));
        // Say so instead of silently ignoring repeats (looked like a paste limit).
        skipSeq.current += 1;
        setSkipped(dupes.size ? { count: dupes.size, emails: dupes, at: skipSeq.current } : null);
        setText("");
        setHighlight(0);
    };

    const remove = (index: number) => {
        onChange(list.filter((_, i) => i !== index).join(", "));
        inputRef.current?.focus();
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        const open = focused && suggestions.length > 0;
        if (open && e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => (h + 1) % suggestions.length);
        } else if (open && e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
        } else if (e.key === "Enter" || e.key === "Tab" || e.key === "," || e.key === ";") {
            if (open && (e.key === "Enter" || e.key === "Tab")) {
                e.preventDefault();
                commit([suggestions[Math.min(highlight, suggestions.length - 1)].email]);
            } else if (text.trim()) {
                e.preventDefault(); // Enter must not submit the form
                commit(parseRecipients(text));
            } else if (e.key === "Enter") {
                e.preventDefault();
            }
        } else if (e.key === "Backspace" && !text && list.length) {
            remove(list.length - 1);
        } else if (e.key === "Escape") {
            setText("");
        }
    };

    return (
        <div className="relative">
            <div
                onClick={() => inputRef.current?.focus()}
                onDragOver={(e) => {
                    if (!onRecipientDrop || !isRecipientDrag(e)) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (!dragOver) setDragOver(true);
                }}
                onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(false);
                }}
                onDrop={(e) => {
                    setDragOver(false);
                    const drag = readRecipientDrag(e);
                    if (!drag || !onRecipientDrop) return;
                    e.preventDefault();
                    if (drag.from !== id) onRecipientDrop(drag.email, drag.from);
                }}
                className={cn(
                    "flex min-h-9 w-full cursor-text flex-wrap items-center gap-1.5 rounded-t-md border-b py-1 pl-1 pr-10 transition-colors",
                    dragOver
                        ? "border-b-2 border-primary bg-primary/5 outline-dashed outline-1 outline-primary/40"
                        : invalid
                          ? "border-destructive"
                          : focused
                            ? "border-b-2 border-primary"
                            : "border-input"
                )}
            >
                {list.map((email, i) => {
                    const contact = byEmail.get(email.toLowerCase());
                    const problem = emailProblem(email);
                    const valid = !problem;
                    const domain = email.split("@")[1]?.toLowerCase();
                    const external = valid && !!internalDomain && domain !== internalDomain;
                    return (
                        <span
                            key={`${email}-${i}`}
                            title={problem ? `Not a valid address: ${problem}` : contact ? `${contact.name} <${email}>` : email}
                            draggable={!!onRecipientDrop}
                            onDragStart={(e) => {
                                e.dataTransfer.setData(RECIPIENT_DRAG_TYPE, JSON.stringify({ email, from: id }));
                                e.dataTransfer.setData("text/plain", email);
                                e.dataTransfer.effectAllowed = "move";
                                setDraggingEmail(email);
                            }}
                            onDragEnd={() => setDraggingEmail(null)}
                            className={cn(
                                "inline-flex h-7 max-w-[280px] items-center gap-1.5 rounded-md border pl-2 pr-1 text-sm",
                                onRecipientDrop && "cursor-grab active:cursor-grabbing",
                                draggingEmail === email && "opacity-40",
                                skipped?.emails.has(email.toLowerCase()) && "ring-2 ring-primary ring-offset-1 ring-offset-background",
                                !valid
                                    ? "border-destructive bg-destructive/10 text-destructive"
                                    : external
                                      ? "border-warning bg-warning/10 text-foreground"
                                      : "border-border bg-muted/60 text-foreground"
                            )}
                        >
                            {!valid && <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                            {valid && contact && <span className="h-2 w-2 shrink-0 rounded-full bg-success" aria-hidden="true" />}
                            <span className="truncate">{contact?.name || email}</span>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    remove(i);
                                }}
                                className="rounded p-0.5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
                                aria-label={`Remove ${contact?.name || email}`}
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </span>
                    );
                })}
                <input
                    ref={inputRef}
                    id={id}
                    value={text}
                    autoFocus={autoFocus}
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(e) => {
                        const v = e.target.value;
                        // Typing a separator commits what's before it
                        if (/[,;\r\n]/.test(v)) commit(parseRecipients(v));
                        else {
                            setText(v);
                            setHighlight(0);
                        }
                    }}
                    onKeyDown={onKeyDown}
                    onPaste={(e) => {
                        // Pasted addresses become chips right away (no Enter needed).
                        const pasted = e.clipboardData.getData("text");
                        // A word like "john" pastes as text (to search contacts); anything with an @ or a list becomes chips.
                        if (!/[@\r\n,;]/.test(pasted)) return;
                        e.preventDefault();
                        const typed = text;
                        commit(parseRecipients(pasted));
                        setText(typed); // keep anything already typed in the box
                    }}
                    onFocus={() => setFocused(true)}
                    onBlur={() => {
                        setFocused(false);
                        if (text.trim()) commit(parseRecipients(text));
                    }}
                    aria-invalid={invalid}
                    className="h-7 min-w-[160px] flex-1 bg-transparent px-1 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
            </div>
            {trailing}

            {skipped && (
                <p key={skipped.at} className="mt-1 flex items-center gap-1 text-xs text-primary" role="status">
                    <Info className="h-3.5 w-3.5" />
                    {skipped.count === 1
                        ? "1 address was already here, so it wasn't added again"
                        : `${skipped.count} addresses were already here, so they weren't added again`}{" "}
                    (highlighted).
                </p>
            )}

            {invalidCount > 0 && (
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-destructive" role="alert">
                    <span className="flex items-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {invalidCount === 1 ? "1 address isn't valid" : `${invalidCount} addresses aren't valid`}. Hover a red one to see why.
                    </span>
                    <button
                        type="button"
                        onClick={() => onChange(list.filter((e) => !emailProblem(e)).join(", "))}
                        className="font-semibold underline-offset-2 hover:underline"
                    >
                        Remove invalid
                    </button>
                </div>
            )}

            {/* Contact suggestions */}
            {focused && suggestions.length > 0 && (
                <ul
                    role="listbox"
                    className="absolute left-0 top-full z-50 mt-1 w-full max-w-md overflow-hidden rounded-lg border border-border bg-popover py-1 shadow-lg"
                >
                    {suggestions.map((c, i) => (
                        <li
                            key={c.email}
                            role="option"
                            aria-selected={i === highlight}
                            onMouseDown={(e) => {
                                e.preventDefault(); // keep focus in the input
                                commit([c.email]);
                            }}
                            onMouseEnter={() => setHighlight(i)}
                            className={cn(
                                "flex cursor-pointer items-center gap-3 px-3 py-2 text-sm",
                                i === highlight ? "bg-primary/10" : "hover:bg-muted"
                            )}
                        >
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold uppercase text-primary-foreground">
                                {(c.name || c.email).charAt(0)}
                            </span>
                            <span className="min-w-0">
                                <span className="block truncate font-medium text-foreground">{c.name}</span>
                                <span className="block truncate text-xs text-muted-foreground">{c.email}</span>
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
