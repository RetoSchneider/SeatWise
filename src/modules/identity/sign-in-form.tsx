"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { authClient } from "@/modules/identity/auth-client";

export function SignInForm({ callbackUrl }: { callbackUrl: string }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    const result = await authClient.signIn.email({
      email,
      password,
      rememberMe: true,
    });

    if (result.error) {
      setError(t("signIn.invalid"));
      setPending(false);
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="mt-7 space-y-5">
      <label className="block">
        <span className="text-sm font-bold">{t("emailAddress")}</span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          className="border-line mt-2 h-11 w-full border bg-white px-3"
        />
      </label>
      <label className="block">
        <span className="text-sm font-bold">{t("password")}</span>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          minLength={12}
          className="border-line mt-2 h-11 w-full border bg-white px-3"
        />
      </label>
      <div className="text-right">
        <Link
          href="/forgot-password"
          className="text-brand hover:text-brand-dark text-sm font-bold"
        >
          {t("signIn.forgotPassword")}
        </Link>
      </div>
      {error && (
        <p
          role="alert"
          className="text-danger rounded-lg bg-red-50 p-3 text-sm font-semibold"
        >
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="bg-brand hover:bg-brand-dark w-full px-4 py-3 font-bold text-white"
      >
        {pending ? t("signIn.submitting") : t("signIn.submit")}
      </button>
    </form>
  );
}
