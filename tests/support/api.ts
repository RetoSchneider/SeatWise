import { randomUUID } from "node:crypto";
import { expect, type APIRequestContext } from "@playwright/test";

import type { Scenario } from "./scenario";

export async function reserveSeat(
  request: APIRequestContext,
  scenario: Scenario,
  seatIndex = 0,
): Promise<string> {
  const response = await request.post("/api/v1/reservations", {
    data: {
      performanceId: scenario.performance.id,
      seatInventoryIds: [scenario.assigned.seatInventory[seatIndex].id],
    },
  });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()).data.id;
}

export async function checkout(
  request: APIRequestContext,
  reservationId: string,
  paymentToken = "pm_success",
  key = randomUUID(),
) {
  return request.post("/api/v1/checkout", {
    headers: { "idempotency-key": key },
    data: { reservationId, paymentToken },
  });
}
