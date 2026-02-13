#!/usr/bin/env npx tsx

/**
 * Promote a user to admin by email.
 * Usage: npx tsx scripts/promote-admin.ts your@email.com
 *
 * Requires NEXT_PRIVATE_DATABASE_URL or DATABASE_URL in .env
 */
import { Role } from '@prisma/client';

import { prisma } from '../packages/prisma';

const email = process.argv[2];
if (!email) {
  console.error('Usage: npx tsx scripts/promote-admin.ts <email>');
  process.exit(1);
}

const main = async () => {
  const user = await prisma.user.findFirst({
    where: { email: email.toLowerCase() },
  });

  if (!user) {
    console.error(`User not found: ${email}`);
    process.exit(1);
  }

  if (user.roles.includes(Role.ADMIN)) {
    console.log(`${email} is already an admin.`);
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      roles: [...user.roles, Role.ADMIN],
    },
  });

  console.log(`Promoted ${email} to admin.`);
};

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
