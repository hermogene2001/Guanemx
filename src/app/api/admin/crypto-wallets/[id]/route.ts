import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { recordAudit } from "@/lib/finance";
import { prisma } from "@/lib/prisma";

const walletSchema = z.object({
  name: z.string().trim().min(2).max(40),
  network: z.string().trim().min(2).max(60),
  address: z.string().trim().min(8).max(200),
  enabled: z.boolean(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getCurrentUser();
    if (!admin || admin.role !== "ADMIN") return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
    const parsed = walletSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Enter a name, network, and valid wallet address." }, { status: 400 });
    const { id } = await params;
    const updated = await (prisma as any).crypto_wallets.update({ where: { id }, data: { ...parsed.data, updatedAt: new Date() } });
    await recordAudit(prisma, request, admin.id, "crypto_wallet.updated", "CryptoWallet", id, { name: updated.name, network: updated.network, enabled: updated.enabled });
    return NextResponse.json({ wallet: { id: updated.id, name: updated.name, network: updated.network, address: updated.address, enabled: updated.enabled } });
  } catch { return NextResponse.json({ error: "Crypto wallet was not found." }, { status: 404 }); }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getCurrentUser();
    if (!admin || admin.role !== "ADMIN") return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
    const { id } = await params;
    const wallet = await (prisma as any).crypto_wallets.delete({ where: { id } });
    await recordAudit(prisma, request, admin.id, "crypto_wallet.deleted", "CryptoWallet", id, { name: wallet.name, network: wallet.network });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Crypto wallet was not found." }, { status: 404 }); }
}
