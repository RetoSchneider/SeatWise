import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { CreateEventForm } from "@/modules/events/create-event-form";
import { getOrganizerDashboard } from "@/modules/events/organizer-service";
import { getCurrentUser } from "@/modules/identity/authorization";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("organizer.createEvent");
  return { title: t("metaTitle") };
}

export default async function NewEventPage() {
  const t = await getTranslations("organizer.createEvent");
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in?callbackURL=/organizer/events/new");
  }
  if (user.role !== "ORGANIZER") {
    redirect("/account");
  }
  const dashboard = await getOrganizerDashboard(user.id);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <Link href="/organizer" className="text-brand text-sm font-bold">
        {t("back")}
      </Link>
      <h1 className="mt-5 text-3xl font-black tracking-tight">{t("title")}</h1>
      <p className="text-muted mt-2 mb-8">{t("intro")}</p>
      <CreateEventForm venues={dashboard.venues} />
    </div>
  );
}
