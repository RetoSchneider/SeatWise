import { requireRequestUser } from "@/modules/identity/authorization";
import { listPendingRefunds } from "@/modules/users/admin-service";
import { handleApiRequest } from "@/shared/http/api-response";

export function GET(request: Request) {
  return handleApiRequest(request, async () => {
    await requireRequestUser(request, ["ADMINISTRATOR"]);
    return { data: await listPendingRefunds() };
  });
}
