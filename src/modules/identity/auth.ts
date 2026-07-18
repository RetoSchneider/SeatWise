import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

import { env } from "@/shared/config/env";
import { database } from "@/shared/infrastructure/database";
import { logger } from "@/shared/infrastructure/logger";
import { notificationService } from "@/modules/notifications/notification-service";
import { hashPassword, verifyPassword } from "@/modules/identity/password";

const trustedOrigins = env.TRUSTED_ORIGINS.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const auth = betterAuth({
  appName: "SeatWise",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins,
  database: prismaAdapter(database, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    password: {
      hash: hashPassword,
      verify: verifyPassword,
    },
    sendResetPassword: async ({ user, token }) => {
      await notificationService.sendEmail({
        userId: user.id,
        recipient: user.email,
        type: "PASSWORD_RESET",
        subject: "Reset your SeatWise password",
        body: `Use this secure link to reset your password:\n\n${env.BETTER_AUTH_URL}/reset-password?token=${encodeURIComponent(token)}\n\nIf you did not request this, you can ignore this email.`,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await notificationService.sendEmail({
        userId: user.id,
        recipient: user.email,
        type: "EMAIL_VERIFICATION",
        subject: "Verify your SeatWise email",
        body: `Verify your email address to finish setting up SeatWise:\n\n${url}`,
      });
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "CUSTOMER",
        input: false,
      },
      locale: {
        type: "string",
        required: false,
        defaultValue: "en-US",
      },
      currency: {
        type: "string",
        required: false,
        defaultValue: "USD",
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,
    },
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
  },
  advanced: {
    cookiePrefix: "seatwise",
    useSecureCookies: env.NODE_ENV === "production",
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: "lax",
      secure: env.NODE_ENV === "production",
    },
  },
  onAPIError: {
    onError(error) {
      logger.error(
        { error: error instanceof Error ? error.message : "Unknown error" },
        "Authentication request failed",
      );
    },
  },
});
