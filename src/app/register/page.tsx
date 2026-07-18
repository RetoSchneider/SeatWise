import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getCurrentUser } from "@/modules/identity/authorization";
import { RegisterForm } from "@/modules/identity/register-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.register");
  return { title: t("metaTitle") };
}

export default async function RegisterPage() {
  const t = await getTranslations("auth.register");
  if (await getCurrentUser()) {
    redirect("/account");
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-16 sm:px-6">
      <div className="border-line bg-surface rounded-2xl border p-6 shadow-sm sm:p-8">
        <p className="text-brand text-sm font-bold">{t("eyebrow")}</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">
          {t("title")}
        </h1>
        <p className="text-muted mt-2 text-sm">{t("intro")}</p>
        <RegisterForm />
        <p className="text-muted mt-6 text-center text-sm">
          {t("alreadyRegistered")}{" "}
          <Link href="/sign-in" className="text-brand font-bold">
            {t("signIn")}
          </Link>
        </p>
      </div>
    </div>
  );
}
