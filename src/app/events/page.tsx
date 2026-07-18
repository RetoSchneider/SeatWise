import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Search, SlidersHorizontal } from "lucide-react";

import { EventCard } from "@/modules/events/event-card";
import {
  eventCatalogSchema,
  listPublishedEvents,
} from "@/modules/events/event-service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("eventsCatalog");
  return { title: t("metaTitle"), description: t("metaDescription") };
}

interface EventsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function single(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

export default async function EventsPage({ searchParams }: EventsPageProps) {
  const t = await getTranslations("eventsCatalog");
  const tc = await getTranslations("common");
  const parameters = await searchParams;
  const query = eventCatalogSchema.parse({
    query: single(parameters.query),
    category: single(parameters.category),
    city: single(parameters.city),
    sort: single(parameters.sort),
    page: single(parameters.page),
  });
  const result = await listPublishedEvents(query);

  function pageHref(page: number) {
    const values = new URLSearchParams();
    if (query.query) values.set("query", query.query);
    if (query.category) values.set("category", query.category);
    if (query.city) values.set("city", query.city);
    values.set("sort", query.sort);
    values.set("page", String(page));
    return `/events?${values.toString()}`;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-2xl">
        <p className="text-brand text-sm font-bold">{t("eyebrow")}</p>
        <h1 className="mt-1 text-4xl font-black tracking-tight">
          {t("title")}
        </h1>
        <p className="text-muted mt-3">{t("intro")}</p>
      </div>

      <form
        action="/events"
        className="border-line bg-surface mt-8 grid gap-3 rounded-2xl border p-4 shadow-sm md:grid-cols-[2fr_1fr_1fr_auto]"
      >
        <label className="relative">
          <span className="sr-only">{t("searchEvents")}</span>
          <Search
            aria-hidden="true"
            className="text-muted absolute top-3.5 left-3 size-4"
          />
          <input
            type="search"
            name="query"
            defaultValue={query.query}
            placeholder={t("searchEvents")}
            className="border-line h-11 w-full border bg-white pr-3 pl-10"
          />
        </label>
        <label>
          <span className="sr-only">{t("category")}</span>
          <input
            name="category"
            defaultValue={query.category}
            placeholder={t("category")}
            className="border-line h-11 w-full border bg-white px-3"
          />
        </label>
        <label>
          <span className="sr-only">{t("city")}</span>
          <input
            name="city"
            defaultValue={query.city}
            placeholder={t("city")}
            className="border-line h-11 w-full border bg-white px-3"
          />
        </label>
        <div className="flex gap-2">
          <label>
            <span className="sr-only">{t("sortEvents")}</span>
            <select
              name="sort"
              defaultValue={query.sort}
              className="border-line h-11 border bg-white px-3"
            >
              <option value="date">{t("sortSoonest")}</option>
              <option value="title">{t("sortTitle")}</option>
            </select>
          </label>
          <button
            type="submit"
            className="bg-brand hover:bg-brand-dark inline-flex h-11 items-center gap-2 px-4 font-bold text-white"
          >
            <SlidersHorizontal aria-hidden="true" className="size-4" />
            {tc("apply")}
          </button>
        </div>
      </form>

      <div className="mt-8 flex items-center justify-between gap-4">
        <p aria-live="polite" className="text-muted text-sm">
          {t("resultCount", { count: result.meta.total })}
        </p>
        {(query.query || query.category || query.city) && (
          <Link href="/events" className="text-brand text-sm font-bold">
            {t("clearFilters")}
          </Link>
        )}
      </div>

      {result.events.length > 0 ? (
        <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {result.events.map((event) => (
            <EventCard event={event} key={event.id} />
          ))}
        </div>
      ) : (
        <div className="border-line bg-surface mt-5 rounded-2xl border border-dashed px-6 py-16 text-center">
          <h2 className="text-xl font-extrabold">{t("noMatchTitle")}</h2>
          <p className="text-muted mt-2">{t("noMatchText")}</p>
        </div>
      )}

      {result.meta.totalPages > 1 && (
        <nav
          aria-label={t("pagesAria")}
          className="mt-10 flex justify-center gap-3"
        >
          {query.page > 1 && (
            <Link
              href={pageHref(query.page - 1)}
              className="border-line bg-surface border px-4 py-2 font-bold"
            >
              {tc("previous")}
            </Link>
          )}
          <span className="text-muted px-4 py-2 text-sm">
            {tc("pageOf", { page: query.page, total: result.meta.totalPages })}
          </span>
          {query.page < result.meta.totalPages && (
            <Link
              href={pageHref(query.page + 1)}
              className="border-line bg-surface border px-4 py-2 font-bold"
            >
              {tc("next")}
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
