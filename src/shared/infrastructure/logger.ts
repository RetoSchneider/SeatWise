import pino from "pino";

import { env } from "@/shared/config/env";

export const logger = pino({
  level: env.LOG_LEVEL,
  base: {
    service: "seatwise-web",
    environment: env.NODE_ENV,
  },
  redact: {
    paths: [
      "password",
      "token",
      "authorization",
      "cookie",
      "req.headers.authorization",
      "req.headers.cookie",
      "*.password",
      "*.token",
    ],
    censor: "[redacted]",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});
