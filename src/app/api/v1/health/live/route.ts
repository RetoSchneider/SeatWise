import { handleApiRequest } from "@/shared/http/api-response";

export function GET(request: Request) {
  return handleApiRequest(request, async () => ({
    data: {
      status: "ok",
      service: "seatwise-web",
      timestamp: new Date().toISOString(),
    },
  }));
}
