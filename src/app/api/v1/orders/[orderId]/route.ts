import { requireRequestUser } from "@/modules/identity/authorization";
import { getCustomerOrder } from "@/modules/orders/order-query-service";
import { handleApiRequest } from "@/shared/http/api-response";

export function GET(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  return handleApiRequest(request, async () => {
    const user = await requireRequestUser(request);
    const { orderId } = await context.params;
    return { data: await getCustomerOrder(orderId, user.id) };
  });
}
