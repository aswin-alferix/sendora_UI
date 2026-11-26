"use client";

import { ReactNode, useMemo, useState } from "react";
import {
    ArrowDown,
    ArrowUp,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    ChevronsUpDown,
    Columns3,
    Search,
    X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { cellSkeletonWidth } from "@/components/shared/PageSkeletons";

// ─── Types ──────────────────────────────────────────────────────────────────

export type SortValue = string | number | Date | null | undefined;

export interface DataTableColumn<T> {
    id: string;
    header: string;
    cell: (row: T) => ReactNode;
    /** Return a value to make the column sortable. */
    sortValue?: (row: T) => SortValue;
    /** Set false to keep the column out of the "Columns" menu (always shown). */
    hideable?: boolean;
    defaultHidden?: boolean;
    /** Extra classes for the <td> and <th> (e.g. widths, alignment). */
    className?: string;
    headerClassName?: string;
}

export interface DataTableEmptyContext {
    /** True when the search box has text (so "no results" rather than "no data"). */
    searching: boolean;
    clearSearch: () => void;
}

interface DataTableProps<T> {
    data: T[];
    columns: DataTableColumn<T>[];
    getRowId: (row: T) => string;
    loading?: boolean;

    /** Text the search box matches against. Omit to hide the search box. */
    getSearchText?: (row: T) => string;
    searchPlaceholder?: string;
    /**
     * Controlled search: pass both to own the search text. The table then shows the box
     * but does NOT filter: the page filters `data` itself (e.g. alongside other filters).
     */
    search?: string;
    onSearchChange?: (value: string) => void;
    /** Optional row under the toolbar (e.g. active filter chips). */
    subToolbar?: ReactNode;
    /** Toolbar controls placed after the Columns button (e.g. "Clear Filters"). */
    afterColumns?: ReactNode;

    /** Extra toolbar controls placed after search (e.g. a status filter). */
    filters?: ReactNode;
    /** Right-aligned toolbar buttons (Export, Print…). Receives the rows currently selected. */
    actions?: (selectedRows: T[]) => ReactNode;

    selectable?: boolean;
    /** Controlled selection (pass both). Use when the page acts on the selection itself. */
    selectedIds?: Set<string>;
    onSelectedIdsChange?: (ids: Set<string>) => void;
    /** Show the "N selected" pill in the toolbar (default true). */
    showSelectionCount?: boolean;
    /** Per-row actions in the last column (e.g. a ⋮ menu). */
    rowActions?: (row: T) => ReactNode;
    onRowClick?: (row: T) => void;

    emptyState: (ctx: DataTableEmptyContext) => ReactNode;

    initialSort?: { id: string; desc?: boolean };
    pageSizeOptions?: number[];
    defaultPageSize?: number;
    /** Noun for the footer: "Showing 1–10 of 42 {itemLabel}". */
    itemLabel?: string;
}

// ─── Shared styles ──────────────────────────────────────────────────────────

/** Toolbar buttons: same height as the search box. */
export const TOOLBAR_BUTTON = "h-9 gap-2 rounded-lg bg-card px-3.5 text-sm shadow-sm [&_svg]:size-4";

/** Larger, softer checkbox used in tables. */
const CHECKBOX = "h-4 w-4 rounded-[4px] shadow-none [&_svg]:h-3 [&_svg]:w-3";

// ─── Helpers ────────────────────────────────────────────────────────────────

function compareValues(a: SortValue, b: SortValue): number {
    const aEmpty = a === null || a === undefined || a === "";
    const bEmpty = b === null || b === undefined || b === "";
    if (aEmpty || bEmpty) return aEmpty === bEmpty ? 0 : aEmpty ? 1 : -1; // empties last
    if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
    if (typeof a === "number" && typeof b === "number") return a - b;
    return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

/** Up to 5 page numbers centred on the current page. */
function pageWindow(current: number, total: number): number[] {
    const size = Math.min(5, total);
    let start = Math.max(1, current - Math.floor(size / 2));
    start = Math.min(start, total - size + 1);
    return Array.from({ length: size }, (_, i) => start + i);
}

// ─── Component ──────────────────────────────────────────────────────────────

export function DataTable<T>({
    data,
    columns,
    getRowId,
    loading = false,
    getSearchText,
    searchPlaceholder = "Search…",
    search: controlledSearch,
    onSearchChange,
    subToolbar,
    afterColumns,
    filters,
    actions,
    selectable = false,
    selectedIds,
    onSelectedIdsChange,
    showSelectionCount = true,
    rowActions,
    onRowClick,
    emptyState,
    initialSort,
    pageSizeOptions = [10, 25, 50, 100],
    defaultPageSize = 25,
    itemLabel = "items",
}: DataTableProps<T>) {
    const [internalSearch, setInternalSearch] = useState("");
    const searchControlled = onSearchChange !== undefined;
    const search = searchControlled ? controlledSearch ?? "" : internalSearch;
    const setSearch = (v: string) => (searchControlled ? onSearchChange!(v) : setInternalSearch(v));
    const showSearch = searchControlled || !!getSearchText;
    const [sort, setSort] = useState<{ id: string; desc: boolean } | null>(
        initialSort ? { id: initialSort.id, desc: !!initialSort.desc } : null
    );
    const [hidden, setHidden] = useState<Set<string>>(
        () => new Set(columns.filter((c) => c.defaultHidden).map((c) => c.id))
    );
    const [internalSelected, setInternalSelected] = useState<Set<string>>(new Set());
    const selectionControlled = onSelectedIdsChange !== undefined;
    const selected = selectionControlled ? selectedIds ?? new Set<string>() : internalSelected;
    const setSelected = (update: (prev: Set<string>) => Set<string>) => {
        const next = update(selected);
        if (selectionControlled) onSelectedIdsChange!(next);
        else setInternalSelected(next);
    };
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(defaultPageSize);

    const visibleColumns = columns.filter((c) => !hidden.has(c.id));
    const hideableColumns = columns.filter((c) => c.hideable !== false);

    // search → sort
    const rows = useMemo(() => {
        const q = search.trim().toLowerCase();
        let out = q && getSearchText && !searchControlled ? data.filter((r) => getSearchText(r).toLowerCase().includes(q)) : data;
        const sortCol = sort && columns.find((c) => c.id === sort.id);
        if (sortCol?.sortValue) {
            const get = sortCol.sortValue;
            out = [...out].sort((a, b) => {
                const result = compareValues(get(a), get(b));
                return sort!.desc ? -result : result;
            });
        }
        return out;
    }, [data, search, sort, columns, getSearchText, searchControlled]);

    const total = rows.length;
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.min(page, pageCount); // clamp when filters shrink the data
    const pageRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    const from = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const to = Math.min(currentPage * pageSize, total);

    // Only rows still present count as selected (data may have changed).
    const rowIds = useMemo(() => new Set(data.map(getRowId)), [data, getRowId]);
    const selectedRows = data.filter((r) => selected.has(getRowId(r)));
    const pageIds = pageRows.map(getRowId);
    const pageSelectedCount = pageIds.filter((id) => selected.has(id)).length;
    const headerChecked =
        pageIds.length > 0 && pageSelectedCount === pageIds.length
            ? true
            : pageSelectedCount > 0
              ? "indeterminate"
              : false;

    // Uncontrolled: drop ids no longer in the data. Controlled: the page owns the selection, keep it as is.
    const keepValid = (prev: Set<string>) =>
        selectionControlled ? new Set(prev) : new Set([...prev].filter((id) => rowIds.has(id)));

    const toggleSort = (id: string) => {
        setSort((s) => (s?.id !== id ? { id, desc: false } : !s.desc ? { id, desc: true } : null));
    };

    const togglePageSelection = () => {
        setSelected((prev) => {
            const next = keepValid(prev);
            if (headerChecked === true) pageIds.forEach((id) => next.delete(id));
            else pageIds.forEach((id) => next.add(id));
            return next;
        });
    };

    const toggleRow = (id: string) => {
        setSelected((prev) => {
            const next = keepValid(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const clearSearch = () => {
        setSearch("");
        setPage(1);
    };

    const isEmpty = !loading && total === 0;

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
            {/* ─── Toolbar ───────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-3">
                {showSearch && (
                    <div className="relative w-full sm:w-[320px]">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setPage(1);
                            }}
                            placeholder={searchPlaceholder}
                            className="h-9 rounded-lg bg-card pl-9 pr-8 text-sm shadow-sm"
                            aria-label="Search"
                        />
                        {search && (
                            <button
                                type="button"
                                onClick={clearSearch}
                                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                                aria-label="Clear search"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                )}

                {filters}

                {hideableColumns.length > 0 && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className={TOOLBAR_BUTTON}>
                                <Columns3 />
                                Columns
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-52">
                            <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
                                Show columns
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {hideableColumns.map((col) => (
                                <DropdownMenuCheckboxItem
                                    key={col.id}
                                    checked={!hidden.has(col.id)}
                                    onSelect={(e) => e.preventDefault()}
                                    onCheckedChange={(checked) =>
                                        setHidden((prev) => {
                                            const next = new Set(prev);
                                            if (checked) next.delete(col.id);
                                            else if (visibleColumns.length > 1) next.add(col.id); // keep at least one
                                            return next;
                                        })
                                    }
                                >
                                    {col.header}
                                </DropdownMenuCheckboxItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}

                {afterColumns}

                {selectable && showSelectionCount && selectedRows.length > 0 && (
                    <div className="flex h-9 items-center gap-2 rounded-lg bg-primary/10 px-3 text-sm font-medium text-primary">
                        {selectedRows.length} selected
                        <button
                            type="button"
                            onClick={() => setSelected(() => new Set())}
                            className="rounded text-primary/70 hover:text-primary"
                            aria-label="Clear selection"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </div>
                )}

                {actions && <div className="ml-auto flex items-center gap-2">{actions(selectedRows)}</div>}
            </div>

            {subToolbar}

            {/* ─── Table ─────────────────────────────────────────────── */}
            <div className="flex min-h-[360px] flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card">
                <div className={cn("min-h-0 overflow-auto", !isEmpty && "flex-1", loading && "overflow-hidden")}>
                    <table className="w-full border-separate border-spacing-0 text-sm">
                        <thead>
                            <tr>
                                {selectable && (
                                    <th className="sticky top-0 z-10 w-12 bg-primary py-3.5 pl-4 pr-2 text-left">
                                        <Checkbox
                                            checked={headerChecked}
                                            onCheckedChange={togglePageSelection}
                                            disabled={pageRows.length === 0}
                                            aria-label="Select all rows on this page"
                                            className={cn(CHECKBOX, "border-transparent bg-primary-foreground text-primary data-[state=checked]:bg-primary-foreground data-[state=checked]:text-primary data-[state=indeterminate]:bg-primary-foreground data-[state=indeterminate]:text-primary")}
                                        />
                                    </th>
                                )}
                                {visibleColumns.map((col) => {
                                    const sorted = sort?.id === col.id ? (sort.desc ? "desc" : "asc") : null;
                                    return (
                                        <th
                                            key={col.id}
                                            scope="col"
                                            aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                                            className={cn(
                                                "sticky top-0 z-10 whitespace-nowrap bg-primary px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wide text-primary-foreground",
                                                col.className,
                                                col.headerClassName
                                            )}
                                        >
                                            {col.sortValue ? (
                                                <button
                                                    type="button"
                                                    onClick={() => toggleSort(col.id)}
                                                    className="group inline-flex items-center gap-1.5 rounded uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/60"
                                                >
                                                    {col.header}
                                                    {sorted === "asc" ? (
                                                        <ArrowUp className="h-3.5 w-3.5" />
                                                    ) : sorted === "desc" ? (
                                                        <ArrowDown className="h-3.5 w-3.5" />
                                                    ) : (
                                                        <ChevronsUpDown className="h-3.5 w-3.5 opacity-70 transition-opacity group-hover:opacity-100" />
                                                    )}
                                                </button>
                                            ) : (
                                                col.header
                                            )}
                                        </th>
                                    );
                                })}
                                {rowActions && (
                                    <th className="sticky top-0 z-10 w-px bg-primary px-4 py-3.5">
                                        <span className="sr-only">Actions</span>
                                    </th>
                                )}
                            </tr>
                        </thead>
                        {!isEmpty && (
                            <tbody>
                                {loading
                                    ? // One placeholder per column, enough rows to fill the table
                                      Array.from({ length: 14 }, (_, r) => (
                                          <tr key={r}>
                                              {selectable && (
                                                  <td className="w-12 border-b border-border py-3.5 pl-4 pr-2">
                                                      <Skeleton className="h-4 w-4 rounded-[4px]" />
                                                  </td>
                                              )}
                                              {visibleColumns.map((col, c) => (
                                                  <td key={col.id} className={cn("border-b border-border px-4 py-3.5", col.className)}>
                                                      <div className="flex items-center gap-3">
                                                          {c === 0 && <Skeleton className="h-8 w-8 shrink-0 rounded-full" />}
                                                          <Skeleton className={cn("h-4 max-w-full", cellSkeletonWidth(r, c))} />
                                                      </div>
                                                  </td>
                                              ))}
                                              {rowActions && (
                                                  <td className="w-px border-b border-border px-3 py-3.5">
                                                      <Skeleton className="ml-auto h-6 w-6 rounded-md" />
                                                  </td>
                                              )}
                                          </tr>
                                      ))
                                    : pageRows.map((row) => {
                                          const id = getRowId(row);
                                          const isSelected = selected.has(id);
                                          return (
                                              <tr
                                                  key={id}
                                                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                                                  data-state={isSelected ? "selected" : undefined}
                                                  className={cn(
                                                      "group transition-colors hover:bg-muted/50 data-[state=selected]:bg-primary/5",
                                                      onRowClick && "cursor-pointer"
                                                  )}
                                              >
                                                  {selectable && (
                                                      <td className="w-12 border-b border-border py-3.5 pl-4 pr-2" onClick={(e) => e.stopPropagation()}>
                                                          <Checkbox
                                                              checked={isSelected}
                                                              onCheckedChange={() => toggleRow(id)}
                                                              aria-label="Select row"
                                                              className={cn(CHECKBOX, "border-input bg-card")}
                                                          />
                                                      </td>
                                                  )}
                                                  {visibleColumns.map((col) => (
                                                      <td
                                                          key={col.id}
                                                          className={cn("border-b border-border px-4 py-3.5 align-middle text-foreground", col.className)}
                                                      >
                                                          {col.cell(row)}
                                                      </td>
                                                  ))}
                                                  {rowActions && (
                                                      <td className="w-px whitespace-nowrap border-b border-border px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                                                          {rowActions(row)}
                                                      </td>
                                                  )}
                                              </tr>
                                          );
                                      })}
                            </tbody>
                        )}
                    </table>
                </div>

                {isEmpty && (
                    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-12 text-center">
                        {emptyState({ searching: search.trim().length > 0, clearSearch })}
                    </div>
                )}

                {/* ─── Footer ────────────────────────────────────────── */}
                {!loading && total > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-2.5 text-[13px]">
                        <p className="text-muted-foreground">
                            Showing{" "}
                            <span className="font-semibold text-foreground tabular-nums">
                                {from}–{to}
                            </span>{" "}
                            of <span className="font-semibold text-foreground tabular-nums">{total}</span> {itemLabel}
                        </p>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <span className="hidden sm:inline">Per page</span>
                                <Select
                                    value={String(pageSize)}
                                    onValueChange={(v) => {
                                        setPageSize(Number(v));
                                        setPage(1);
                                    }}
                                >
                                    <SelectTrigger className="h-8 w-[68px] rounded-lg text-[13px]" aria-label="Rows per page">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent align="end">
                                        {pageSizeOptions.map((n) => (
                                            <SelectItem key={n} value={String(n)}>
                                                {n}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <nav className="flex items-center gap-1" aria-label="Pagination">
                                <PageButton label="First page" disabled={currentPage === 1} onClick={() => setPage(1)}>
                                    <ChevronsLeft className="h-4 w-4" />
                                </PageButton>
                                <PageButton label="Previous page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
                                    <ChevronLeft className="h-4 w-4" />
                                </PageButton>
                                {pageWindow(currentPage, pageCount).map((n) => (
                                    <PageButton
                                        key={n}
                                        label={`Page ${n}`}
                                        active={n === currentPage}
                                        onClick={() => setPage(n)}
                                    >
                                        {n}
                                    </PageButton>
                                ))}
                                <PageButton label="Next page" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>
                                    <ChevronRight className="h-4 w-4" />
                                </PageButton>
                                <PageButton label="Last page" disabled={currentPage === pageCount} onClick={() => setPage(pageCount)}>
                                    <ChevronsRight className="h-4 w-4" />
                                </PageButton>
                            </nav>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function PageButton({
    children,
    label,
    active,
    disabled,
    onClick,
}: {
    children: ReactNode;
    label: string;
    active?: boolean;
    disabled?: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            className={cn(
                "inline-flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-[13px] font-semibold tabular-nums transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                "disabled:pointer-events-none disabled:opacity-40"
            )}
        >
            {children}
        </button>
    );
}
