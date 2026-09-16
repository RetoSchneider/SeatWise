import { describe, expect, it } from "vitest";

import { safeCallbackUrl } from "./callback-url";

describe("sign-in callbacks", () => {
  it.each([
    undefined,
    "https://untrusted.example",
    "//untrusted.example",
    "/\\untrusted.example",
    "/\n/untrusted.example",
  ])("rejects external destination %s", (value) => {
    expect(safeCallbackUrl(value)).toBe("/account");
  });

  it("preserves internal paths, queries, and fragments", () => {
    expect(safeCallbackUrl("/events/concert?source=sign-in#seats")).toBe(
      "/events/concert?source=sign-in#seats",
    );
  });
});
