import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight, Clock3, ShieldCheck, TicketCheck } from "lucide-react";

import { EventCard } from "@/modules/events/event-card";
import {
  eventCatalogSchema,
  listPublishedEvents,
} from "@/modules/events/event-service";

export default async function Home() {
  const t = await getTranslations("home");
  const featured = await listPublishedEvents(
    eventCatalogSchema.parse({ pageSize: 3 }),
  );

  const features = [
    {
      icon: TicketCheck,
      title: t("featureAvailabilityTitle"),
      text: t("featureAvailabilityText"),
    },
    {
      icon: Clock3,
      title: t("featureHoldTitle"),
      text: t("featureHoldText"),
    },
    {
      icon: ShieldCheck,
      title: t("featureWalletTitle"),
      text: t("featureWalletText"),
    },
  ];

  return (
    <>
      <section className="border-line bg-accent overflow-hidden border-b">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 md:py-28 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
          <div className="self-center">
            <p className="text-brand mb-4 text-sm font-extrabold tracking-[0.16em] uppercase">
              {t("eyebrow")}
            </p>
            <h1 className="max-w-3xl text-5xl leading-[1.05] font-black tracking-[-0.04em] text-balance sm:text-6xl">
              {t("heroTitle")}
            </h1>
            <p className="text-muted mt-6 max-w-2xl text-lg leading-8">
              {t("heroText")}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/events"
                className="bg-brand hover:bg-brand-dark inline-flex items-center gap-2 px-5 py-3 font-bold text-white"
              >
                {t("findEvent")}
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
              <Link
                href="/register"
                className="border-brand text-brand hover:bg-accent border bg-white px-5 py-3 font-bold"
              >
                {t("createAccount")}
              </Link>
            </div>
          </div>
          <div className="relative hidden min-h-96 lg:block" aria-hidden="true">
            <div className="bg-brand absolute inset-6 rotate-3 rounded-[2.5rem]" />
            <div className="absolute inset-0 flex -rotate-2 flex-col justify-between rounded-[2.5rem] border border-white/60 bg-[#173f32] p-10 text-white shadow-2xl">
              <div>
                <p className="text-sm font-bold tracking-widest text-[#a9dbc4] uppercase">
                  {t("tonight")}
                </p>
                <p className="mt-3 text-4xl font-black">{t("frontRow")}</p>
              </div>
              <div className="grid grid-cols-6 gap-3">
                {Array.from({ length: 24 }, (_, index) => (
                  <span
                    key={index}
                    className={`aspect-square rounded-t-xl ${
                      [2, 8, 15, 16].includes(index)
                        ? "bg-[#d7a76a]"
                        : "bg-white/80"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-brand text-sm font-bold">{t("comingUp")}</p>
            <h2 className="mt-1 text-3xl font-black tracking-tight">
              {t("comingUpTitle")}
            </h2>
          </div>
          <Link
            href="/events"
            className="text-brand hover:text-brand-dark hidden font-bold sm:block"
          >
            {t("viewAll")}
          </Link>
        </div>
        {featured.events.length > 0 ? (
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {featured.events.map((event) => (
              <EventCard event={event} key={event.id} />
            ))}
          </div>
        ) : (
          <div className="border-line bg-surface mt-8 rounded-2xl border border-dashed p-10 text-center">
            <p className="font-bold">{t("emptyTitle")}</p>
            <p className="text-muted mt-1 text-sm">{t("emptyText")}</p>
          </div>
        )}
      </section>

      <section className="border-line bg-surface border-y">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 md:grid-cols-3 lg:px-8">
          {features.map((feature) => (
            <article key={feature.title}>
              <feature.icon aria-hidden="true" className="text-brand size-7" />
              <h2 className="mt-4 text-lg font-extrabold">{feature.title}</h2>
              <p className="text-muted mt-2 text-sm leading-6">
                {feature.text}
              </p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
