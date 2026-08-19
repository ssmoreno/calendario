import { auth } from "../src/server/auth";
import { prisma } from "../src/server/db";
import { E2E_ACCOUNTS, E2E_PASSWORD } from "../e2e/credentials";

/** The synthetic principal `localDev()` authenticates during `eve dev`. */
const LOCAL_DEV_USER_ID = "local-dev";

/** Saved up front so local turns and evals never spend one setting it. */
const LOCAL_DEV_TIME_ZONE = "America/Argentina/Buenos_Aires";

async function main() {
  await prisma.user.upsert({
    where: { id: LOCAL_DEV_USER_ID },
    create: {
      id: LOCAL_DEV_USER_ID,
      name: "Local dev",
      email: "local-dev@calendario.invalid",
      emailVerified: true,
    },
    update: {},
  });

  await prisma.userSettings.upsert({
    where: { userId: LOCAL_DEV_USER_ID },
    create: { userId: LOCAL_DEV_USER_ID, timeZone: LOCAL_DEV_TIME_ZONE },
    update: {},
  });

  for (const account of Object.values(E2E_ACCOUNTS)) {
    const existing = await prisma.user.findUnique({
      where: { email: account.email },
    });
    if (existing) continue;
    await auth.api.signUpEmail({
      body: {
        email: account.email,
        password: E2E_PASSWORD,
        name: account.name,
      },
    });
  }

  console.info(`Seeded ${LOCAL_DEV_USER_ID} and the Playwright accounts.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
    return prisma.$disconnect();
  });
