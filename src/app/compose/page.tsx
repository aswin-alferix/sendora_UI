"use client";

import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { Mail } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { ComposeForm } from "@/components/email/ComposeForm";
import type { UploadedFile } from "@/lib/files";

function readPendingTemplate(): { subject: string; body: string; attachments: UploadedFile[] } | null {
    if (typeof window === "undefined") return null;
    const stored = sessionStorage.getItem("pending_compose_template");
    if (!stored) return null;
    sessionStorage.removeItem("pending_compose_template");
    try {
        const parsed = JSON.parse(stored);
        return {
            subject: parsed.subject ?? "",
            body: parsed.body ?? "",
            attachments: Array.isArray(parsed.attachments) ? parsed.attachments : [],
        };
    } catch {
        return null;
    }
}

function ComposeContent() {
    const searchParams = useSearchParams();
    const initialTo = searchParams?.get("to") || "";
    // Read once on first render — sessionStorage is cleared after consumption
    const [template] = useState(readPendingTemplate);

    return (
        <div className="flex min-h-[calc(100dvh-4rem)] flex-col px-4 py-6 md:px-8">
            <PageHeader
                icon={Mail}
                title="Compose Email"
                description="Create and send a new email"
            />
            <ComposeForm
                initialTo={initialTo}
                initialSubject={template?.subject}
                initialBody={template?.body}
                initialAttachments={template?.attachments}
            />
        </div>
    );
}

export default function ComposePage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <ComposeContent />
        </Suspense>
    );
}
