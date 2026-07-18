import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { MapPin, Ticket } from "lucide-react";

import { getCurrentUser } from "@/modules/identity/authorization";
import { listCustomerTickets } from "@/modules/orders/order-query-service";
import { formatDateTime } from "@/shared/presentation/format";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("wallet");
  return { title: t("metaTitle") };
}

export default async function TicketsPage() {
  const t = await getTranslations("wallet");
  const ta = await getTranslations("account");
  const ts = await getTranslations("status");
  const tc = await getTranslations("common");
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in?callbackURL=/account/tickets");
  }
  const tickets = await listCustomerTickets(user.id);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <Link href="/account" className="text-brand text-sm font-bold">
        {ta("backToAccount")}
      </Link>
      <h1 className="mt-5 text-3xl font-black tracking-tight">{t("title")}</h1>
      <p className="text-muted mt-2">{t("intro")}</p>
      {tickets.length > 0 ? (
        <div className="mt-7 grid gap-5 sm:grid-cols-2">
          {tickets.map((ticket) => (
            <article
              key={ticket.id}
              className="border-line bg-surface relative overflow-hidden rounded-2xl border shadow-sm"
            >
              <div className="bg-[#173f32] p-5 text-white">
                <p className="text-xs font-bold tracking-widest text-[#a9dbc4] uppercase">
                  {ts("ticket", { value: ticket.status })}
                </p>
                <h2 className="mt-2 text-xl font-black">
                  {ticket.performance.event.title}
                </h2>
              </div>
              <div className="p-5">
                <p className="text-sm font-bold">
                  {formatDateTime(
                    ticket.performance.startsAt,
                    undefined,
                    locale,
                  )}
                </p>
                <p className="text-muted mt-2 flex items-center gap-2 text-sm">
                  <MapPin aria-hidden="true" className="text-brand size-4" />
                  {ticket.performance.event.venue.name},{" "}
                  {ticket.performance.event.venue.city}
                </p>
                <p className="mt-4 text-sm">{ticket.orderLine.description}</p>
                <Link
                  href={`/account/tickets/${ticket.id}`}
                  className="text-brand mt-5 inline-flex items-center gap-2 font-bold after:absolute after:inset-0"
                >
                  <Ticket aria-hidden="true" className="size-4" />
                  {t("openTicket")}
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="border-line bg-surface mt-7 rounded-2xl border border-dashed p-12 text-center">
          <Ticket aria-hidden="true" className="text-brand mx-auto size-8" />
          <h2 className="mt-4 text-xl font-extrabold">{t("emptyTitle")}</h2>
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
