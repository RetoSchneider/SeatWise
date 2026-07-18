import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { getCurrentUser } from "@/modules/identity/authorization";
import { RefundReviewButtons } from "@/modules/refunds/refund-review-buttons";
import { listPendingRefunds } from "@/modules/users/admin-service";
import { formatCurrency, formatDateTime } from "@/shared/presentation/format";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.refunds");
  return { title: t("metaTitle") };
}

export default async function AdminRefundsPage() {
  const t = await getTranslations("admin.refunds");
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?callbackURL=/admin/refunds");
  if (user.role !== "ADMINISTRATOR") redirect("/account");
  const refunds = await listPendingRefunds();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <Link href="/admin" className="text-brand text-sm font-bold">
        {t("back")}
      </Link>
      <h1 className="mt-5 text-3xl font-black tracking-tight">{t("title")}</h1>
      {refunds.length > 0 ? (
        <ul className="divide-line border-line bg-surface mt-7 divide-y overflow-hidden rounded-2xl border">
          {refunds.map((refund) => (
            <li
              key={refund.id}
              className="grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-center"
            >
              <div>
                <p className="font-extrabold">
                  {refund.order.performance.event.title} ·{" "}
                  {refund.requester.name}
                </p>
                <p className="text-muted mt-1 text-sm">{refund.reason}</p>
                <p className="text-muted mt-2 text-xs">
                  {refund.order.organizer.displayName} ·{" "}
                  {formatCurrency(
                    refund.requestedAmountCents,
                    refund.order.currency,
                    locale,
                  )}{" "}
                  · {formatDateTime(refund.createdAt, undefined, locale)}
                </p>
              </div>
              <RefundReviewButtons refundRequestId={refund.id} scope="admin" />
            </li>
          ))}
        </ul>
      ) : (
        <div className="border-line bg-surface mt-7 rounded-2xl border border-dashed p-12 text-center">
          <h2 className="text-xl font-extrabold">{t("emptyTitle")}</h2>
          <p className="text-muted mt-2">{t("emptyText")}</p>
        </div>
      )}
    </div>
  );
}
