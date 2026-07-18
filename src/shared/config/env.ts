import { z } from "zod";

const environmentSchema = z.object({
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3000"),
  BETTER_AUTH_SECRET: z.string().min(32),
  TRUSTED_ORIGINS: z.string().default("http://localhost:3000"),
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_FROM: z.string().default("SeatWise <tickets@seatwise.local>"),
  MAILPIT_URL: z.string().url().default("http://localhost:8025"),
  RESERVATION_DURATION_MINUTES: z.coerce
    .number()
    .int()
    .min(1)
    .max(30)
    .default(10),
  PAYMENT_SIMULATOR_DELAY_MS: z.coerce
    .number()
    .int()
    .min(0)
    .max(10_000)
    .default(150),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

const parsedEnvironment = environmentSchema.safeParse(process.env);

if (!parsedEnvironment.success) {
  throw new Error(
    `Invalid environment configuration: ${parsedEnvironment.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join(", ")}`,
  );
}

export const env = parsedEnvironment.data;
