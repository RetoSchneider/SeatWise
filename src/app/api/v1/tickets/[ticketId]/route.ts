import { requireRequestUser } from "@/modules/identity/authorization";
import { getCustomerTicket } from "@/modules/orders/order-query-service";
import { handleApiRequest } from "@/shared/http/api-response";

export function GET(
  request: Request,
  context: { params: Promise<{ ticketId: string }> },
) {
  return handleApiRequest(request, async () => {
    const user = await requireRequestUser(request);
    const { ticketId } = await context.params;
    return { data: await getCustomerTicket(ticketId, user.id) };
  });
}
