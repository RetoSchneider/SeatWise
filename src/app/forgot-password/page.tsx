import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ForgotPasswordForm } from "@/modules/identity/password-reset-forms";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.forgot");
  return { title: t("metaTitle") };
}

export default async function ForgotPasswordPage() {
  const t = await getTranslations("auth.forgot");
  return (
    <div className="mx-auto w-full max-w-md px-4 py-16 sm:px-6">
      <div className="border-line bg-surface rounded-2xl border p-6 shadow-sm sm:p-8">
        <p className="text-brand text-sm font-bold">{t("eyebrow")}</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">
          {t("title")}
        </h1>
        <p className="text-muted mt-2 text-sm">{t("intro")}</p>
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
