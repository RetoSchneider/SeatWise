import { requireRequestUser } from "@/modules/identity/authorization";
import {
  processRefund,
  processRefundSchema,
} from "@/modules/refunds/refund-service";
import { handleApiRequest, parseJson } from "@/shared/http/api-response";

export function POST(
  request: Request,
  context: { params: Promise<{ refundRequestId: string }> },
) {
  return handleApiRequest(request, async () => {
    const user = await requireRequestUser(request, ["ADMINISTRATOR"]);
    const { refundRequestId } = await context.params;
    const input = await parseJson(request, processRefundSchema);
    return {
      data: await processRefund(
        refundRequestId,
        { id: user.id, role: "ADMINISTRATOR" },
        input.decision,
      ),
    };
  });
}
