"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { ComposeForm } from "@/components/email/ComposeForm";

function ComposeContent() {
    const searchParams = useSearchParams();
    const initialTo = searchParams?.get("to") || "";

    return (
        <div className="p-4 md:p-8 max-w-4xl mx-auto">
            <PageHeader
                title="Compose Email"
                description="Create and send a new email"
            />
            <ComposeForm initialTo={initialTo} />
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
