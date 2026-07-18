import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { EventStatusButton } from "@/modules/events/event-status-button";
import { getCurrentUser } from "@/modules/identity/authorization";
import { listAdminEvents } from "@/modules/users/admin-service";
import { formatDateTime } from "@/shared/presentation/format";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.events");
  return { title: t("metaTitle") };
}

export default async function AdminEventsPage() {
  const t = await getTranslations("admin.events");
  const ts = await getTranslations("status");
  const tos = await getTranslations("admin.userActions");
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?callbackURL=/admin/events");
  if (user.role !== "ADMINISTRATOR") redirect("/account");
  const events = await listAdminEvents();

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <Link href="/admin" className="text-brand text-sm font-bold">
        {t("back")}
      </Link>
      <h1 className="mt-5 text-3xl font-black tracking-tight">{t("title")}</h1>
      <ul className="divide-line border-line bg-surface mt-7 divide-y overflow-hidden rounded-2xl border">
        {events.map((event) => (
          <li
            key={event.id}
            className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center"
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-extrabold">{event.title}</h2>
                <span className="bg-accent text-brand rounded-full px-2 py-0.5 text-xs font-bold">
                  {ts("event", { value: event.status })}
                </span>
              </div>
              <p className="text-muted mt-1 text-sm">
                {event.organizer.displayName} · {event.venue.name},{" "}
                {event.venue.city}
                {event.performances[0]
                  ? ` · ${formatDateTime(event.performances[0].startsAt, undefined, locale)}`
                  : ""}
              </p>
              {event.organizer.status !== "ACTIVE" && (
                <p className="text-warning mt-1 text-xs font-bold">
                  {t("organizerStatus", {
                    status: tos(
                      event.organizer.status === "PENDING"
                        ? "statusPending"
                        : "statusSuspended",
                    ),
                  })}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              {event.status === "PUBLISHED" && (
                <EventStatusButton
                  eventId={event.id}
                  action="UNPUBLISH"
                  scope="admin"
                />
              )}
              {event.status !== "CANCELLED" && (
                <EventStatusButton
                  eventId={event.id}
                  action="CANCEL"
                  scope="admin"
                />
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
