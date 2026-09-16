const databaseUrl = new URL(
  process.env.TEST_DATABASE_URL ??
    "postgresql://seatwise:seatwise@127.0.0.1:55432/seatwise_test?schema=public",
);

if (
  !["localhost", "127.0.0.1", "[::1]"].includes(databaseUrl.hostname) ||
  databaseUrl.pathname !== "/seatwise_test" ||
  !["postgres:", "postgresql:"].includes(databaseUrl.protocol)
) {
  throw new Error(
    "Tests require a local PostgreSQL database named seatwise_test",
  );
}

export const testEnvironment = {
  DATABASE_URL: databaseUrl.toString(),
  BETTER_AUTH_URL: "http://localhost:3100",
  BETTER_AUTH_SECRET: "seatwise-isolated-test-secret-minimum-32-characters",
  TRUSTED_ORIGINS: "http://localhost:3100",
  SMTP_HOST: "127.0.0.1",
  SMTP_PORT: "11025",
  MAILPIT_URL: "http://127.0.0.1:18025",
  PAYMENT_SIMULATOR_DELAY_MS: "50",
  LOG_LEVEL: "warn",
};

Object.assign(process.env, testEnvironment);
