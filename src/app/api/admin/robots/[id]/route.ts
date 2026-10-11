import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getCurrentUser, sameOriginRequest } from "@/lib/auth";
import { recordAudit } from "@/lib/finance";
import { CURRENCY } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { decodeRobotImage } from "@/lib/robot-image";

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
  imageData: z.string().max(2800000).optional(),
  imageContentType: z.enum(["image/jpeg", "image/png", "image/webp"]).optional(),
  removeImage: z.boolean().optional().default(false),
};

const planFields = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(2000).optional().default(""),
  durationDays: z.coerce.number().int().min(1).max(3650),
  price: z.coerce.number().positive().max(1000000000000),
  dailyReturnPercentage: z.coerce.number().min(0).max(100)
    .refine((value) => new Prisma.Decimal(String(value)).decimalPlaces() <= 2, "Daily return must have no more than two decimal places."),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("status"), status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"]) }),
  z.object({ action: z.literal("update"), ...robotFields }).refine(
    (value) => Boolean(value.imageData) === Boolean(value.imageContentType),
    "An image and its content type must be provided together.",
  ),
  z.object({ action: z.literal("addPlan"), plan: planFields })
    .refine((value) => new Prisma.Decimal(String(value.plan.price)).mul(String(value.plan.dailyReturnPercentage)).gte("0.5"), {
      message: "The configured daily return must round to at least the currency's smallest unit.",
      path: ["plan", "dailyReturnPercentage"],
    }),
  z.object({
    action: z.literal("planReturn"),
    planId: z.string().min(1),
    dailyReturnPercentage: z.coerce.number().positive().max(100)
      .refine((value) => new Prisma.Decimal(String(value)).decimalPlaces() <= 2, "Daily return must have no more than two decimal places."),
  }),
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
        const updated = await tx.robot.update({
          where: { id },
          data: { status: parsed.data.status },
          select: { id: true, name: true, status: true },
        });
        await recordAudit(tx, request, admin.id, "robot.status_changed", "Robot", id, { from: robot.status, to: updated.status });
        return { robot: updated };
      }
      if (parsed.data.action === "update") {
        let imageBytes: ReturnType<typeof decodeRobotImage> | undefined;
        if (parsed.data.imageData && parsed.data.imageContentType) {
          try {
            imageBytes = decodeRobotImage(parsed.data.imageData, parsed.data.imageContentType);
          } catch (error) {
            throw new Error(error instanceof Error ? `INVALID_ROBOT_IMAGE:${error.message}` : "INVALID_ROBOT_IMAGE");
          }
        }
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
          ...(imageBytes ? { imageData: imageBytes, imageContentType: parsed.data.imageContentType } : {}),
          ...(parsed.data.removeImage ? { imageData: null, imageContentType: null } : {}),
        };
        const updated = await tx.robot.update({
          where: { id },
          data: { ...data, performanceSummary: data.performanceSummary || null },
          select: { id: true, name: true, slug: true },
        });
        await recordAudit(tx, request, admin.id, "robot.updated", "Robot", id, { name: updated.name, slug: updated.slug, imageChanged: Boolean(imageBytes) || parsed.data.removeImage });
        return { robot: updated };
      }
      if (parsed.data.action === "addPlan") {
        const { plan } = parsed.data;
        const created = await tx.robotPlan.create({ data: { ...plan, description: plan.description || null, currency: CURRENCY, price: new Prisma.Decimal(String(plan.price)), robotId: id } });
        await recordAudit(tx, request, admin.id, "robot.plan_created", "RobotPlan", created.id, { robotId: id, name: created.name });
        return { plan: { ...created, price: created.price.toFixed(2) } };
      }
      if (parsed.data.action === "planReturn") {
        const plan = await tx.robotPlan.findFirst({
          where: { id: parsed.data.planId, robotId: id },
          select: { id: true, name: true, price: true, dailyReturnPercentage: true },
        });
        if (!plan) throw new Error("PLAN_NOT_FOUND");
        const newPercentage = new Prisma.Decimal(String(parsed.data.dailyReturnPercentage));
        const dailyEarning = plan.price.mul(newPercentage).div(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
        if (newPercentage.greaterThan(0) && dailyEarning.lessThanOrEqualTo(0)) throw new Error("DAILY_RETURN_TOO_SMALL");
        await tx.robotPlan.update({
          where: { id: plan.id },
          data: { dailyReturnPercentage: newPercentage },
        });
        await recordAudit(tx, request, admin.id, "robot.plan_return_changed", "RobotPlan", plan.id, {
          robotId: id,
          from: plan.dailyReturnPercentage.toFixed(2),
          to: newPercentage.toFixed(2),
        });
        return { planId: plan.id, dailyReturnPercentage: newPercentage.toFixed(2) };
      }
      const changed = await tx.robotPlan.updateMany({ where: { id: parsed.data.planId, robotId: id }, data: { status: parsed.data.status } });
      if (!changed.count) throw new Error("PLAN_NOT_FOUND");
      await recordAudit(tx, request, admin.id, "robot.plan_status_changed", "RobotPlan", parsed.data.planId, { robotId: id, status: parsed.data.status });
      return { planId: parsed.data.planId, status: parsed.data.status };
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("INVALID_ROBOT_IMAGE:")) return NextResponse.json({ error: error.message.slice("INVALID_ROBOT_IMAGE:".length) }, { status: 400 });
    if (error instanceof Error && error.message === "ROBOT_NOT_FOUND") return NextResponse.json({ error: "Robot not found." }, { status: 404 });
    if (error instanceof Error && error.message === "PLAN_NOT_FOUND") return NextResponse.json({ error: "Plan not found for this robot." }, { status: 404 });
    if (error instanceof Error && error.message === "DAILY_RETURN_TOO_SMALL") return NextResponse.json({ error: "The configured daily return must round to at least the currency's smallest unit." }, { status: 400 });
    if (error instanceof Error && error.message === "ACTIVE_PLAN_REQUIRED") return NextResponse.json({ error: "Add or activate a plan before publishing this robot." }, { status: 409 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "That robot URL is already in use." }, { status: 409 });
    console.error(JSON.stringify({ event: "admin_robot_update_failed", message: error instanceof Error ? error.message : "unknown error" }));
    return NextResponse.json({ error: "Robot could not be updated." }, { status: 500 });
  }
}
