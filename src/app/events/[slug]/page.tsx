import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { CalendarDays, MapPin, RotateCcw } from "lucide-react";

import { getPublishedEvent } from "@/modules/events/event-service";
import { getCurrentUser } from "@/modules/identity/authorization";
import { SeatSelector } from "@/modules/inventory/seat-selector";
import { ApplicationError } from "@/shared/domain/errors";
import { formatDateTime } from "@/shared/presentation/format";

interface EventPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: EventPageProps): Promise<Metadata> {
  try {
    const event = await getPublishedEvent((await params).slug);
    return { title: event.title, description: event.summary };
  } catch {
    const t = await getTranslations("eventDetail");
    return { title: t("metaTitleFallback") };
  }
}

export default async function EventPage({ params }: EventPageProps) {
  const { slug } = await params;
  const t = await getTranslations("eventDetail");
  const locale = await getLocale();
  let event: Awaited<ReturnType<typeof getPublishedEvent>>;
  try {
    event = await getPublishedEvent(slug);
  } catch (error) {
    if (error instanceof ApplicationError && error.status === 404) {
      notFound();
    }
    throw error;
  }
  const user = await getCurrentUser();

  const refundText =
    event.refundPolicy === "NON_REFUNDABLE"
      ? t("refundNonRefundable")
      : event.refundPolicy === "UNTIL_7_DAYS"
        ? t("refundUntil7Days")
        : t("refundUntil24Hours");

  return (
    <>
      <section className="border-line border-b bg-[#173f32] text-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <Link
            href="/events"
            className="text-sm font-bold text-[#b9dfce] hover:text-white"
          >
            {t("allEvents")}
          </Link>
          <p className="mt-8 text-sm font-extrabold tracking-widest text-[#a9dbc4] uppercase">
            {event.category}
          </p>
          <h1 className="mt-3 max-w-4xl text-5xl font-black tracking-[-0.04em] text-balance">
            {event.title}
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-white/75">
            {event.summary}
          </p>
          {event.performances[0] && (
            <dl className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-sm">
              <div className="flex items-center gap-2">
                <CalendarDays
                  aria-hidden="true"
                  className="size-4 text-[#a9dbc4]"
                />
                <dt className="sr-only">{t("nextPerformance")}</dt>
                <dd>
                  {formatDateTime(
                    event.performances[0].startsAt,
                    undefined,
                    locale,
                  )}
                </dd>
              </div>
              <div className="flex items-center gap-2">
                <MapPin aria-hidden="true" className="size-4 text-[#a9dbc4]" />
                <dt className="sr-only">{t("venue")}</dt>
                <dd>{event.venue.name}</dd>
              </div>
            </dl>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1fr_19rem]">
          <section aria-labelledby="about-title">
            <h2 id="about-title" className="text-2xl font-black">
              {t("about")}
            </h2>
            <p className="text-muted mt-4 max-w-3xl leading-7 whitespace-pre-line">
              {event.description}
            </p>
          </section>
          <aside className="border-line bg-surface rounded-2xl border p-5">
            <h2 className="font-extrabold">{event.venue.name}</h2>
            <p className="text-muted mt-2 text-sm leading-6">
              {event.venue.address}
            </p>
            <p className="text-muted mt-4 flex items-start gap-2 text-sm">
              <RotateCcw
                aria-hidden="true"
                className="text-brand mt-0.5 size-4 shrink-0"
              />
              {refundText}
            </p>
          </aside>
        </div>

        <div className="border-line mt-12 border-t pt-12">
          <SeatSelector
            performances={event.performances}
            signedIn={Boolean(user)}
          />
        </div>
      </div>
    </>
  );
}
