import {PrismaClient} from '@prisma/client';
import bcrypt from 'bcryptjs';
const p = new PrismaClient();
async function run() {
  const email = 'hermogenaus@gmail.com';
  const passwordHash = await bcrypt.hash('eTJesZ6rwXg!aTt6jo', 10);
  const u = await p.user.upsert({
    where: { email },
    create: { email, name: 'Hermogene', passwordHash, role: 'ADMIN', status: 'ACTIVE' },
    update: { passwordHash, role: 'ADMIN', status: 'ACTIVE' }
  });
  console.log(u.email, u.role);
  await p.();
}
run();
