import { createHash } from "node:crypto";
import { test as base, expect, type APIRequestContext } from "@playwright/test";

import {
  createScenario,
  removeScenario,
  password,
  type Scenario,
} from "./scenario";

type Fixtures = {
  scenario: Scenario;
  customer: APIRequestContext;
  otherCustomer: APIRequestContext;
  organizer: APIRequestContext;
  administrator: APIRequestContext;
};

export async function signIn(request: APIRequestContext, email: string) {
  const response = await request.post("/api/auth/sign-in/email", {
    data: { email, password },
  });
  await expect(response).toBeOK();
}

function clientHeaders(identity: string) {
  const bytes = createHash("sha256").update(identity).digest();
  return { "x-forwarded-for": `198.18.${bytes[0]}.${bytes[1]}` };
}

export const test = base.extend<Fixtures>({
  page: async ({ page }, provide) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await provide(page);
    expect(errors, "Uncaught browser errors").toEqual([]);
  },
  extraHTTPHeaders: async ({}, provide, testInfo) => {
    await provide(clientHeaders(`${testInfo.testId}-${testInfo.retry}`));
  },
  scenario: async ({}, provide) => {
    const scenario = await createScenario();
    try {
      await provide(scenario);
    } finally {
      await removeScenario(scenario);
    }
  },
  customer: async ({ playwright, baseURL, scenario }, provide) => {
    const request = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: clientHeaders(scenario.customer.id),
    });
    try {
      await signIn(request, scenario.customer.email);
      await provide(request);
    } finally {
      await request.dispose();
    }
  },
  otherCustomer: async ({ playwright, baseURL, scenario }, provide) => {
    const request = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: clientHeaders(scenario.otherCustomer.id),
    });
    try {
      await signIn(request, scenario.otherCustomer.email);
      await provide(request);
    } finally {
      await request.dispose();
    }
  },
  organizer: async ({ playwright, baseURL, scenario }, provide) => {
    const request = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: clientHeaders(scenario.organizerUser.id),
    });
    try {
      await signIn(request, scenario.organizerUser.email);
      await provide(request);
    } finally {
      await request.dispose();
    }
  },
  administrator: async ({ playwright, baseURL, scenario }, provide) => {
    const request = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: clientHeaders(scenario.administrator.id),
    });
    try {
      await signIn(request, scenario.administrator.email);
      await provide(request);
    } finally {
      await request.dispose();
    }
  },
});

export { expect };
