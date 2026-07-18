"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

export function PromotionForm({
  events,
}: {
  events: Array<{ id: string; title: string }>;
}) {
  const t = useTranslations("organizer.promotionForm");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const startsAt = new Date(String(form.get("startsAt"))).toISOString();
    const endsAt = new Date(String(form.get("endsAt"))).toISOString();
    const type = String(form.get("type"));
    const value =
      type === "PERCENTAGE"
        ? Number(form.get("value"))
        : Math.round(Number(form.get("value")) * 100);
    const eventId = String(form.get("eventId"));

    const response = await fetch("/api/v1/organizer/promotions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventId: eventId || undefined,
        code: form.get("code"),
        description: form.get("description"),
        type,
        value,
        minimumSubtotalCents: Math.round(
          Number(form.get("minimumSubtotal")) * 100,
        ),
        startsAt,
        endsAt,
        redemptionLimit: Number(form.get("redemptionLimit")) || undefined,
        limitPerCustomer: Number(form.get("limitPerCustomer")),
      }),
    });
    const payload = (await response.json()) as {
      error?: { message?: string };
    };
    if (!response.ok) {
      setError(payload.error?.message ?? t("failed"));
      setPending(false);
      return;
    }
    event.currentTarget.reset();
    setPending(false);
    router.refresh();
  }

  return (
    <form
      onSubmit={submit}
      className="border-line bg-surface grid gap-4 rounded-2xl border p-6 sm:grid-cols-2"
    >
      <h2 className="text-xl font-extrabold sm:col-span-2">{t("create")}</h2>
      <label>
        <span className="text-sm font-bold">{t("code")}</span>
        <input
          name="code"
          required
          minLength={3}
          maxLength={30}
          pattern="[A-Za-z0-9_-]+"
          className="border-line mt-1 h-11 w-full border px-3 uppercase"
        />
      </label>
      <label>
        <span className="text-sm font-bold">{t("event")}</span>
        <select
          name="eventId"
          className="border-line mt-1 h-11 w-full border bg-white px-3"
        >
          <option value="">{t("allOrganizerEvents")}</option>
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.title}
            </option>
          ))}
        </select>
      </label>
      <label className="sm:col-span-2">
        <span className="text-sm font-bold">{t("description")}</span>
        <input
          name="description"
          required
          minLength={5}
          maxLength={200}
          className="border-line mt-1 h-11 w-full border px-3"
        />
      </label>
      <label>
        <span className="text-sm font-bold">{t("discountType")}</span>
        <select
          name="type"
          className="border-line mt-1 h-11 w-full border bg-white px-3"
        >
          <option value="PERCENTAGE">{t("percentage")}</option>
          <option value="FIXED_AMOUNT">{t("fixedAmount")}</option>
        </select>
      </label>
      <label>
        <span className="text-sm font-bold">{t("value")}</span>
        <input
          type="number"
          name="value"
          min={1}
          step="0.01"
          required
          className="border-line mt-1 h-11 w-full border px-3"
        />
      </label>
      <label>
        <span className="text-sm font-bold">{t("starts")}</span>
        <input
          type="datetime-local"
          name="startsAt"
          required
          className="border-line mt-1 h-11 w-full border px-3"
        />
      </label>
      <label>
        <span className="text-sm font-bold">{t("ends")}</span>
        <input
          type="datetime-local"
          name="endsAt"
          required
          className="border-line mt-1 h-11 w-full border px-3"
        />
      </label>
      <label>
        <span className="text-sm font-bold">{t("minimumSubtotal")}</span>
        <input
          type="number"
          name="minimumSubtotal"
          min={0}
          step="0.01"
          defaultValue={0}
          required
          className="border-line mt-1 h-11 w-full border px-3"
        />
      </label>
      <label>
        <span className="text-sm font-bold">{t("redemptionLimit")}</span>
        <input
          type="number"
          name="redemptionLimit"
          min={1}
          className="border-line mt-1 h-11 w-full border px-3"
        />
      </label>
      <label>
        <span className="text-sm font-bold">{t("perCustomerLimit")}</span>
        <input
          type="number"
          name="limitPerCustomer"
          min={1}
          max={20}
          defaultValue={1}
          required
          className="border-line mt-1 h-11 w-full border px-3"
        />
      </label>
      <div className="flex items-end">
        <button
          type="submit"
          disabled={pending}
          className="bg-brand h-11 w-full px-4 font-bold text-white"
        >
          {pending ? t("creating") : t("submit")}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-danger font-bold sm:col-span-2">
          {error}
        </p>
      )}
    </form>
  );
}
