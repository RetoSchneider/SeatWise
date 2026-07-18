import { z } from "zod";

import { requireRequestUser } from "@/modules/identity/authorization";
import { applyPromotionToReservation } from "@/modules/reservations/reservation-service";
import { handleApiRequest, parseJson } from "@/shared/http/api-response";

const promotionInputSchema = z.object({
  code: z.string().trim().min(3).max(30),
});

export function POST(
  request: Request,
  context: { params: Promise<{ reservationId: string }> },
) {
  return handleApiRequest(request, async () => {
    const user = await requireRequestUser(request);
    const { reservationId } = await context.params;
    const input = await parseJson(request, promotionInputSchema);
    return {
      data: await applyPromotionToReservation(
        reservationId,
        user.id,
        input.code,
      ),
    };
  });
}
