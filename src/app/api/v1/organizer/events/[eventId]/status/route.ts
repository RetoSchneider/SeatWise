import { z } from "zod";

import { setEventStatus } from "@/modules/events/organizer-service";
import { requireRequestUser } from "@/modules/identity/authorization";
import { handleApiRequest, parseJson } from "@/shared/http/api-response";

const statusSchema = z.object({
  action: z.enum(["PUBLISH", "UNPUBLISH", "CANCEL"]),
});

export function POST(
  request: Request,
  context: { params: Promise<{ eventId: string }> },
) {
  return handleApiRequest(request, async () => {
    const user = await requireRequestUser(request, ["ORGANIZER"]);
    const { eventId } = await context.params;
    const input = await parseJson(request, statusSchema);
    return {
      data: await setEventStatus(user.id, eventId, input.action),
    };
  });
}
