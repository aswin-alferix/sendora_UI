import { NextResponse } from "next/server";
import { getCollection } from "@/lib/mongo/client";
import { COLLECTIONS, EmailDoc } from "@/lib/mongo/schema";
import { getUserIdFromRequest } from "@/lib/mongo/user";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    try {
        const userId = getUserIdFromRequest(req);
        const url = new URL(req.url);
        const status = url.searchParams.get("status"); // optional filter
        const limit = Math.min(parseInt(url.searchParams.get("limit") || "200", 10), 500);

        const filter: { userId: string; status?: EmailDoc["status"] } = { userId };
        if (status === "sent" || status === "scheduled" || status === "failed") {
            filter.status = status;
        }

        const col = await getCollection<EmailDoc>(COLLECTIONS.emails);
        const docs = await col
            .find(filter, { projection: { _id: 0 } })
            .sort({ createdAt: -1 })
            .limit(limit)
            .toArray();
        return NextResponse.json({ items: docs });
    } catch (err) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Failed" },
            { status: 500 }
        );
    }
}
