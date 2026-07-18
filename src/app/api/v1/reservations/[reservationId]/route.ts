import { requireRequestUser } from "@/modules/identity/authorization";
import {
  getReservationForUser,
  releaseReservation,
} from "@/modules/reservations/reservation-service";
import { handleApiRequest } from "@/shared/http/api-response";

export function GET(
  request: Request,
  context: { params: Promise<{ reservationId: string }> },
) {
  return handleApiRequest(request, async () => {
    const user = await requireRequestUser(request);
    const { reservationId } = await context.params;
    return {
      data: await getReservationForUser(reservationId, user.id),
    };
  });
}

export function DELETE(
  request: Request,
  context: { params: Promise<{ reservationId: string }> },
) {
  return handleApiRequest(request, async () => {
    const user = await requireRequestUser(request);
    const { reservationId } = await context.params;
    return {
      data: await releaseReservation(reservationId, user.id),
    };
  });
}
