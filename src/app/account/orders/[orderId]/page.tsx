import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { getCurrentUser } from "@/modules/identity/authorization";
import { getCustomerOrder } from "@/modules/orders/order-query-service";
import { RefundRequestForm } from "@/modules/refunds/refund-request-form";
import { formatCurrency, formatDateTime } from "@/shared/presentation/format";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("orderDetail");
  return { title: t("metaTitle") };
}

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ paid?: string }>;
}) {
  const t = await getTranslations("orderDetail");
  const ts = await getTranslations("status");
  const locale = await getLocale();
  const user = await getCurrentUser();
  const { orderId } = await params;
  if (!user) {
    redirect(
      `/sign-in?callbackURL=${encodeURIComponent(`/account/orders/${orderId}`)}`,
    );
  }
  const [order, query] = await Promise.all([
    getCustomerOrder(orderId, user.id),
    searchParams,
  ]);
  const activeRefund = order.refundRequests.find((refund) =>
    ["REQUESTED", "APPROVED", "PROCESSING"].includes(refund.status),
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <Link href="/account/orders" className="text-brand text-sm font-bold">
        {t("backToOrders")}
      </Link>
      {query.paid === "1" && order.status === "PAID" && (
        <div
          role="status"
          className="border-brand/20 bg-accent mt-5 rounded-xl border p-4"
        >
          <p className="text-brand font-extrabold">{t("paidTitle")}</p>
          <p className="text-muted mt-1 text-sm">{t("paidText")}</p>
        </div>
      )}
      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-brand text-sm font-bold">{order.orderNumber}</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">
            {order.performance.event.title}
          </h1>
          <p className="text-muted mt-2 text-sm">
            {formatDateTime(
              order.performance.startsAt,
              order.performance.event.venue.timezone,
              locale,
            )}{" "}
            · {order.performance.event.venue.name}
          </p>
        </div>
        <span className="bg-accent text-brand rounded-full px-3 py-1.5 text-xs font-extrabold uppercase">
          {ts("order", { value: order.status })}
        </span>
      </div>

      <section className="border-line bg-surface mt-8 rounded-2xl border p-5 sm:p-7">
        <h2 className="text-xl font-extrabold">{t("items")}</h2>
        <div className="divide-line mt-4 divide-y">
          {order.lines.map((line) => (
            <div
              key={line.id}
              className="flex justify-between gap-4 py-4 text-sm"
            >
              <div>
                <p className="font-bold">{line.description}</p>
                <p className="text-muted mt-1">
                  {t("quantity", { count: line.quantity })}
                </p>
              </div>
              <p className="font-bold">
                {formatCurrency(line.totalCents, order.currency, locale)}
              </p>
            </div>
          ))}
        </div>
        <dl className="border-line mt-5 ml-auto max-w-sm space-y-2 border-t pt-5 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">{t("subtotal")}</dt>
            <dd>
              {formatCurrency(order.subtotalCents, order.currency, locale)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">{t("discount")}</dt>
            <dd>
              −{formatCurrency(order.discountCents, order.currency, locale)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">{t("serviceFee")}</dt>
            <dd>{formatCurrency(order.feeCents, order.currency, locale)}</dd>
          </div>
          <div className="border-line flex justify-between border-t pt-3 text-base font-black">
            <dt>{t("total")}</dt>
            <dd>{formatCurrency(order.totalCents, order.currency, locale)}</dd>
          </div>
        </dl>
      </section>

      {order.tickets.length > 0 && (
        <section className="border-line bg-surface mt-6 rounded-2xl border p-5 sm:p-7">
          <h2 className="text-xl font-extrabold">{t("tickets")}</h2>
          <ul className="divide-line mt-4 divide-y">
            {order.tickets.map((ticket) => (
              <li
                key={ticket.id}
                className="flex items-center justify-between gap-4 py-3"
              >
                <span className="text-sm font-bold">{ticket.ticketNumber}</span>
                <Link
                  href={`/account/tickets/${ticket.id}`}
                  className="text-brand text-sm font-bold"
                >
                  {t("viewTicket")}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="border-line bg-surface mt-6 rounded-2xl border p-5 sm:p-7">
        <h2 className="text-xl font-extrabold">{t("refunds")}</h2>
        {activeRefund ? (
          <p className="text-muted mt-3 text-sm">
            {t("refundStatus")}{" "}
            <strong>{ts("refund", { value: activeRefund.status })}</strong>
          </p>
        ) : order.status === "PAID" ? (
          <div className="mt-4">
            <RefundRequestForm orderId={order.id} />
          </div>
        ) : (
          <p className="text-muted mt-3 text-sm">{t("refundUnavailable")}</p>
        )}
      </section>
    </div>
  );
}
