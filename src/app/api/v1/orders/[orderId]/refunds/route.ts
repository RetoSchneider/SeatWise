import { requireRequestUser } from "@/modules/identity/authorization";
import {
  refundRequestSchema,
  requestRefund,
} from "@/modules/refunds/refund-service";
import { handleApiRequest, parseJson } from "@/shared/http/api-response";

export function POST(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  return handleApiRequest(request, async () => {
    const user = await requireRequestUser(request);
    const { orderId } = await context.params;
    const input = await parseJson(request, refundRequestSchema);
    return {
      data: await requestRefund(orderId, user.id, input.reason),
      status: 201,
    };
  });
}
