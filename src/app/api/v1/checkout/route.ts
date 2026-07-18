import { checkout, checkoutSchema } from "@/modules/orders/checkout-service";
import { requireRequestUser } from "@/modules/identity/authorization";
import { ApplicationError } from "@/shared/domain/errors";
import { handleApiRequest, parseJson } from "@/shared/http/api-response";
import { enforceRateLimit } from "@/shared/security/rate-limit";

export function POST(request: Request) {
  return handleApiRequest(request, async () => {
    const user = await requireRequestUser(request);
    await enforceRateLimit({
      subject: user.id,
      action: "checkout",
      limit: 10,
      windowSeconds: 60,
    });
    const idempotencyKey = request.headers.get("idempotency-key");
    if (
      !idempotencyKey ||
      idempotencyKey.length < 8 ||
      idempotencyKey.length > 100
    ) {
      throw new ApplicationError(
        "VALIDATION_ERROR",
        "An Idempotency-Key header between 8 and 100 characters is required",
        400,
      );
    }
    const input = await parseJson(request, checkoutSchema);
    return {
      data: await checkout(user.id, input, idempotencyKey),
      status: 201,
    };
  });
}
