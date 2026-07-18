import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getCurrentUser } from "@/modules/identity/authorization";
import { ProfileForm } from "@/modules/users/profile-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("profile");
  return { title: t("metaTitle") };
}

export default async function ProfilePage() {
  const t = await getTranslations("profile");
  const ta = await getTranslations("account");
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in?callbackURL=/account/profile");
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <Link href="/account" className="text-brand text-sm font-bold">
        {ta("backToAccount")}
      </Link>
      <h1 className="mt-5 text-3xl font-black tracking-tight">{t("title")}</h1>
      <div className="border-line bg-surface mt-7 rounded-2xl border p-6">
        <ProfileForm name={user.name} />
        <div className="border-line mt-7 border-t pt-5">
          <p className="text-sm font-bold">{t("emailAddress")}</p>
          <p className="text-muted mt-1 text-sm">{user.email}</p>
          <p className="text-muted mt-2 text-xs">{t("securityNote")}</p>
        </div>
      </div>
    </div>
  );
}
