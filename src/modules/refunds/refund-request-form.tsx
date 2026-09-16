"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

export function RefundRequestForm({ orderId }: { orderId: string }) {
  const common = useTranslations("common");
  const t = useTranslations("refundForm");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    try {
      event.preventDefault();
      setPending(true);
      setError("");
      const form = new FormData(event.currentTarget);
      const response = await fetch(`/api/v1/orders/${orderId}/refunds`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: String(form.get("reason")) }),
      });
      const payload = (await response.json()) as {
        error?: { message?: string };
      };
      if (!response.ok) {
        setError(payload.error?.message ?? t("failed"));
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError(common("requestFailed"));
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border-line border px-4 py-2 text-sm font-bold"
      >
        {t("request")}
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="border-line rounded-xl border p-4">
      <label className="block">
        <span className="text-sm font-bold">{t("reason")}</span>
        <textarea
          name="reason"
          required
          minLength={10}
          maxLength={500}
          rows={4}
          className="border-line mt-2 w-full border bg-white p-3"
        />
      </label>
      {error && (
        <p role="alert" className="text-danger mt-3 text-sm font-bold">
          {error}
        </p>
      )}
      <div className="mt-3 flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="bg-brand px-4 py-2 text-sm font-bold text-white"
        >
          {pending ? t("sending") : t("send")}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-muted px-4 py-2 text-sm font-bold"
        >
          {t("cancel")}
        </button>
      </div>
    </form>
  );
}
