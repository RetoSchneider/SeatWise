"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { authClient } from "@/modules/identity/auth-client";

export function ProfileForm({ name }: { name: string }) {
  const t = useTranslations("profile");
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setStatus("");
    const form = new FormData(event.currentTarget);
    const result = await authClient.updateUser({
      name: String(form.get("name")).trim(),
    });
    setPending(false);
    if (result.error) {
      setStatus(t("updateFailed"));
      return;
    }
    setStatus(t("updated"));
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-5">
      <label className="block">
        <span className="text-sm font-bold">{t("fullName")}</span>
        <input
          name="name"
          defaultValue={name}
          autoComplete="name"
          minLength={2}
          maxLength={100}
          required
          className="border-line mt-2 h-11 w-full border bg-white px-3"
        />
      </label>
      {status && (
        <p role="status" className="text-brand text-sm font-semibold">
          {status}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="bg-brand hover:bg-brand-dark px-5 py-2.5 font-bold text-white"
      >
        {pending ? t("saving") : t("save")}
      </button>
    </form>
  );
}
