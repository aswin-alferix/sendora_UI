import { NextResponse } from "next/server";
import { getCollection } from "@/lib/mongo/client";
import { COLLECTIONS, SignatureDoc } from "@/lib/mongo/schema";
import { getUserIdFromRequest } from "@/lib/mongo/user";

export const dynamic = "force-dynamic";

interface Ctx { params: Promise<{ id: string }> }

export async function PATCH(req: Request, ctx: Ctx) {
    try {
        const userId = getUserIdFromRequest(req);
        const { id } = await ctx.params;
        const body = await req.json();
        const col = await getCollection<SignatureDoc>(COLLECTIONS.signatures);

        // Special-case: setting this signature as default flips others to false
        if (body.isDefault === true) {
            await col.updateMany({ userId }, { $set: { isDefault: false, updatedAt: new Date().toISOString() } });
        }

        const updates: Partial<SignatureDoc> = {
            updatedAt: new Date().toISOString(),
        };
        if (typeof body.name === "string") updates.name = body.name;
        if (typeof body.content === "string") updates.content = body.content;
        if (typeof body.isDefault === "boolean") updates.isDefault = body.isDefault;

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
        const col = await getCollection<SignatureDoc>(COLLECTIONS.signatures);
        const target = await col.findOne({ id, userId });
        if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
        await col.deleteOne({ id, userId });

        // If we deleted the default, promote the oldest remaining signature
        if (target.isDefault) {
            const next = await col.find({ userId }, { sort: { createdAt: 1 } }).limit(1).next();
            if (next) {
                await col.updateOne({ id: next.id }, { $set: { isDefault: true, updatedAt: new Date().toISOString() } });
            }
        }
        return NextResponse.json({ ok: true });
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
    }
}
