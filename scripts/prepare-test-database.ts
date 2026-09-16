import "../tests/support/environment";

import { spawnSync } from "node:child_process";

const result = spawnSync(
  process.execPath,
  ["node_modules/prisma/build/index.js", "migrate", "deploy"],
  {
    stdio: "inherit",
    env: process.env,
  },
);

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
