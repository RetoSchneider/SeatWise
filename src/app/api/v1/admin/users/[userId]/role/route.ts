import { requireRequestUser } from "@/modules/identity/authorization";
import {
  updateUserRole,
  updateUserRoleSchema,
} from "@/modules/users/admin-service";
import { handleApiRequest, parseJson } from "@/shared/http/api-response";

export function PATCH(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  return handleApiRequest(request, async () => {
    const actor = await requireRequestUser(request, ["ADMINISTRATOR"]);
    const { userId } = await context.params;
    const input = await parseJson(request, updateUserRoleSchema);
    return {
      data: await updateUserRole(actor.id, userId, input.role),
    };
  });
}
