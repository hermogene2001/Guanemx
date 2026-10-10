import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getCurrentUser, sameOriginRequest } from "@/lib/auth";
import { recordAudit } from "@/lib/finance";
import { prisma } from "@/lib/prisma";

const schema = z.object({ email: z.string().trim().email().max(254), phone: z.string().trim().regex(/^\+?[1-9]\d{6,14}$/).optional(), enabled: z.boolean() }).refine((value) => !value.enabled || Boolean(value.phone), "A valid phone number is required when enabling an agent.");

export async function GET() {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  const agents = await prisma.user.findMany({ where: { role: "AGENT" }, select: { id: true, name: true, email: true, phone: true, status: true }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ agents });
}

export async function POST(request: NextRequest) {
  if (!sameOriginRequest(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Enter a registered email, valid phone number, and agent status." }, { status: 400 });
  try {
    const target = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
    if (!target || target.id === admin.id) return NextResponse.json({ error: "Choose an existing user other than your own account." }, { status: 404 });
    if (target.role === "ADMIN") return NextResponse.json({ error: "Administrator accounts cannot be changed from agent management." }, { status: 409 });
    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({ where: { id: target.id }, data: parsed.data.enabled ? { role: "AGENT", status: "ACTIVE", phone: parsed.data.phone } : { role: "USER" }, select: { id: true, name: true, email: true, phone: true, role: true, status: true } });
      await recordAudit(tx, request, admin.id, parsed.data.enabled ? "agent.enabled" : "agent.disabled", "User", target.id, { email: target.email });
      return updated;
    });
    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "That phone number is already in use." }, { status: 409 });
    return NextResponse.json({ error: "Agent access could not be updated." }, { status: 500 });
  }
}
