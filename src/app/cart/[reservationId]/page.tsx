import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getCurrentUser } from "@/modules/identity/authorization";
import { CartView } from "@/modules/reservations/cart-view";
import { getReservationForUser } from "@/modules/reservations/reservation-service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("cart");
  return { title: t("metaTitle") };
}

export default async function CartPage({
  params,
}: {
  params: Promise<{ reservationId: string }>;
}) {
  const user = await getCurrentUser();
  const { reservationId } = await params;
  if (!user) {
    redirect(
      `/sign-in?callbackURL=${encodeURIComponent(`/cart/${reservationId}`)}`,
    );
  }
  const reservation = await getReservationForUser(reservationId, user.id);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <CartView reservation={reservation} />
    </div>
  );
}
