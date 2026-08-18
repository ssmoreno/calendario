import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

import { GOOGLE_CALENDAR_SCOPE } from "@/lib/google-calendar";

import { prisma } from "./db";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  account: { encryptOAuthTokens: true },
  emailAndPassword: { enabled: true },
  socialProviders:
    googleClientId && googleClientSecret
      ? {
          google: {
            clientId: googleClientId,
            clientSecret: googleClientSecret,
            accessType: "offline",
            prompt: "select_account consent",
            scope: [GOOGLE_CALENDAR_SCOPE],
          },
        }
      : {},
});
