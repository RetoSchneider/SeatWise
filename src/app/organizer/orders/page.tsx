import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { listOrganizerOrders } from "@/modules/events/organizer-service";
import { getCurrentUser } from "@/modules/identity/authorization";
import { RefundReviewButtons } from "@/modules/refunds/refund-review-buttons";
import { formatCurrency, formatDateTime } from "@/shared/presentation/format";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("organizer.orders");
  return { title: t("metaTitle") };
}

export default async function OrganizerOrdersPage() {
  const t = await getTranslations("organizer.orders");
  const ts = await getTranslations("status");
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in?callbackURL=/organizer/orders");
  }
  if (user.role !== "ORGANIZER") {
    redirect("/account");
  }
  const orders = await listOrganizerOrders(user.id);
  const refundRequests = orders.flatMap((order) =>
    order.refundRequests
      .filter((request) => request.status === "REQUESTED")
      .map((request) => ({ ...request, order })),
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <Link href="/organizer" className="text-brand text-sm font-bold">
        {t("back")}
      </Link>
      <h1 className="mt-5 text-3xl font-black tracking-tight">{t("title")}</h1>

      <section className="mt-8" aria-labelledby="refunds-heading">
        <h2 id="refunds-heading" className="text-xl font-extrabold">
          {t("refundReview")}
        </h2>
        {refundRequests.length > 0 ? (
          <ul className="divide-line border-line bg-surface mt-4 divide-y overflow-hidden rounded-2xl border">
            {refundRequests.map((refund) => (
              <li
                key={refund.id}
                className="grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-center"
              >
                <div>
                  <p className="font-bold">
                    {refund.order.user.name} ·{" "}
                    {refund.order.performance.event.title}
                  </p>
                  <p className="text-muted mt-1 text-sm">{refund.reason}</p>
                  <p className="text-muted mt-1 text-xs">
                    {t("requestedOn", {
                      amount: formatCurrency(
                        refund.requestedAmountCents,
                        refund.order.currency,
                        locale,
                      ),
                      date: formatDateTime(refund.createdAt, undefined, locale),
                    })}
                  </p>
                </div>
                <RefundReviewButtons
                  refundRequestId={refund.id}
                  scope="organizer"
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted mt-3 text-sm">{t("noRefunds")}</p>
        )}
      </section>

      <section className="mt-10" aria-labelledby="orders-heading">
        <h2 id="orders-heading" className="text-xl font-extrabold">
          {t("recentOrders")}
        </h2>
        {orders.length > 0 ? (
          <div className="border-line bg-surface mt-4 overflow-x-auto rounded-2xl border">
            <table className="w-full min-w-3xl text-left text-sm">
              <thead className="border-line bg-accent/60 border-b">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    {t("order")}
                  </th>
                  <th scope="col" className="px-4 py-3">
                    {t("attendee")}
                  </th>
                  <th scope="col" className="px-4 py-3">
                    {t("event")}
                  </th>
                  <th scope="col" className="px-4 py-3">
                    {t("tickets")}
                  </th>
                  <th scope="col" className="px-4 py-3">
                    {t("total")}
                  </th>
                  <th scope="col" className="px-4 py-3">
                    {t("statusColumn")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-line divide-y">
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td className="px-4 py-3 font-mono text-xs">
                      {order.orderNumber}
                    </td>
                    <td className="px-4 py-3">
                      <span className="block font-bold">{order.user.name}</span>
                      <span className="text-muted text-xs">
                        {order.user.email}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {order.performance.event.title}
                    </td>
                    <td className="px-4 py-3">{order.tickets.length}</td>
                    <td className="px-4 py-3 font-bold">
                      {formatCurrency(order.totalCents, order.currency, locale)}
                    </td>
                    <td className="px-4 py-3 text-xs font-bold">
                      {ts("order", { value: order.status })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted mt-3 text-sm">{t("noOrders")}</p>
        )}
      </section>
    </div>
  );
}
