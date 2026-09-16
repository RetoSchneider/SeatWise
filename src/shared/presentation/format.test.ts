import { describe, expect, it } from "vitest";

import { formatDate, formatDateTime } from "./format";

describe("date formatting", () => {
  it("uses UTC when a timezone is not provided", () => {
    expect(formatDateTime("2026-07-15T22:30:00Z")).toBe(
      "Jul 15, 2026, 10:30 PM",
    );
    expect(formatDate("2026-07-15T23:30:00Z")).toBe("July 15, 2026");
  });

  it.each([
    ["2026-01-15T18:00:00Z", "Europe/Zurich", "Jan 15, 2026, 7:00 PM"],
    ["2026-07-15T18:00:00Z", "Europe/Zurich", "Jul 15, 2026, 8:00 PM"],
    ["2026-07-15T02:00:00Z", "America/New_York", "Jul 14, 2026, 10:00 PM"],
  ])("formats %s in the venue timezone %s", (value, timezone, expected) => {
    expect(formatDateTime(value, timezone)).toBe(expected);
  });
});
