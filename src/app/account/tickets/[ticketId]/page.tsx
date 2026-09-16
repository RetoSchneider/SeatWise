import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import QRCode from "qrcode";

import { getCurrentUser } from "@/modules/identity/authorization";
import { getCustomerTicket } from "@/modules/orders/order-query-service";
import { formatDateTime } from "@/shared/presentation/format";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ticketDetail");
  return { title: t("metaTitle") };
}

export default async function TicketPage({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
  const t = await getTranslations("ticketDetail");
  const ts = await getTranslations("status");
  const locale = await getLocale();
  const user = await getCurrentUser();
  const { ticketId } = await params;
  if (!user) {
    redirect(
      `/sign-in?callbackURL=${encodeURIComponent(`/account/tickets/${ticketId}`)}`,
    );
  }
  const ticket = await getCustomerTicket(ticketId, user.id);
  const qrCode = await QRCode.toDataURL(`seatwise:ticket:${ticket.qrToken}`, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 320,
    color: { dark: "#15221c", light: "#ffffff" },
  });

  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <Link href="/account/tickets" className="text-brand text-sm font-bold">
        {t("backToWallet")}
      </Link>
      <article className="border-line bg-surface mt-6 overflow-hidden rounded-3xl border shadow-lg">
        <div className="bg-[#173f32] p-7 text-white">
          <p className="text-xs font-bold tracking-widest text-[#a9dbc4] uppercase">
            {ts("ticket", { value: ticket.status })}
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">
            {ticket.performance.event.title}
          </h1>
          <p className="mt-3 text-white/75">
            {formatDateTime(
              ticket.performance.startsAt,
              ticket.performance.event.venue.timezone,
              locale,
            )}
          </p>
        </div>
        <div className="p-7">
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted">{t("venue")}</dt>
              <dd className="mt-1 font-bold">
                {ticket.performance.event.venue.name}
              </dd>
            </div>
            <div>
              <dt className="text-muted">{t("doors")}</dt>
              <dd className="mt-1 font-bold">
                {ticket.performance.doorsAt
                  ? formatDateTime(
                      ticket.performance.doorsAt,
                      ticket.performance.event.venue.timezone,
                      locale,
                    )
                  : t("doorsFallback")}
              </dd>
            </div>
            <div>
              <dt className="text-muted">{t("admission")}</dt>
              <dd className="mt-1 font-bold">{ticket.orderLine.description}</dd>
            </div>
            <div>
              <dt className="text-muted">{t("ticketNumber")}</dt>
              <dd className="mt-1 font-mono text-xs font-bold">
                {ticket.ticketNumber}
              </dd>
            </div>
          </dl>
          <div className="border-line mx-auto mt-7 max-w-80 rounded-2xl border bg-white p-3 text-center">
            <Image
              src={qrCode}
              alt={t("qrAlt", { number: ticket.ticketNumber })}
              width={320}
              height={320}
              unoptimized
              className="h-auto w-full"
            />
          </div>
          <p className="text-muted mt-4 text-center text-xs leading-5">
            {t("qrNote")}
          </p>
        </div>
      </article>
    </div>
  );
}
