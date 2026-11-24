import { api } from "./client";

export type EmailStatus = "sent" | "pending" | "failed" | "scheduled";

export interface Email {
    id: string;
    to: string;
    cc?: string;
    bcc?: string;
    subject: string;
    body: string;
    status: EmailStatus;
    date: string;
    scheduledAt?: string;
    openCount?: number;
    clickCount?: number;
    templateId?: string;
}

export interface SendEmailPayload {
    to: string;
    cc?: string;
    bcc?: string;
    subject: string;
    body: string;
    templateId?: string;
    scheduledAt?: string;
}

export interface EmailsResponse {
    data: Email[];
    total: number;
    page: number;
    pageSize: number;
}

export interface EmailsParams {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: EmailStatus | "";
}

function buildQuery(params: EmailsParams): string {
    const q = new URLSearchParams();
    if (params.page) q.set("page", String(params.page));
    if (params.pageSize) q.set("pageSize", String(params.pageSize));
    if (params.search) q.set("search", params.search);
    if (params.status) q.set("status", params.status);
    return q.toString() ? `?${q}` : "";
}

export type ActivityType = "sent" | "opened" | "clicked" | "bounced";

export interface ActivityItem {
    id: string;
    action: string;
    target: string;
    timestamp: string;
    type: ActivityType;
    emailId?: string;
}

export interface ActivityResponse {
    data: ActivityItem[];
    total: number;
    page: number;
    pageSize: number;
}

export const emailsApi = {
    send: (payload: SendEmailPayload) =>
        api.post<Email>("/emails/send", payload),
    list: (params: EmailsParams = {}) =>
        api.get<EmailsResponse>(`/emails${buildQuery(params)}`),
    get: (id: string) =>
        api.get<Email>(`/emails/${id}`),
    resend: (id: string) =>
        api.post<Email>(`/emails/${id}/resend`, {}),
    delete: (id: string) =>
        api.delete<void>(`/emails/${id}`),
    bulkDelete: (ids: string[]) =>
        api.post<void>("/emails/bulk-delete", { ids }),
    bulkResend: (ids: string[]) =>
        api.post<void>("/emails/bulk-resend", { ids }),
    exportCsv: (params?: EmailsParams) =>
        api.get<Blob>(`/emails/export${params ? buildQuery(params) : ""}`),

    // Activity / History
    listActivity: (params: { page?: number; pageSize?: number; type?: ActivityType; search?: string } = {}) => {
        const q = new URLSearchParams();
        if (params.page) q.set("page", String(params.page));
        if (params.pageSize) q.set("pageSize", String(params.pageSize));
        if (params.type) q.set("type", params.type);
        if (params.search) q.set("search", params.search);
        return api.get<ActivityResponse>(`/emails/activity${q.toString() ? `?${q}` : ""}`);
    },

    // Dashboard stats
    getDashboardStats: (period?: "7d" | "30d" | "90d") =>
        api.get<{
            totalSent: number;
            deliveryRate: number;
            openRate: number;
            bounced: number;
            scheduledCount: number;
            chartData: Array<{ date: string; sent: number; opened: number; clicked: number }>;
        }>(`/emails/stats${period ? `?period=${period}` : ""}`),
};
