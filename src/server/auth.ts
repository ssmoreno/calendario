import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

import { GOOGLE_CALENDAR_SCOPE } from "@/lib/google-calendar";

import { prisma } from "./db";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  account: { encryptOAuthTokens: true },
  emailAndPassword: { enabled: process.env.NODE_ENV !== "production" },
  socialProviders:
    googleClientId && googleClientSecret
      ? {
          google: {
            clientId: googleClientId,
            clientSecret: googleClientSecret,
            accessType: "offline",
            // Google only returns a refresh token when it asks for consent, so
            // without this the calendar stops working an hour after each login.
            prompt: "consent",
            scope: [GOOGLE_CALENDAR_SCOPE],
          },
        }
      : {},
});
