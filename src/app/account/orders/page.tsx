import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { getCurrentUser } from "@/modules/identity/authorization";
import { listCustomerOrders } from "@/modules/orders/order-query-service";
import { formatCurrency, formatDateTime } from "@/shared/presentation/format";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("orders");
  return { title: t("metaTitle") };
}

export default async function OrdersPage() {
  const t = await getTranslations("orders");
  const ta = await getTranslations("account");
  const ts = await getTranslations("status");
  const tc = await getTranslations("common");
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in?callbackURL=/account/orders");
  }
  const orders = await listCustomerOrders(user.id);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <Link href="/account" className="text-brand text-sm font-bold">
        {ta("backToAccount")}
      </Link>
      <h1 className="mt-5 text-3xl font-black tracking-tight">{t("title")}</h1>
      {orders.length > 0 ? (
        <div className="border-line bg-surface mt-7 overflow-hidden rounded-2xl border">
          <ul className="divide-line divide-y">
            {orders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/account/orders/${order.id}`}
                  className="hover:bg-accent/60 grid gap-3 p-5 sm:grid-cols-[1fr_auto] sm:items-center"
                >
                  <div>
                    <p className="font-extrabold">
                      {order.performance.event.title}
                    </p>
                    <p className="text-muted mt-1 text-sm">
                      {order.orderNumber} ·{" "}
                      {formatDateTime(
                        order.performance.startsAt,
                        order.performance.event.venue.timezone,
                        locale,
                      )}{" "}
                      · {t("ticketCount", { count: order._count.tickets })}
                    </p>
                  </div>
                  <div className="sm:text-right">
                    <p className="font-bold">
                      {formatCurrency(order.totalCents, order.currency, locale)}
                    </p>
                    <p className="text-brand mt-1 text-xs font-bold">
                      {ts("order", { value: order.status })}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="border-line bg-surface mt-7 rounded-2xl border border-dashed p-12 text-center">
          <h2 className="text-xl font-extrabold">{t("emptyTitle")}</h2>
          <p className="text-muted mt-2">{t("emptyText")}</p>
          <Link
            href="/events"
            className="bg-brand mt-5 inline-block px-5 py-2.5 font-bold text-white"
          >
            {tc("browseEvents")}
          </Link>
        </div>
      )}
    </div>
  );
}
