import { getPublishedEvent } from "@/modules/events/event-service";
import { handleApiRequest } from "@/shared/http/api-response";

export function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  return handleApiRequest(request, async () => {
    const { slug } = await context.params;
    return { data: await getPublishedEvent(slug) };
  });
}
