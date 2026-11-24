/**
 * Document shapes stored in MongoDB.
 * `id` is a UUID string (not ObjectId) so the same shape works on the client.
 */

export interface ContactDoc {
    id: string;
    userId: string;
    name: string;
    email: string;
    company: string;
    role: string;
    groups: string[];
    totalEmails: number;
    createdAt: string; // ISO
    updatedAt: string; // ISO
}

export interface TemplateDoc {
    id: string;
    userId: string;
    name: string;
    subject: string;
    description: string;
    body: string;
    createdAt: string;
    updatedAt: string;
}

export interface SignatureDoc {
    id: string;
    userId: string;
    name: string;
    content: string;
    isDefault: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface EmailDoc {
    id: string;
    userId: string;
    provider: "resend" | "sendgrid" | "ses";
    providerMessageId?: string; // id returned by provider
    status: "sent" | "scheduled" | "failed";
    fromName: string;
    fromEmail: string;
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    bodyPreview: string; // first ~200 chars of plaintext
    body: string; // full HTML
    scheduledAt?: string;
    sentAt?: string;
    error?: string;
    createdAt: string;
}

export const COLLECTIONS = {
    contacts: "contacts",
    templates: "templates",
    signatures: "signatures",
    emails: "emails",
} as const;
