import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getCollection } from "@/lib/mongo/client";
import { COLLECTIONS, TemplateDoc } from "@/lib/mongo/schema";
import { getUserIdFromRequest } from "@/lib/mongo/user";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    try {
        const userId = getUserIdFromRequest(req);
        const col = await getCollection<TemplateDoc>(COLLECTIONS.templates);
        const docs = await col.find({ userId }, { projection: { _id: 0 } }).sort({ updatedAt: -1 }).toArray();
        return NextResponse.json({ items: docs });
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const userId = getUserIdFromRequest(req);
        const body = await req.json();
        if (!body.name || !body.subject) {
            return NextResponse.json({ error: "Name and subject are required" }, { status: 400 });
        }
        const now = new Date().toISOString();
        const doc: TemplateDoc = {
            id: randomUUID(),
            userId,
            name: body.name,
            subject: body.subject,
            description: body.description ?? "",
            body: body.body ?? "",
            createdAt: now,
            updatedAt: now,
        };
        const col = await getCollection<TemplateDoc>(COLLECTIONS.templates);
        await col.insertOne(doc);
        return NextResponse.json(doc);
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
    }
}
