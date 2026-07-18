import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ChevronRight, ReceiptText, Ticket, UserRound } from "lucide-react";

import { getCurrentUser } from "@/modules/identity/authorization";
import {
  listCustomerOrders,
  listCustomerTickets,
} from "@/modules/orders/order-query-service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account");
  return { title: t("metaTitle") };
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ registered?: string }>;
}) {
  const t = await getTranslations("account");
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in?callbackURL=/account");
  }
  const [orders, tickets] = await Promise.all([
    listCustomerOrders(user.id),
    listCustomerTickets(user.id),
  ]);
  const registered = (await searchParams).registered === "1";

  const sections = [
    {
      href: "/account/orders",
      title: t("orderHistoryTitle"),
      text: t("orderHistoryText"),
    },
    {
      href: "/account/tickets",
      title: t("walletTitle"),
      text: t("walletText"),
    },
    {
      href: "/account/profile",
      title: t("profileTitle"),
      text: t("profileText"),
    },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      {registered && (
        <div
          role="status"
          className="border-brand/20 bg-accent mb-6 rounded-xl border p-4 text-sm"
        >
          <p className="text-brand font-bold">{t("readyTitle")}</p>
          <p className="text-muted mt-1">{t("readyText")}</p>
        </div>
      )}
      <p className="text-brand text-sm font-bold">{t("eyebrow")}</p>
      <h1 className="mt-1 text-4xl font-black tracking-tight">
        {t("welcome", { name: user.name })}
      </h1>
      <p className="text-muted mt-2">{user.email}</p>

      <div className="mt-9 grid gap-5 sm:grid-cols-3">
        <article className="border-line bg-surface rounded-2xl border p-5">
          <ReceiptText aria-hidden="true" className="text-brand size-6" />
          <p className="mt-4 text-3xl font-black">{orders.length}</p>
          <p className="text-muted text-sm">{t("orders")}</p>
        </article>
        <article className="border-line bg-surface rounded-2xl border p-5">
          <Ticket aria-hidden="true" className="text-brand size-6" />
          <p className="mt-4 text-3xl font-black">{tickets.length}</p>
          <p className="text-muted text-sm">{t("tickets")}</p>
        </article>
        <article className="border-line bg-surface rounded-2xl border p-5">
          <UserRound aria-hidden="true" className="text-brand size-6" />
          <p className="mt-4 text-base font-black">
            {t("role", { role: user.role })}
          </p>
          <p className="text-muted text-sm">{t("accountRole")}</p>
        </article>
      </div>

      <nav aria-label={t("sectionsAria")} className="mt-9">
        <ul className="divide-line border-line bg-surface divide-y overflow-hidden rounded-2xl border">
          {sections.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="hover:bg-accent/60 flex items-center justify-between gap-4 p-5"
              >
                <span>
                  <span className="block font-extrabold">{item.title}</span>
                  <span className="text-muted mt-1 block text-sm">
                    {item.text}
                  </span>
                </span>
                <ChevronRight
                  aria-hidden="true"
                  className="text-muted size-5 shrink-0"
                />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
