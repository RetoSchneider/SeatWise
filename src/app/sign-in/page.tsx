import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getCurrentUser } from "@/modules/identity/authorization";
import { SignInForm } from "@/modules/identity/sign-in-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.signIn");
  return { title: t("metaTitle") };
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackURL?: string }>;
}) {
  const t = await getTranslations("auth.signIn");
  if (await getCurrentUser()) {
    redirect("/account");
  }
  const requestedCallback = (await searchParams).callbackURL;
  const callbackUrl =
    requestedCallback?.startsWith("/") && !requestedCallback.startsWith("//")
      ? requestedCallback
      : "/account";

  return (
    <div className="mx-auto w-full max-w-md px-4 py-16 sm:px-6">
      <div className="border-line bg-surface rounded-2xl border p-6 shadow-sm sm:p-8">
        <p className="text-brand text-sm font-bold">{t("eyebrow")}</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">
          {t("title")}
        </h1>
        <p className="text-muted mt-2 text-sm">{t("intro")}</p>
        <SignInForm callbackUrl={callbackUrl} />
        <p className="text-muted mt-6 text-center text-sm">
          {t("newHere")}{" "}
          <Link href="/register" className="text-brand font-bold">
            {t("createAccount")}
          </Link>
        </p>
      </div>
    </div>
  );
}
