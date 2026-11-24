import { api } from "./client";

export interface Template {
    id: string;
    name: string;
    subject: string;
    description: string;
    body?: string;
    updatedAt: string;
    category?: string;
}

export interface TemplatesResponse {
    data: Template[];
    total: number;
    page: number;
    pageSize: number;
}

export interface TemplatesParams {
    page?: number;
    pageSize?: number;
    search?: string;
    category?: string;
}

function buildQuery(params: TemplatesParams): string {
    const q = new URLSearchParams();
    if (params.page) q.set("page", String(params.page));
    if (params.pageSize) q.set("pageSize", String(params.pageSize));
    if (params.search) q.set("search", params.search);
    if (params.category) q.set("category", params.category);
    return q.toString() ? `?${q}` : "";
}

export const templatesApi = {
    list: (params: TemplatesParams = {}) =>
        api.get<TemplatesResponse>(`/templates${buildQuery(params)}`),
    get: (id: string) =>
        api.get<Template>(`/templates/${id}`),
    create: (data: Omit<Template, "id" | "updatedAt">) =>
        api.post<Template>("/templates", data),
    update: (id: string, data: Partial<Omit<Template, "id" | "updatedAt">>) =>
        api.patch<Template>(`/templates/${id}`, data),
    duplicate: (id: string) =>
        api.post<Template>(`/templates/${id}/duplicate`, {}),
    delete: (id: string) =>
        api.delete<void>(`/templates/${id}`),
};
