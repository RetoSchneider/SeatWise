import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { getCurrentUser } from "@/modules/identity/authorization";
import {
  auditQuerySchema,
  listAuditEvents,
} from "@/modules/users/admin-service";
import { formatDateTime } from "@/shared/presentation/format";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.audit");
  return { title: t("metaTitle") };
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; page?: string }>;
}) {
  const t = await getTranslations("admin.audit");
  const tc = await getTranslations("common");
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?callbackURL=/admin/audit");
  if (user.role !== "ADMINISTRATOR") redirect("/account");
  const params = await searchParams;
  const query = auditQuerySchema.parse(params);
  const result = await listAuditEvents(query);

  function href(page: number) {
    const values = new URLSearchParams({ page: String(page) });
    if (query.action) values.set("action", query.action);
    return `/admin/audit?${values.toString()}`;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <Link href="/admin" className="text-brand text-sm font-bold">
        {t("back")}
      </Link>
      <h1 className="mt-5 text-3xl font-black tracking-tight">{t("title")}</h1>
      <form action="/admin/audit" className="mt-6 flex max-w-xl gap-3">
        <label className="flex-1">
          <span className="sr-only">{t("filterByAction")}</span>
          <input
            name="action"
            defaultValue={query.action}
            placeholder={t("filterByAction")}
            className="border-line h-11 w-full border bg-white px-3"
          />
        </label>
        <button
          type="submit"
          className="bg-brand px-5 py-2 font-bold text-white"
        >
          {t("filter")}
        </button>
      </form>
      <div className="border-line bg-surface mt-7 overflow-x-auto rounded-2xl border">
        <table className="w-full min-w-5xl text-left text-sm">
          <thead className="border-line bg-accent/60 border-b">
            <tr>
              <th scope="col" className="px-4 py-3">
                {t("time")}
              </th>
              <th scope="col" className="px-4 py-3">
                {t("action")}
              </th>
              <th scope="col" className="px-4 py-3">
                {t("actor")}
              </th>
              <th scope="col" className="px-4 py-3">
                {t("entity")}
              </th>
              <th scope="col" className="px-4 py-3">
                {t("metadata")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-line divide-y">
            {result.events.map((event) => (
              <tr key={event.id}>
                <td className="px-4 py-3 text-xs whitespace-nowrap">
                  {formatDateTime(event.createdAt, undefined, locale)}
                </td>
                <td className="px-4 py-3 font-bold">{event.action}</td>
                <td className="px-4 py-3 text-xs">
                  {event.actor?.email ?? tc("system")}
                </td>
                <td className="px-4 py-3 text-xs">
                  {event.entityType}
                  <span className="text-muted block font-mono">
                    {event.entityId}
                  </span>
                </td>
                <td className="text-muted max-w-md px-4 py-3 font-mono text-xs break-all">
                  {JSON.stringify(event.metadata)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <nav
        aria-label={t("pagesAria")}
        className="mt-6 flex items-center justify-center gap-4"
      >
        {query.page > 1 && (
          <Link href={href(query.page - 1)} className="text-brand font-bold">
            {tc("previous")}
          </Link>
        )}
        <span className="text-muted text-sm">
          {tc("pageOf", { page: query.page, total: result.meta.totalPages })}
        </span>
        {query.page < result.meta.totalPages && (
          <Link href={href(query.page + 1)} className="text-brand font-bold">
            {tc("next")}
          </Link>
        )}
      </nav>
    </div>
  );
}
