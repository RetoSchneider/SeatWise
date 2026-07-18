import { z } from "zod";

import { requireRequestUser } from "@/modules/identity/authorization";
import { moderateEvent } from "@/modules/users/admin-service";
import { handleApiRequest, parseJson } from "@/shared/http/api-response";

const moderationSchema = z.object({
  action: z.enum(["UNPUBLISH", "CANCEL"]),
});

export function POST(
  request: Request,
  context: { params: Promise<{ eventId: string }> },
) {
  return handleApiRequest(request, async () => {
    const actor = await requireRequestUser(request, ["ADMINISTRATOR"]);
    const { eventId } = await context.params;
    const input = await parseJson(request, moderationSchema);
    return { data: await moderateEvent(actor.id, eventId, input.action) };
  });
}
