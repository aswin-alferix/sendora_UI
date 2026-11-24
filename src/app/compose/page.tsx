"use client";

import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { ComposeForm } from "@/components/email/ComposeForm";

function readPendingTemplate(): { subject: string; body: string } | null {
    if (typeof window === "undefined") return null;
    const stored = sessionStorage.getItem("pending_compose_template");
    if (!stored) return null;
    sessionStorage.removeItem("pending_compose_template");
    try {
        const parsed = JSON.parse(stored);
        return { subject: parsed.subject ?? "", body: parsed.body ?? "" };
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
        <div className="p-4 md:p-8 max-w-4xl mx-auto">
            <PageHeader
                title="Compose Email"
                description="Create and send a new email"
            />
            <ComposeForm
                initialTo={initialTo}
                initialSubject={template?.subject}
                initialBody={template?.body}
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
