import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { EditEventForm } from "@/modules/events/edit-event-form";
import { getOrganizerEvent } from "@/modules/events/organizer-service";
import { getCurrentUser } from "@/modules/identity/authorization";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("organizer.editEvent");
  return { title: t("metaTitle") };
}

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const t = await getTranslations("organizer.editEvent");
  const user = await getCurrentUser();
  const { eventId } = await params;
  if (!user) {
    redirect(
      `/sign-in?callbackURL=${encodeURIComponent(`/organizer/events/${eventId}/edit`)}`,
    );
  }
  if (user.role !== "ORGANIZER") {
    redirect("/account");
  }
  const event = await getOrganizerEvent(user.id, eventId);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <Link href="/organizer" className="text-brand text-sm font-bold">
        {t("back")}
      </Link>
      <h1 className="mt-5 text-3xl font-black tracking-tight">
        {t("title", { title: event.title })}
      </h1>
      <p className="text-muted mt-2 mb-8">{t("intro")}</p>
      <EditEventForm event={event} />
    </div>
  );
}
