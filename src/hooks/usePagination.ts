import { useState, useMemo } from "react";

export function usePagination<T>(items: T[], pageSize = 10) {
    const [page, setPage] = useState(1);

    const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

    const paginatedItems = useMemo(
        () => items.slice((page - 1) * pageSize, page * pageSize),
        [items, page, pageSize]
    );

    const goTo = (p: number) => setPage(Math.max(1, Math.min(p, totalPages)));

    return {
        page,
        totalPages,
        paginatedItems,
        goTo,
        goNext: () => goTo(page + 1),
        goPrev: () => goTo(page - 1),
        hasNext: page < totalPages,
        hasPrev: page > 1,
        from: (page - 1) * pageSize + 1,
        to: Math.min(page * pageSize, items.length),
        total: items.length,
        reset: () => setPage(1),
    };
}
