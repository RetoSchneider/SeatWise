import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Activity, CalendarCheck, Shield, UsersRound } from "lucide-react";

import { getCurrentUser } from "@/modules/identity/authorization";
import { getAdminDashboard } from "@/modules/users/admin-service";
import { formatDateTime } from "@/shared/presentation/format";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.dashboard");
  return { title: t("metaTitle") };
}

export default async function AdminPage() {
  const t = await getTranslations("admin.dashboard");
  const tc = await getTranslations("common");
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in?callbackURL=/admin");
  }
  if (user.role !== "ADMINISTRATOR") {
    redirect("/account");
  }
  const dashboard = await getAdminDashboard();

  const stats = [
    {
      icon: UsersRound,
      value: dashboard.summary.users,
      label: t("users"),
    },
    {
      icon: Shield,
      value: dashboard.summary.organizers,
      label: t("organizers"),
    },
    {
      icon: CalendarCheck,
      value: dashboard.summary.publishedEvents,
      label: t("publishedEvents"),
    },
    {
      icon: Activity,
      value: dashboard.summary.database,
      label: t("database"),
    },
  ];

  const sections: Array<[string, string]> = [
    ["/admin/users", t("usersLink")],
    ["/admin/events", t("eventsLink")],
    [
      "/admin/refunds",
      t("refundsLink", { count: dashboard.summary.pendingRefunds }),
    ],
    ["/admin/audit", t("auditLink")],
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="text-brand text-sm font-bold">{t("eyebrow")}</p>
      <h1 className="mt-1 text-4xl font-black tracking-tight">{t("title")}</h1>
      <p className="text-muted mt-2">{t("intro")}</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((item) => (
          <article
            key={item.label}
            className="border-line bg-surface rounded-2xl border p-5"
          >
            <item.icon aria-hidden="true" className="text-brand size-6" />
            <p className="mt-4 text-3xl font-black capitalize">{item.value}</p>
            <p className="text-muted text-sm">{item.label}</p>
          </article>
        ))}
      </div>

      <nav aria-label={t("sectionsAria")} className="mt-8">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {sections.map(([href, label]) => (
            <li key={href}>
              <Link
                href={href}
                className="border-line bg-surface hover:bg-accent block rounded-xl border p-4 font-bold"
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <section className="mt-10" aria-labelledby="recent-audit">
        <h2 id="recent-audit" className="text-2xl font-black">
          {t("recentAudit")}
        </h2>
        <div className="border-line bg-surface mt-4 overflow-hidden rounded-2xl border">
          <ul className="divide-line divide-y">
            {dashboard.recentAudit.map((event) => (
              <li
                key={event.id}
                className="grid gap-1 p-4 sm:grid-cols-[1fr_auto]"
              >
                <div>
                  <p className="font-bold">{event.action}</p>
                  <p className="text-muted text-xs">
                    {event.entityType} · {event.entityId} ·{" "}
                    {event.actor?.email ?? tc("system")}
                  </p>
                </div>
                <time className="text-muted text-xs">
                  {formatDateTime(event.createdAt, undefined, locale)}
                </time>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
