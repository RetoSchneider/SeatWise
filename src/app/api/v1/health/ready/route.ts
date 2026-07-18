import { database } from "@/shared/infrastructure/database";
import { handleApiRequest } from "@/shared/http/api-response";

export function GET(request: Request) {
  return handleApiRequest(request, async () => {
    await database.$queryRaw`SELECT 1`;
    return {
      data: {
        status: "ready",
        dependencies: { database: "ready" },
        timestamp: new Date().toISOString(),
      },
    };
  });
}
