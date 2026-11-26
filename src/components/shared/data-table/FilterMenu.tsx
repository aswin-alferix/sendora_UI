"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Search, SlidersHorizontal, X, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { TOOLBAR_BUTTON } from "./DataTable";

export interface FilterOption {
    value: string;
    label?: string;
    /** How many rows have this value (shown on the right). */
    count?: number;
}

export interface FilterCategory {
    id: string;
    label: string;
    /** Short prefix for the active-filter pills ("Dept" → "Dept: Auditing"). Defaults to label. */
    chipLabel?: string;
    icon?: LucideIcon;
    options: FilterOption[];
    selected: Set<string>;
    onChange: (next: Set<string>) => void;
}

/** Above this many options the value list gets its own search box. */
const SEARCH_THRESHOLD = 8;

/**
 * Two-pane filter menu: categories on the left ("Filter by"), the active
 * category's values as checkboxes on the right. Multi-select within a category.
 */
export function FilterMenu({ categories, onClearAll }: { categories: FilterCategory[]; onClearAll?: () => void }) {
    const [open, setOpen] = useState(false);
    const [activeId, setActiveId] = useState(categories[0]?.id);
    const [query, setQuery] = useState("");

    const active = categories.find((c) => c.id === activeId) ?? categories[0];
    const totalSelected = categories.reduce((n, c) => n + c.selected.size, 0);

    const visibleOptions = useMemo(() => {
        if (!active) return [];
        const q = query.trim().toLowerCase();
        return q ? active.options.filter((o) => (o.label ?? o.value).toLowerCase().includes(q)) : active.options;
    }, [active, query]);

    const switchTo = (id: string) => {
        if (id === activeId) return;
        setActiveId(id);
        setQuery("");
    };

    const toggle = (value: string) => {
        if (!active) return;
        const next = new Set(active.selected);
        if (next.has(value)) next.delete(value);
        else next.add(value);
        active.onChange(next);
    };

    return (
        <>
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    className={cn(
                        TOOLBAR_BUTTON,
                        "relative whitespace-nowrap",
                        (totalSelected > 0 || open) && "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
                    )}
                >
                    <SlidersHorizontal />
                    Filter
                    {totalSelected > 0 && (
                        <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold tabular-nums text-primary-foreground">
                            {totalSelected}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent align="start" sideOffset={6} className="w-[440px] overflow-hidden rounded-xl p-0">
                <div className="grid grid-cols-[176px_1fr]">
                    {/* ── Left: categories ─────────────────────────── */}
                    <div className="border-r border-border">
                        <div className="flex h-10 items-center justify-between border-b border-border px-3">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Filter by</span>
                            {totalSelected > 0 && onClearAll && (
                                <button type="button" onClick={onClearAll} className="text-[11px] font-semibold text-primary hover:underline">
                                    Clear
                                </button>
                            )}
                        </div>
                        <ul className="py-1" role="tablist" aria-orientation="vertical">
                            {categories.map((c) => {
                                const isActive = c.id === active?.id;
                                const Icon = c.icon;
                                return (
                                    <li key={c.id}>
                                        <button
                                            type="button"
                                            role="tab"
                                            aria-selected={isActive}
                                            onMouseEnter={() => switchTo(c.id)}
                                            onFocus={() => switchTo(c.id)}
                                            onClick={() => switchTo(c.id)}
                                            className={cn(
                                                "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors",
                                                isActive ? "bg-primary/10 font-medium text-primary" : "text-foreground hover:bg-muted"
                                            )}
                                        >
                                            {Icon && <Icon className={cn("h-4 w-4 shrink-0", !isActive && "text-muted-foreground")} />}
                                            <span className="flex-1 truncate">{c.label}</span>
                                            {c.selected.size > 0 && (
                                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-label={`${c.selected.size} selected`} />
                                            )}
                                            <ChevronRight className={cn("h-3.5 w-3.5 shrink-0", isActive ? "text-primary" : "text-muted-foreground/60")} />
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>

                    {/* ── Right: values of the active category ─────── */}
                    <div className="flex min-w-0 flex-col">
                        <div className="flex h-10 items-center justify-between border-b border-border px-3">
                            <span className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                {active?.label}
                            </span>
                            {active && active.selected.size > 0 && (
                                <button
                                    type="button"
                                    onClick={() => active.onChange(new Set())}
                                    className="text-[11px] font-semibold text-primary hover:underline"
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                        {active && active.options.length > SEARCH_THRESHOLD && (
                            <div className="relative border-b border-border px-2 py-1.5">
                                <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                                <input
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder={`Search ${active.label.toLowerCase()}…`}
                                    className="h-8 w-full rounded-md bg-muted/50 pl-7 pr-2 text-sm outline-none placeholder:text-muted-foreground focus:bg-muted"
                                />
                            </div>
                        )}
                        <ul className="max-h-[264px] overflow-y-auto py-1" role="listbox" aria-multiselectable="true">
                            {visibleOptions.length === 0 ? (
                                <li className="px-3 py-6 text-center text-xs text-muted-foreground">
                                    {active?.options.length ? "No matches" : `No ${active?.label.toLowerCase()} yet`}
                                </li>
                            ) : (
                                visibleOptions.map((o) => {
                                    const checked = active!.selected.has(o.value);
                                    return (
                                        <li key={o.value}>
                                            <label
                                                className={cn(
                                                    "flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm transition-colors",
                                                    checked ? "bg-primary/10 font-medium text-primary" : "text-foreground hover:bg-muted"
                                                )}
                                            >
                                                <Checkbox
                                                    checked={checked}
                                                    onCheckedChange={() => toggle(o.value)}
                                                    className={cn("h-4 w-4 rounded-[4px] [&_svg]:h-3 [&_svg]:w-3", !checked && "border-input bg-card")}
                                                />
                                                <span className="flex-1 truncate">{o.label ?? o.value}</span>
                                                {o.count !== undefined && (
                                                    <span className="text-xs tabular-nums text-muted-foreground">{o.count}</span>
                                                )}
                                            </label>
                                        </li>
                                    );
                                })
                            )}
                        </ul>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
        </>
    );
}

/** Red "Clear Filters" toolbar button; render it only while filters are active. */
export function ClearFiltersButton({ onClick }: { onClick: () => void }) {
    return (
        <Button
            variant="ghost"
            onClick={onClick}
            className={cn(TOOLBAR_BUTTON, "bg-destructive/10 text-destructive shadow-none hover:bg-destructive/15 hover:text-destructive")}
        >
            <X />
            Clear Filters
        </Button>
    );
}

/** Pills for the active filters ("Dept: Auditing ×"), shown under the toolbar. */
export function ActiveFilterChips({ categories, children }: { categories: FilterCategory[]; children?: React.ReactNode }) {
    const chips = categories.flatMap((c) =>
        [...c.selected].map((value) => ({
            key: `${c.id}:${value}`,
            prefix: c.chipLabel ?? c.label,
            label: c.options.find((o) => o.value === value)?.label ?? value,
            remove: () => {
                const next = new Set(c.selected);
                next.delete(value);
                c.onChange(next);
            },
        }))
    );
    if (chips.length === 0) return null;
    return (
        <div className="-mt-1 flex flex-wrap items-center gap-2">
            {chips.map((chip) => (
                <span
                    key={chip.key}
                    className="inline-flex h-7 items-center gap-1 rounded-full border border-primary/25 bg-primary/5 pl-3 pr-1.5 text-xs"
                >
                    <span className="text-muted-foreground">{chip.prefix}:</span>
                    <span className="max-w-[180px] truncate font-medium text-primary">{chip.label}</span>
                    <button
                        type="button"
                        onClick={chip.remove}
                        className="ml-0.5 rounded-full p-0.5 text-primary/70 hover:bg-primary/10 hover:text-primary"
                        aria-label={`Remove ${chip.prefix}: ${chip.label}`}
                    >
                        <X className="h-3 w-3" />
                    </button>
                </span>
            ))}
            {children}
        </div>
    );
}
