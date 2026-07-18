import { requireRequestUser } from "@/modules/identity/authorization";
import {
  updateOrganizerStatus,
  updateOrganizerStatusSchema,
} from "@/modules/users/admin-service";
import { handleApiRequest, parseJson } from "@/shared/http/api-response";

export function PATCH(
  request: Request,
  context: { params: Promise<{ organizerId: string }> },
) {
  return handleApiRequest(request, async () => {
    const actor = await requireRequestUser(request, ["ADMINISTRATOR"]);
    const { organizerId } = await context.params;
    const input = await parseJson(request, updateOrganizerStatusSchema);
    return {
      data: await updateOrganizerStatus(actor.id, organizerId, input.status),
    };
  });
}
