import {
  createEvent,
  createEventSchema,
} from "@/modules/events/organizer-service";
import { requireRequestUser } from "@/modules/identity/authorization";
import { handleApiRequest, parseJson } from "@/shared/http/api-response";

export function POST(request: Request) {
  return handleApiRequest(request, async () => {
    const user = await requireRequestUser(request, ["ORGANIZER"]);
    const input = await parseJson(request, createEventSchema);
    return { data: await createEvent(user.id, input), status: 201 };
  });
}
