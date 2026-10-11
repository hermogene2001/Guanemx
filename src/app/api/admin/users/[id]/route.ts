import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { Prisma, UserRole, UserStatus } from "@prisma/client";
import { z } from "zod";
import { getCurrentUser, sameOriginRequest } from "@/lib/auth";
import { recordAudit } from "@/lib/finance";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().max(20).optional().transform((value) => value || null)
    .refine((value) => value === null || /^\+?[1-9]\d{6,14}$/.test(value), "Enter a valid international phone number."),
  role: z.nativeEnum(UserRole),
  status: z.nativeEnum(UserStatus),
  password: z.string().max(72).refine((value) => value === "" || (value.length >= 12 && Buffer.byteLength(value, "utf8") <= 72), "A new password must be at least 12 characters and no more than 72 bytes.").optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOriginRequest(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Enter valid user details." }, { status: 400 });
  const { id } = await params;
  if (id === admin.id && (parsed.data.role !== UserRole.ADMIN || parsed.data.status !== UserStatus.ACTIVE)) {
    return NextResponse.json({ error: "You cannot remove your own administrator access or suspend your own account." }, { status: 409 });
  }

  try {
    const passwordHash = parsed.data.password ? await hash(parsed.data.password, 12) : undefined;
    const updated = await prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({ where: { id }, select: { id: true, name: true, phone: true, role: true, status: true, emailVerifiedAt: true } });
      if (!target) return null;
      const willRemainActiveAdmin = parsed.data.role === UserRole.ADMIN && parsed.data.status === UserStatus.ACTIVE;
      if (target.role === UserRole.ADMIN && target.status === UserStatus.ACTIVE && !willRemainActiveAdmin) {
        const activeAdmins = await tx.user.count({ where: { role: UserRole.ADMIN, status: UserStatus.ACTIVE } });
        if (activeAdmins <= 1) throw new Error("LAST_ACTIVE_ADMIN");
      }

      const user = await tx.user.update({
        where: { id },
        data: {
          name: parsed.data.name,
          phone: parsed.data.phone,
          role: parsed.data.role,
          status: parsed.data.status,
          ...(passwordHash ? { passwordHash } : {}),
          ...(parsed.data.status === UserStatus.ACTIVE && !target.emailVerifiedAt ? { emailVerifiedAt: new Date() } : {}),
        },
        select: { id: true, name: true, email: true, phone: true, role: true, status: true, createdAt: true },
      });
      if (parsed.data.status === UserStatus.SUSPENDED || parsed.data.role !== target.role || passwordHash) {
        await tx.userSession.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      }
      await recordAudit(tx, request, admin.id, "admin.user_updated", "User", id, {
        roleChanged: parsed.data.role !== target.role,
        statusChanged: parsed.data.status !== target.status,
        profileChanged: parsed.data.name !== target.name || parsed.data.phone !== target.phone,
        passwordChanged: Boolean(passwordHash),
      });
      return user;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (!updated) return NextResponse.json({ error: "User not found." }, { status: 404 });
    return NextResponse.json({ user: { ...updated, createdAt: updated.createdAt.toISOString() } });
  } catch (error) {
    if (error instanceof Error && error.message === "LAST_ACTIVE_ADMIN") {
      return NextResponse.json({ error: "The last active administrator cannot be demoted or suspended." }, { status: 409 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "That phone number is already associated with another account." }, { status: 409 });
    }
    console.error(JSON.stringify({ event: "admin_user_update_failed", message: error instanceof Error ? error.message : "unknown error" }));
    return NextResponse.json({ error: "User could not be updated." }, { status: 500 });
  }
}
