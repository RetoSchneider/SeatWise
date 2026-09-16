"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { authClient } from "@/modules/identity/auth-client";

export function RegisterForm() {
  const common = useTranslations("common");
  const t = useTranslations("auth");
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    try {
      event.preventDefault();
      setError("");
      const form = new FormData(event.currentTarget);
      const password = String(form.get("password"));
      const confirmation = String(form.get("passwordConfirmation"));
      if (password !== confirmation) {
        setError(t("register.passwordMismatch"));
        return;
      }

      setPending(true);
      const result = await authClient.signUp.email({
        name: String(form.get("name")),
        email: String(form.get("email")),
        password,
      });
      if (result.error) {
        setError(t("register.failed"));
        return;
      }
      router.push("/account?registered=1");
      router.refresh();
    } catch {
      setError(common("requestFailed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-7 space-y-5">
      <label className="block">
        <span className="text-sm font-bold">{t("fullName")}</span>
        <input
          name="name"
          autoComplete="name"
          required
          minLength={2}
          maxLength={100}
          className="border-line mt-2 h-11 w-full border bg-white px-3"
        />
      </label>
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
          autoComplete="new-password"
          required
          minLength={12}
          maxLength={128}
          aria-describedby="password-help"
          className="border-line mt-2 h-11 w-full border bg-white px-3"
        />
        <span id="password-help" className="text-muted mt-1 block text-xs">
          {t("register.passwordHelp")}
        </span>
      </label>
      <label className="block">
        <span className="text-sm font-bold">
          {t("register.confirmPassword")}
        </span>
        <input
          type="password"
          name="passwordConfirmation"
          autoComplete="new-password"
          required
          minLength={12}
          maxLength={128}
          className="border-line mt-2 h-11 w-full border bg-white px-3"
        />
      </label>
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
        {pending ? t("register.submitting") : t("register.submit")}
      </button>
    </form>
  );
}
