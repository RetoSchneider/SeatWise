import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import {
  getOrganizerDashboard,
  listOrganizerPromotions,
} from "@/modules/events/organizer-service";
import { getCurrentUser } from "@/modules/identity/authorization";
import { PromotionForm } from "@/modules/promotions/promotion-form";
import { formatDateTime } from "@/shared/presentation/format";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("organizer.promotionsPage");
  return { title: t("metaTitle") };
}

export default async function PromotionsPage() {
  const t = await getTranslations("organizer.promotionsPage");
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in?callbackURL=/organizer/promotions");
  }
  if (user.role !== "ORGANIZER") {
    redirect("/account");
  }
  const [dashboard, promotions] = await Promise.all([
    getOrganizerDashboard(user.id),
    listOrganizerPromotions(user.id),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <Link href="/organizer" className="text-brand text-sm font-bold">
        {t("back")}
      </Link>
      <h1 className="mt-5 text-3xl font-black tracking-tight">{t("title")}</h1>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <PromotionForm
          events={dashboard.events.map((event) => ({
            id: event.id,
            title: event.title,
          }))}
        />
        <section className="border-line bg-surface rounded-2xl border p-6">
          <h2 className="text-xl font-extrabold">{t("current")}</h2>
          {promotions.length > 0 ? (
            <ul className="divide-line mt-4 divide-y">
              {promotions.map((promotion) => (
                <li key={promotion.id} className="py-4">
                  <div className="flex items-center justify-between gap-3">
                    <code className="text-brand font-black">
                      {promotion.code}
                    </code>
                    <span className="text-xs font-bold">
                      {promotion.active ? t("active") : t("inactive")}
                    </span>
                  </div>
                  <p className="mt-1 text-sm">{promotion.description}</p>
                  <p className="text-muted mt-2 text-xs">
                    {t("promoSummary", {
                      event: promotion.event?.title ?? t("allEvents"),
                      count: promotion._count.redemptions,
                      date: formatDateTime(promotion.endsAt, undefined, locale),
                    })}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted mt-4 text-sm">{t("none")}</p>
          )}
        </section>
      </div>
    </div>
  );
}
