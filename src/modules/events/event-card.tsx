import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { CalendarDays, MapPin } from "lucide-react";

import { formatCurrency, formatDateTime } from "@/shared/presentation/format";

interface EventCardProps {
  event: {
    slug: string;
    title: string;
    summary: string;
    category: string;
    venue: { name: string; city: string; region: string; timezone: string };
    nextPerformance: Date;
    startingPriceCents: number | null;
    currency: string;
  };
}

export function EventCard({ event }: EventCardProps) {
  const t = useTranslations("eventCard");
  const locale = useLocale();

  return (
    <article className="group border-line bg-surface relative flex h-full flex-col overflow-hidden rounded-2xl border shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex min-h-36 items-end bg-[linear-gradient(135deg,#0b6145,#173f32)] p-5">
        <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold tracking-wide text-white uppercase">
          {event.category}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-xl font-extrabold tracking-tight">
          <Link
            href={`/events/${event.slug}`}
            className="after:absolute after:inset-0"
          >
            {event.title}
          </Link>
        </h3>
        <p className="text-muted mt-2 line-clamp-2 text-sm">{event.summary}</p>
        <dl className="mt-5 space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <CalendarDays
              aria-hidden="true"
              className="text-brand mt-0.5 size-4 shrink-0"
            />
            <div>
              <dt className="sr-only">{t("dateLabel")}</dt>
              <dd>
                {formatDateTime(
                  event.nextPerformance,
                  event.venue.timezone,
                  locale,
                )}
              </dd>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <MapPin
              aria-hidden="true"
              className="text-brand mt-0.5 size-4 shrink-0"
            />
            <div>
              <dt className="sr-only">{t("venueLabel")}</dt>
              <dd>
                {event.venue.name}, {event.venue.city}
              </dd>
            </div>
          </div>
        </dl>
        <p className="text-brand mt-auto pt-5 text-sm font-bold">
          {event.startingPriceCents === null
            ? t("pricingAtCheckout")
            : t("fromPrice", {
                price: formatCurrency(
                  event.startingPriceCents,
                  event.currency,
                  locale,
                ),
              })}
        </p>
      </div>
    </article>
  );
}
