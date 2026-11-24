import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getCollection } from "@/lib/mongo/client";
import { COLLECTIONS, ContactDoc } from "@/lib/mongo/schema";
import { getUserIdFromRequest } from "@/lib/mongo/user";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    try {
        const userId = getUserIdFromRequest(req);
        const col = await getCollection<ContactDoc>(COLLECTIONS.contacts);
        const docs = await col.find({ userId }, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray();
        return NextResponse.json({ items: docs });
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const userId = getUserIdFromRequest(req);
        const body = await req.json();
        if (!body.name || !body.email) {
            return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
        }
        const now = new Date().toISOString();
        const doc: ContactDoc = {
            id: randomUUID(),
            userId,
            name: body.name,
            email: body.email,
            company: body.company ?? "",
            role: body.role ?? "",
            groups: Array.isArray(body.groups) ? body.groups : [],
            totalEmails: 0,
            createdAt: now,
            updatedAt: now,
        };
        const col = await getCollection<ContactDoc>(COLLECTIONS.contacts);
        await col.insertOne(doc);
        return NextResponse.json(doc);
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
    }
}
