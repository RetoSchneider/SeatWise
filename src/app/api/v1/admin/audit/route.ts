import { requireRequestUser } from "@/modules/identity/authorization";
import {
  auditQuerySchema,
  listAuditEvents,
} from "@/modules/users/admin-service";
import { handleApiRequest } from "@/shared/http/api-response";

export function GET(request: Request) {
  return handleApiRequest(request, async () => {
    await requireRequestUser(request, ["ADMINISTRATOR"]);
    const url = new URL(request.url);
    const query = auditQuerySchema.parse({
      action: url.searchParams.get("action") ?? undefined,
      page: url.searchParams.get("page") ?? undefined,
      pageSize: url.searchParams.get("pageSize") ?? undefined,
    });
    const result = await listAuditEvents(query);
    return { data: result.events, meta: result.meta };
  });
}
