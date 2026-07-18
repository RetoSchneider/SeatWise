import {
  addVenueSection,
  venueSectionSchema,
} from "@/modules/events/organizer-service";
import { requireRequestUser } from "@/modules/identity/authorization";
import { handleApiRequest, parseJson } from "@/shared/http/api-response";

export function POST(
  request: Request,
  context: { params: Promise<{ venueId: string }> },
) {
  return handleApiRequest(request, async () => {
    const user = await requireRequestUser(request, ["ORGANIZER"]);
    const { venueId } = await context.params;
    const input = await parseJson(request, venueSectionSchema);
    return {
      data: await addVenueSection(user.id, venueId, input),
      status: 201,
    };
  });
}
