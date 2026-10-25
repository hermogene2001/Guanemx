import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
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

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = walletSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a name, network, and valid wallet address." }, { status: 400 });
  }

  const { id } = await params;
  try {
    const wallet = await prisma.cryptoWallet.update({ where: { id }, data: parsed.data });
    await recordAudit(prisma, request, admin.id, "crypto_wallet.updated", "CryptoWallet", id, {
      name: wallet.name,
      network: wallet.network,
      enabled: wallet.enabled,
    });
    return NextResponse.json({ wallet });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Crypto wallet was not found." }, { status: 404 });
    }
    console.error("crypto_wallet_update_failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Crypto wallet could not be updated." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  }

  const { id } = await params;
  try {
    const wallet = await prisma.cryptoWallet.delete({ where: { id } });
    await recordAudit(prisma, request, admin.id, "crypto_wallet.deleted", "CryptoWallet", id, {
      name: wallet.name,
      network: wallet.network,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Crypto wallet was not found." }, { status: 404 });
    }
    console.error("crypto_wallet_delete_failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Crypto wallet could not be removed." }, { status: 500 });
  }
}
