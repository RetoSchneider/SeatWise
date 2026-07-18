import { requireRequestUser } from "@/modules/identity/authorization";
import { listCustomerTickets } from "@/modules/orders/order-query-service";
import { handleApiRequest } from "@/shared/http/api-response";

export function GET(request: Request) {
  return handleApiRequest(request, async () => {
    const user = await requireRequestUser(request);
    return { data: await listCustomerTickets(user.id) };
  });
}
