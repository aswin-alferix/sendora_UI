import { api } from "./client";

export interface Contact {
    id: string;
    name: string;
    email: string;
    company: string;
    role: string;
    groups: string[];
    totalEmails: number;
}

export interface ContactRole {
    id: string;
    name: string;
    isDefault?: boolean;
}

export interface BulkGroup {
    id: string;
    name: string;
}

export interface ContactsResponse {
    data: Contact[];
    total: number;
    page: number;
    pageSize: number;
}

export interface ContactsParams {
    page?: number;
    pageSize?: number;
    search?: string;
    role?: string;
    group?: string;
    company?: string;
}

function buildQuery(params: ContactsParams): string {
    const q = new URLSearchParams();
    if (params.page) q.set("page", String(params.page));
    if (params.pageSize) q.set("pageSize", String(params.pageSize));
    if (params.search) q.set("search", params.search);
    if (params.role) q.set("role", params.role);
    if (params.group) q.set("group", params.group);
    if (params.company) q.set("company", params.company);
    return q.toString() ? `?${q}` : "";
}

export const contactsApi = {
    list: (params: ContactsParams = {}) =>
        api.get<ContactsResponse>(`/contacts${buildQuery(params)}`),
    get: (id: string) =>
        api.get<Contact>(`/contacts/${id}`),
    create: (data: Omit<Contact, "id" | "totalEmails">) =>
        api.post<Contact>("/contacts", data),
    update: (id: string, data: Partial<Omit<Contact, "id">>) =>
        api.patch<Contact>(`/contacts/${id}`, data),
    delete: (id: string) =>
        api.delete<void>(`/contacts/${id}`),
    bulkDelete: (ids: string[]) =>
        api.post<void>("/contacts/bulk-delete", { ids }),
    bulkAssignGroups: (ids: string[], groups: string[]) =>
        api.post<void>("/contacts/bulk-assign-groups", { ids, groups }),
    exportCsv: () =>
        api.get<Blob>("/contacts/export"),
    importCsv: (file: File) => {
        const form = new FormData();
        form.append("file", file);
        return fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api"}/contacts/import`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${localStorage.getItem("auth_token") ?? ""}`,
            },
            body: form,
        }).then((r) => r.json());
    },

    // Roles
    listRoles: () => api.get<ContactRole[]>("/contacts/roles"),
    createRole: (name: string) => api.post<ContactRole>("/contacts/roles", { name }),
    updateRole: (id: string, name: string) => api.patch<ContactRole>(`/contacts/roles/${id}`, { name }),
    deleteRole: (id: string) => api.delete<void>(`/contacts/roles/${id}`),

    // Groups
    listGroups: () => api.get<BulkGroup[]>("/contacts/groups"),
    createGroup: (name: string) => api.post<BulkGroup>("/contacts/groups", { name }),
    updateGroup: (id: string, name: string) => api.patch<BulkGroup>(`/contacts/groups/${id}`, { name }),
    deleteGroup: (id: string) => api.delete<void>(`/contacts/groups/${id}`),
    reorderGroups: (ids: string[]) => api.post<void>("/contacts/groups/reorder", { ids }),
};
