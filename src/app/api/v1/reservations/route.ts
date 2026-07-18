import { requireRequestUser } from "@/modules/identity/authorization";
import {
  createReservation,
  createReservationSchema,
} from "@/modules/reservations/reservation-service";
import { handleApiRequest, parseJson } from "@/shared/http/api-response";
import { enforceRateLimit } from "@/shared/security/rate-limit";

export function POST(request: Request) {
  return handleApiRequest(request, async () => {
    const user = await requireRequestUser(request);
    await enforceRateLimit({
      subject: user.id,
      action: "create-reservation",
      limit: 12,
      windowSeconds: 60,
    });
    const input = await parseJson(request, createReservationSchema);
    return {
      data: await createReservation(user.id, input),
      status: 201,
    };
  });
}
