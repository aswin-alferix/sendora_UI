import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getCollection } from "@/lib/mongo/client";
import { COLLECTIONS, SignatureDoc } from "@/lib/mongo/schema";
import { getUserIdFromRequest } from "@/lib/mongo/user";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    try {
        const userId = getUserIdFromRequest(req);
        const col = await getCollection<SignatureDoc>(COLLECTIONS.signatures);
        const docs = await col.find({ userId }, { projection: { _id: 0 } }).sort({ createdAt: 1 }).toArray();
        return NextResponse.json({ items: docs });
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const userId = getUserIdFromRequest(req);
        const body = await req.json();
        if (!body.name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

        const col = await getCollection<SignatureDoc>(COLLECTIONS.signatures);
        const existingCount = await col.countDocuments({ userId });
        const now = new Date().toISOString();
        const doc: SignatureDoc = {
            id: randomUUID(),
            userId,
            name: body.name,
            content: body.content ?? "",
            isDefault: existingCount === 0, // first signature becomes default
            createdAt: now,
            updatedAt: now,
        };
        await col.insertOne(doc);
        return NextResponse.json(doc);
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
    }
}
