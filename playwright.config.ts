import { defineConfig, devices } from "@playwright/test";

import { testEnvironment } from "./tests/support/environment";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [
    ["list"],
    ["html", { open: "never" }],
    ["junit", { outputFile: "test-results/results.xml" }],
  ],
  use: {
    baseURL: testEnvironment.BETTER_AUTH_URL,
    locale: "en-US",
    timezoneId: "Europe/Zurich",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "api", testMatch: "api/**/*.spec.ts" },
    {
      name: "chromium",
      testMatch: "ui/**/*.spec.ts",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      testMatch: "ui/**/*.spec.ts",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      testMatch: "ui/**/*.spec.ts",
      use: { ...devices["Desktop Safari"] },
    },
  ],
  webServer: {
    command:
      "node node_modules/next/dist/bin/next build && node node_modules/next/dist/bin/next start --port 3100",
    url: `${testEnvironment.BETTER_AUTH_URL}/api/v1/health/ready`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      ...testEnvironment,
      NODE_ENV: "production",
    },
  },
});
