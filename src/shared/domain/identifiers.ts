import { randomBytes, randomUUID } from "node:crypto";

export interface IdentifierGenerator {
  id(): string;
  token(bytes?: number): string;
}

export const secureIdentifierGenerator: IdentifierGenerator = {
  id: randomUUID,
  token: (bytes = 24) => randomBytes(bytes).toString("base64url"),
};

export function createDisplayNumber(prefix: string, now: Date) {
  const timestamp = now.toISOString().replace(/\D/g, "").slice(2, 14);
  const entropy = randomBytes(3).toString("hex").toUpperCase();
  return `${prefix}-${timestamp}-${entropy}`;
}
