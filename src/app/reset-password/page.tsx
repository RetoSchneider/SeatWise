import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { ResetPasswordForm } from "@/modules/identity/password-reset-forms";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.reset");
  return { title: t("metaTitle") };
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const t = await getTranslations("auth.reset");
  const token = (await searchParams).token;
  return (
    <div className="mx-auto w-full max-w-md px-4 py-16 sm:px-6">
      <div className="border-line bg-surface rounded-2xl border p-6 shadow-sm sm:p-8">
        <p className="text-brand text-sm font-bold">{t("eyebrow")}</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">
          {t("title")}
        </h1>
        {token ? (
          <ResetPasswordForm token={token} />
        ) : (
          <div role="alert" className="mt-7 rounded-xl bg-red-50 p-4">
            <p className="text-danger font-bold">{t("missingTitle")}</p>
            <Link
              href="/forgot-password"
              className="text-brand mt-3 inline-block text-sm font-bold"
            >
              {t("missingLink")}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
