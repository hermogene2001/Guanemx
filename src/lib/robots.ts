import { RobotStatus, PlanStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const activePlanSelection = {
  where: { status: PlanStatus.ACTIVE },
  orderBy: { price: "asc" as const },
  select: { id: true, name: true, description: true, durationDays: true, price: true, currency: true },
};

export async function getActiveRobots(filters?: { query?: string; risk?: string; type?: string }) {
  const where: Prisma.RobotWhereInput = {
    status: RobotStatus.ACTIVE,
    ...(filters?.query ? { OR: [
      { name: { contains: filters.query, mode: "insensitive" } },
      { strategyDescription: { contains: filters.query, mode: "insensitive" } },
    ] } : {}),
    ...(filters?.risk ? { riskLevel: filters.risk } : {}),
    ...(filters?.type ? { robotType: filters.type } : {}),
  };
  const rows = await prisma.robot.findMany({
    where,
    orderBy: { name: "asc" },
    include: { plans: activePlanSelection },
  });
  return rows.filter((robot) => robot.plans.length > 0);
}

export async function getActiveRobot(slug: string) {
  return prisma.robot.findFirst({
    where: { slug, status: RobotStatus.ACTIVE },
    include: { plans: activePlanSelection, _count: { select: { subscriptions: true } } },
  });
}
