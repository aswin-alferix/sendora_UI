import { NextResponse } from "next/server";
import { getCollection } from "@/lib/mongo/client";
import { COLLECTIONS, TemplateDoc } from "@/lib/mongo/schema";
import { getUserIdFromRequest } from "@/lib/mongo/user";

export const dynamic = "force-dynamic";

interface Ctx { params: Promise<{ id: string }> }

export async function PATCH(req: Request, ctx: Ctx) {
    try {
        const userId = getUserIdFromRequest(req);
        const { id } = await ctx.params;
        const body = await req.json();
        const updates: Partial<TemplateDoc> = {
            updatedAt: new Date().toISOString(),
        };
        if (typeof body.name === "string") updates.name = body.name;
        if (typeof body.subject === "string") updates.subject = body.subject;
        if (typeof body.description === "string") updates.description = body.description;
        if (typeof body.body === "string") updates.body = body.body;

        const col = await getCollection<TemplateDoc>(COLLECTIONS.templates);
        const result = await col.findOneAndUpdate(
            { id, userId },
            { $set: updates },
            { returnDocument: "after", projection: { _id: 0 } }
        );
        if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
        return NextResponse.json(result);
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
    }
}

export async function DELETE(req: Request, ctx: Ctx) {
    try {
        const userId = getUserIdFromRequest(req);
        const { id } = await ctx.params;
        const col = await getCollection<TemplateDoc>(COLLECTIONS.templates);
        const result = await col.deleteOne({ id, userId });
        if (!result.deletedCount) return NextResponse.json({ error: "Not found" }, { status: 404 });
        return NextResponse.json({ ok: true });
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
    }
}
