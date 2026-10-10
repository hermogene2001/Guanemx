import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getCurrentUser, sameOriginRequest } from "@/lib/auth";
import { recordAudit } from "@/lib/finance";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().max(20).optional().transform((value) => value || null).refine((value) => value === null || /^\+?[1-9]\d{6,14}$/.test(value), "Enter a valid international phone number."),
});

export async function PATCH(request: NextRequest) {
  if (!sameOriginRequest(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to update your profile." }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Enter valid profile details." }, { status: 400 });
  try {
    const updated = await prisma.$transaction(async (tx) => {
      const profile = await tx.user.update({ where: { id: user.id }, data: parsed.data, select: { name: true, email: true, phone: true } });
      await recordAudit(tx, request, user.id, "account.profile_updated", "User", user.id, { phoneUpdated: parsed.data.phone !== undefined });
      return profile;
    });
    return NextResponse.json({ user: updated });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "That phone number is already associated with another account." }, { status: 409 });
    return NextResponse.json({ error: "Profile could not be updated." }, { status: 500 });
  }
}
