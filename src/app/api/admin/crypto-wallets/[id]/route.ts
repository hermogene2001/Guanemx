import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, sameOriginRequest } from "@/lib/auth";
import { recordAudit } from "@/lib/finance";
import { prisma } from "@/lib/prisma";

const walletSchema = z.object({
  name: z.string().trim().min(2).max(40),
  network: z.string().trim().min(2).max(60),
  address: z.string().trim().min(8).max(200),
  enabled: z.boolean(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const parsed = walletSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Enter a name, network, and valid wallet address." }, { status: 400 });
  const { id } = await params;
  try {
    const wallet = await prisma.$transaction(async (tx) => {
      const updated = await tx.cryptoWallet.update({ where: { id }, data: parsed.data });
      await recordAudit(tx, request, admin.id, "crypto_wallet.updated", "CryptoWallet", id, { name: updated.name, network: updated.network, enabled: updated.enabled });
      return updated;
    });
    return NextResponse.json({ wallet });
  } catch { return NextResponse.json({ error: "Crypto wallet was not found." }, { status: 404 }); }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  const { id } = await params;
  try {
    await prisma.$transaction(async (tx) => {
      const wallet = await tx.cryptoWallet.delete({ where: { id } });
      await recordAudit(tx, request, admin.id, "crypto_wallet.deleted", "CryptoWallet", id, { name: wallet.name, network: wallet.network });
    });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Crypto wallet was not found." }, { status: 404 }); }
}
