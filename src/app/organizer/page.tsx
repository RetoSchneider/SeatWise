import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { CalendarPlus, Landmark, ReceiptText, TicketCheck } from "lucide-react";

import { getOrganizerDashboard } from "@/modules/events/organizer-service";
import { EventStatusButton } from "@/modules/events/event-status-button";
import { getCurrentUser } from "@/modules/identity/authorization";
import { formatCurrency, formatDateTime } from "@/shared/presentation/format";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("organizer.dashboard");
  return { title: t("metaTitle") };
}

export default async function OrganizerPage() {
  const t = await getTranslations("organizer.dashboard");
  const ts = await getTranslations("status");
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in?callbackURL=/organizer");
  }
  if (user.role !== "ORGANIZER") {
    redirect("/account");
  }
  const dashboard = await getOrganizerDashboard(user.id);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="text-brand text-sm font-bold">
        {dashboard.organizer.displayName}
      </p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight">{t("title")}</h1>
          <p className="text-muted mt-2">{t("intro")}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/organizer/venues"
            className="border-line bg-surface border px-4 py-2.5 text-sm font-bold"
          >
            {t("manageVenues")}
          </Link>
          <Link
            href="/organizer/events/new"
            className="bg-brand px-4 py-2.5 text-sm font-bold text-white"
          >
            {t("createEvent")}
          </Link>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <article className="border-line bg-surface rounded-2xl border p-5">
          <ReceiptText aria-hidden="true" className="text-brand size-6" />
          <p className="mt-4 text-3xl font-black">
            {dashboard.summary.paidOrders}
          </p>
          <p className="text-muted text-sm">{t("paidOrders")}</p>
        </article>
        <article className="border-line bg-surface rounded-2xl border p-5">
          <TicketCheck aria-hidden="true" className="text-brand size-6" />
          <p className="mt-4 text-3xl font-black">
            {formatCurrency(dashboard.summary.grossSalesCents, "CHF", locale)}
          </p>
          <p className="text-muted text-sm">{t("grossSales")}</p>
        </article>
        <article className="border-line bg-surface rounded-2xl border p-5">
          <Landmark aria-hidden="true" className="text-brand size-6" />
          <p className="mt-4 text-3xl font-black">
            {dashboard.summary.pendingRefunds}
          </p>
          <p className="text-muted text-sm">{t("pendingRefunds")}</p>
        </article>
      </div>

      <nav aria-label={t("toolsAria")} className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/organizer/orders"
          className="text-brand hover:text-brand-dark font-bold"
        >
          {t("ordersLink")}
        </Link>
        <Link
          href="/organizer/promotions"
          className="text-brand hover:text-brand-dark font-bold"
        >
          {t("promotionsLink")}
        </Link>
      </nav>

      <section className="mt-10" aria-labelledby="events-heading">
        <div className="flex items-center justify-between">
          <h2 id="events-heading" className="text-2xl font-black">
            {t("eventsHeading")}
          </h2>
          <CalendarPlus aria-hidden="true" className="text-brand size-6" />
        </div>
        {dashboard.events.length > 0 ? (
          <div className="border-line bg-surface mt-5 overflow-hidden rounded-2xl border">
            <ul className="divide-line divide-y">
              {dashboard.events.map((event) => {
                const nextPerformance = event.performances[0];
                const reservedSeats = event.performances.reduce(
                  (total, performance) =>
                    total +
                    performance.seatInventory.filter(
                      (item) => item.state === "RESERVED",
                    ).length,
                  0,
                );
                const sold =
                  event.performances.reduce(
                    (total, performance) =>
                      total +
                      performance.seatInventory.filter(
                        (item) => item.state === "SOLD",
                      ).length,
                    0,
                  ) +
                  event.performances.reduce(
                    (total, performance) =>
                      total +
                      performance.generalAdmissionInventory.reduce(
                        (sum, inventory) => sum + inventory.sold,
                        0,
                      ),
                    0,
                  );
                return (
                  <li
                    key={event.id}
                    className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-extrabold">{event.title}</h3>
                        <span className="bg-accent text-brand rounded-full px-2 py-0.5 text-xs font-bold">
                          {ts("event", { value: event.status })}
                        </span>
                      </div>
                      <p className="text-muted mt-1 text-sm">
                        {event.venue.name}
                        {nextPerformance
                          ? ` · ${formatDateTime(nextPerformance.startsAt, undefined, locale)}`
                          : ""}
                      </p>
                      <p className="text-muted mt-2 text-xs">
                        {t("soldReserved", {
                          sold,
                          reserved: reservedSeats,
                        })}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {event.status !== "CANCELLED" && (
                        <Link
                          href={`/organizer/events/${event.id}/edit`}
                          className="border-line text-brand px-3 py-1.5 text-xs font-bold"
                        >
                          {t("edit")}
                        </Link>
                      )}
                      {["DRAFT", "UNPUBLISHED"].includes(event.status) && (
                        <EventStatusButton
                          eventId={event.id}
                          action="PUBLISH"
                        />
                      )}
                      {event.status === "PUBLISHED" && (
                        <EventStatusButton
                          eventId={event.id}
                          action="UNPUBLISH"
                        />
                      )}
                      {event.status !== "CANCELLED" && (
                        <EventStatusButton eventId={event.id} action="CANCEL" />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <div className="border-line bg-surface mt-5 rounded-2xl border border-dashed p-10 text-center">
            <p className="font-bold">{t("noEventsTitle")}</p>
            <Link
              href="/organizer/events/new"
              className="text-brand mt-3 inline-block font-bold"
            >
              {t("createFirst")}
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
