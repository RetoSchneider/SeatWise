import {
  eventCatalogSchema,
  listPublishedEvents,
} from "@/modules/events/event-service";
import { handleApiRequest } from "@/shared/http/api-response";

export function GET(request: Request) {
  return handleApiRequest(request, async () => {
    const url = new URL(request.url);
    const query = eventCatalogSchema.parse({
      query: url.searchParams.get("query") ?? undefined,
      category: url.searchParams.get("category") ?? undefined,
      city: url.searchParams.get("city") ?? undefined,
      sort: url.searchParams.get("sort") ?? undefined,
      page: url.searchParams.get("page") ?? undefined,
      pageSize: url.searchParams.get("pageSize") ?? undefined,
    });
    const result = await listPublishedEvents(query);
    return {
      data: result.events,
      meta: result.meta,
    };
  });
}
