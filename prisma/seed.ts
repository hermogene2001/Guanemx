import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Baseline seed. It does not create robots, plans, balances, or any
  // performance/market values: those are operator data, never fabricated.
  const room = await prisma.communityRoom.upsert({
    where: { name: "General" },
    create: { name: "General", description: "GuanemX community discussion" },
    update: {},
  });
  console.log(`community room ready: ${room.name} (${room.id})`);

  // Optional bootstrap: point SEED_ADMIN_EMAIL at a registered account to
  // promote it to ADMIN, matching the documented one-off promotion step.
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  if (email) {
    const updated = await prisma.user.updateMany({
      where: { email, role: { not: "ADMIN" } },
      data: { role: "ADMIN", status: "ACTIVE" },
    });
    console.log(
      updated.count > 0
        ? `promoted ${email} to ADMIN`
        : `SEED_ADMIN_EMAIL set, but ${email} was not found or is already an administrator.`,
    );
  } else {
    console.log("SEED_ADMIN_EMAIL is not set; skipping admin promotion.");
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });