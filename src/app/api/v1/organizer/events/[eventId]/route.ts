import {
  updateEvent,
  updateEventSchema,
} from "@/modules/events/organizer-service";
import { requireRequestUser } from "@/modules/identity/authorization";
import { handleApiRequest, parseJson } from "@/shared/http/api-response";

export function PATCH(
  request: Request,
  context: { params: Promise<{ eventId: string }> },
) {
  return handleApiRequest(request, async () => {
    const user = await requireRequestUser(request, ["ORGANIZER"]);
    const { eventId } = await context.params;
    const input = await parseJson(request, updateEventSchema);
    return { data: await updateEvent(user.id, eventId, input) };
  });
}
