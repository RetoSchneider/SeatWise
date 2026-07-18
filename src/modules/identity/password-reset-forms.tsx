"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { authClient } from "@/modules/identity/auth-client";

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const form = new FormData(event.currentTarget);
    await authClient.requestPasswordReset({
      email: String(form.get("email")),
      redirectTo: "/reset-password",
    });
    setSent(true);
    setPending(false);
  }

  if (sent) {
    return (
      <div role="status" className="bg-accent mt-7 rounded-xl p-4">
        <p className="font-bold">{t("forgot.sentTitle")}</p>
        <p className="text-muted mt-1 text-sm">{t("forgot.sentText")}</p>
        <Link
          href="/sign-in"
          className="text-brand mt-4 inline-block text-sm font-bold"
        >
          {t("forgot.backToSignIn")}
        </Link>
      </div>
    );
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
      <button
        type="submit"
        disabled={pending}
        className="bg-brand hover:bg-brand-dark w-full px-4 py-3 font-bold text-white"
      >
        {pending ? t("forgot.submitting") : t("forgot.submit")}
      </button>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations("auth");
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    if (password !== String(form.get("confirmation"))) {
      setError(t("reset.mismatch"));
      return;
    }
    setPending(true);
    const result = await authClient.resetPassword({
      newPassword: password,
      token,
    });
    if (result.error) {
      setError(t("reset.invalidToken"));
      setPending(false);
      return;
    }
    setComplete(true);
  }

  if (complete) {
    return (
      <div role="status" className="bg-accent mt-7 rounded-xl p-4">
        <p className="font-bold">{t("reset.completeTitle")}</p>
        <Link
          href="/sign-in"
          className="text-brand mt-3 inline-block text-sm font-bold"
        >
          {t("reset.completeLink")}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-7 space-y-5">
      <label className="block">
        <span className="text-sm font-bold">{t("reset.newPassword")}</span>
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
          className="border-line mt-2 h-11 w-full border bg-white px-3"
        />
      </label>
      <label className="block">
        <span className="text-sm font-bold">
          {t("reset.confirmNewPassword")}
        </span>
        <input
          type="password"
          name="confirmation"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
          className="border-line mt-2 h-11 w-full border bg-white px-3"
        />
      </label>
      {error && (
        <p role="alert" className="text-danger text-sm font-bold">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="bg-brand hover:bg-brand-dark w-full px-4 py-3 font-bold text-white"
      >
        {pending ? t("reset.submitting") : t("reset.submit")}
      </button>
    </form>
  );
}
