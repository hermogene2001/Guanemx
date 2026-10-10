import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getCurrentUser, sameOriginRequest } from "@/lib/auth";
import { recordAudit } from "@/lib/finance";
import { prisma } from "@/lib/prisma";

const robotFields = {
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(140).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().min(10).max(5000),
  strategyDescription: z.string().trim().min(10).max(5000),
  market: z.string().trim().min(2).max(80),
  riskLevel: z.string().trim().min(2).max(40),
  robotType: z.string().trim().min(2).max(80),
  tier: z.enum(["BEGINNER", "PRO", "ADVANCED", "VIP"]),
  performanceKind: z.enum(["SIMULATED", "HISTORICAL", "REAL"]).nullable(),
  performanceSummary: z.string().trim().max(3000).nullable(),
};

const planFields = z.object({ name: z.string().trim().min(2).max(100), description: z.string().trim().max(2000).optional().default(""), durationDays: z.coerce.number().int().min(1).max(3650), price: z.coerce.number().positive().max(1000000000000), status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE") });

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("status"), status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"]) }),
  z.object({ action: z.literal("update"), ...robotFields }),
  z.object({ action: z.literal("addPlan"), plan: planFields }),
  z.object({ action: z.literal("planStatus"), planId: z.string().min(1), status: z.enum(["ACTIVE", "INACTIVE"]) }),
]);

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOriginRequest(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "The robot update is invalid." }, { status: 400 });
  const { id } = await params;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const robot = await tx.robot.findUnique({ where: { id }, select: { id: true, name: true, status: true } });
      if (!robot) throw new Error("ROBOT_NOT_FOUND");
      if (parsed.data.action === "status") {
        if (parsed.data.status === "ACTIVE") {
          const activePlans = await tx.robotPlan.count({ where: { robotId: id, status: "ACTIVE" } });
          if (!activePlans) throw new Error("ACTIVE_PLAN_REQUIRED");
        }
        const updated = await tx.robot.update({ where: { id }, data: { status: parsed.data.status } });
        await recordAudit(tx, request, admin.id, "robot.status_changed", "Robot", id, { from: robot.status, to: updated.status });
        return { robot: updated };
      }
      if (parsed.data.action === "update") {
        const data = {
          name: parsed.data.name,
          slug: parsed.data.slug,
          description: parsed.data.description,
          strategyDescription: parsed.data.strategyDescription,
          market: parsed.data.market,
          riskLevel: parsed.data.riskLevel,
          robotType: parsed.data.robotType,
          tier: parsed.data.tier,
          performanceKind: parsed.data.performanceKind,
          performanceSummary: parsed.data.performanceSummary,
        };
        const updated = await tx.robot.update({ where: { id }, data: { ...data, performanceSummary: data.performanceSummary || null } });
        await recordAudit(tx, request, admin.id, "robot.updated", "Robot", id, { name: updated.name, slug: updated.slug });
        return { robot: updated };
      }
      if (parsed.data.action === "addPlan") {
        const { plan } = parsed.data;
        const created = await tx.robotPlan.create({ data: { ...plan, description: plan.description || null, currency: "RWF", price: new Prisma.Decimal(String(plan.price)), robotId: id } });
        await recordAudit(tx, request, admin.id, "robot.plan_created", "RobotPlan", created.id, { robotId: id, name: created.name });
        return { plan: { ...created, price: created.price.toFixed(2) } };
      }
      const changed = await tx.robotPlan.updateMany({ where: { id: parsed.data.planId, robotId: id }, data: { status: parsed.data.status } });
      if (!changed.count) throw new Error("PLAN_NOT_FOUND");
      await recordAudit(tx, request, admin.id, "robot.plan_status_changed", "RobotPlan", parsed.data.planId, { robotId: id, status: parsed.data.status });
      return { planId: parsed.data.planId, status: parsed.data.status };
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "ROBOT_NOT_FOUND") return NextResponse.json({ error: "Robot not found." }, { status: 404 });
    if (error instanceof Error && error.message === "PLAN_NOT_FOUND") return NextResponse.json({ error: "Plan not found for this robot." }, { status: 404 });
    if (error instanceof Error && error.message === "ACTIVE_PLAN_REQUIRED") return NextResponse.json({ error: "Add or activate a plan before publishing this robot." }, { status: 409 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "That robot URL is already in use." }, { status: 409 });
    console.error(JSON.stringify({ event: "admin_robot_update_failed", message: error instanceof Error ? error.message : "unknown error" }));
    return NextResponse.json({ error: "Robot could not be updated." }, { status: 500 });
  }
}
