/**
 * Promote a user to admin by email.
 *
 * Usage: npm run promote:admin <email>
 *
 * Example: npm run promote:admin admin@example.com
 *
 * Requires .env (or .env.local) with NEXT_PRIVATE_DATABASE_URL. For production,
 * run locally with DB URL pointing at prod, or use Render Shell.
 */
import { Role } from '@prisma/client';

import { prisma } from '@documenso/prisma';

const email = process.argv[2];

if (!email) {
  console.error('Usage: npx tsx scripts/promote-user-to-admin.ts <email>');
  process.exit(1);
}

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true, email: true, name: true, roles: true },
  });

  if (!user) {
    console.error(`User not found: ${email}`);
    process.exit(1);
  }

  if (user.roles.includes(Role.ADMIN)) {
    console.log(`User ${email} is already an admin.`);
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { roles: [...user.roles, Role.ADMIN] },
  });

  console.log(`Promoted ${email} to admin.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
