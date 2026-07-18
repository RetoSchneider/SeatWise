"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

interface EditableEvent {
  id: string;
  title: string;
  summary: string;
  description: string;
  category: string;
  refundPolicy: "NON_REFUNDABLE" | "UNTIL_24_HOURS" | "UNTIL_7_DAYS";
  performances: Array<{
    id: string;
    startsAt: Date;
    doorsAt: Date | null;
    endsAt: Date | null;
    salesStartAt: Date;
    salesEndAt: Date;
    reservationDurationMinutes: number;
    ticketTypes: Array<{
      id: string;
      name: string;
      description: string | null;
      priceCents: number;
      minPerOrder: number;
      maxPerOrder: number;
      section: { name: string; capacity: number } | null;
      generalAdmissionInventory: {
        capacity: number;
        reserved: number;
        sold: number;
      } | null;
    }>;
  }>;
}

function localDateTime(value: Date | null) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function EditEventForm({ event }: { event: EditableEvent }) {
  const t = useTranslations("organizer.editEvent");
  const router = useRouter();
  const performance = event.performances[0];
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  if (!performance) {
    return <p role="alert">{t("noPerformance")}</p>;
  }

  async function submit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setPending(true);
    setError("");
    setSaved(false);
    const form = new FormData(formEvent.currentTarget);
    const toUtc = (name: string) => {
      const value = String(form.get(name) ?? "");
      return value ? new Date(value).toISOString() : null;
    };
    const response = await fetch(`/api/v1/organizer/events/${event.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: form.get("title"),
        summary: form.get("summary"),
        description: form.get("description"),
        category: form.get("category"),
        refundPolicy: form.get("refundPolicy"),
        performance: {
          id: performance.id,
          startsAt: toUtc("startsAt"),
          doorsAt: toUtc("doorsAt"),
          endsAt: toUtc("endsAt"),
          salesStartAt: toUtc("salesStartAt"),
          salesEndAt: toUtc("salesEndAt"),
          reservationDurationMinutes: Number(
            form.get("reservationDurationMinutes"),
          ),
        },
        ticketTypes: performance.ticketTypes.map((ticketType) => ({
          id: ticketType.id,
          name: form.get(`name:${ticketType.id}`),
          description: form.get(`description:${ticketType.id}`) || null,
          priceCents: Math.round(
            Number(form.get(`price:${ticketType.id}`)) * 100,
          ),
          minPerOrder: Number(form.get(`minimum:${ticketType.id}`)),
          maxPerOrder: Number(form.get(`maximum:${ticketType.id}`)),
          capacity: ticketType.generalAdmissionInventory
            ? Number(form.get(`capacity:${ticketType.id}`))
            : null,
        })),
      }),
    });
    const payload = (await response.json()) as {
      error?: { message?: string; details?: Array<{ message: string }> };
    };
    if (!response.ok) {
      setError(
        payload.error?.details?.[0]?.message ??
          payload.error?.message ??
          t("failed"),
      );
      setPending(false);
      return;
    }
    setSaved(true);
    setPending(false);
    router.refresh();
  }

  const scheduleFields: Array<[string, string, Date | null, boolean]> = [
    ["startsAt", t("starts"), performance.startsAt, true],
    ["doorsAt", t("doors"), performance.doorsAt, false],
    ["endsAt", t("ends"), performance.endsAt, false],
    ["salesStartAt", t("salesStart"), performance.salesStartAt, true],
    ["salesEndAt", t("salesEnd"), performance.salesEndAt, true],
  ];

  return (
    <form
      onSubmit={submit}
      className="border-line bg-surface space-y-7 rounded-2xl border p-6 sm:p-8"
    >
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-4 text-xl font-extrabold">
          {t("eventDetails")}
        </legend>
        <label>
          <span className="text-sm font-bold">{t("titleField")}</span>
          <input
            name="title"
            defaultValue={event.title}
            minLength={3}
            maxLength={120}
            required
            className="border-line mt-1 h-11 w-full border px-3"
          />
        </label>
        <label>
          <span className="text-sm font-bold">{t("category")}</span>
          <input
            name="category"
            defaultValue={event.category}
            required
            className="border-line mt-1 h-11 w-full border px-3"
          />
        </label>
        <label className="sm:col-span-2">
          <span className="text-sm font-bold">{t("summary")}</span>
          <input
            name="summary"
            defaultValue={event.summary}
            minLength={20}
            maxLength={240}
            required
            className="border-line mt-1 h-11 w-full border px-3"
          />
        </label>
        <label className="sm:col-span-2">
          <span className="text-sm font-bold">{t("description")}</span>
          <textarea
            name="description"
            defaultValue={event.description}
            minLength={50}
            maxLength={5000}
            rows={5}
            required
            className="border-line mt-1 w-full border p-3"
          />
        </label>
        <label>
          <span className="text-sm font-bold">{t("refundPolicy")}</span>
          <select
            name="refundPolicy"
            defaultValue={event.refundPolicy}
            className="border-line mt-1 h-11 w-full border bg-white px-3"
          >
            <option value="UNTIL_24_HOURS">{t("refundUntil24")}</option>
            <option value="UNTIL_7_DAYS">{t("refundUntil7")}</option>
            <option value="NON_REFUNDABLE">{t("refundNon")}</option>
          </select>
        </label>
      </fieldset>

      <fieldset className="border-line grid gap-4 border-t pt-6 sm:grid-cols-2">
        <legend className="mb-4 text-xl font-extrabold">{t("schedule")}</legend>
        {scheduleFields.map(([name, label, value, required]) => (
          <label key={name}>
            <span className="text-sm font-bold">{label}</span>
            <input
              type="datetime-local"
              name={name}
              defaultValue={localDateTime(value)}
              required={required}
              className="border-line mt-1 h-11 w-full border px-3"
            />
          </label>
        ))}
        <label>
          <span className="text-sm font-bold">{t("holdDuration")}</span>
          <input
            type="number"
            name="reservationDurationMinutes"
            defaultValue={performance.reservationDurationMinutes}
            min={1}
            max={30}
            required
            className="border-line mt-1 h-11 w-full border px-3"
          />
        </label>
      </fieldset>

      <fieldset className="border-line space-y-5 border-t pt-6">
        <legend className="mb-4 text-xl font-extrabold">
          {t("pricingAndCapacity")}
        </legend>
        {performance.ticketTypes.map((ticketType) => (
          <div
            key={ticketType.id}
            className="border-line grid gap-3 rounded-xl border p-4 sm:grid-cols-6"
          >
            <p className="font-bold sm:col-span-6">
              {ticketType.section?.name ?? t("admission")}
            </p>
            <label className="sm:col-span-2">
              <span className="text-xs font-bold">{t("name")}</span>
              <input
                name={`name:${ticketType.id}`}
                defaultValue={ticketType.name}
                required
                className="border-line mt-1 h-10 w-full border px-2"
              />
            </label>
            <label className="sm:col-span-2">
              <span className="text-xs font-bold">{t("description2")}</span>
              <input
                name={`description:${ticketType.id}`}
                defaultValue={ticketType.description ?? ""}
                className="border-line mt-1 h-10 w-full border px-2"
              />
            </label>
            <label>
              <span className="text-xs font-bold">{t("price")}</span>
              <input
                type="number"
                name={`price:${ticketType.id}`}
                defaultValue={(ticketType.priceCents / 100).toFixed(2)}
                min={0}
                step="0.01"
                required
                className="border-line mt-1 h-10 w-full border px-2"
              />
            </label>
            {ticketType.generalAdmissionInventory && (
              <label>
                <span className="text-xs font-bold">{t("capacity")}</span>
                <input
                  type="number"
                  name={`capacity:${ticketType.id}`}
                  defaultValue={ticketType.generalAdmissionInventory.capacity}
                  min={
                    ticketType.generalAdmissionInventory.reserved +
                    ticketType.generalAdmissionInventory.sold
                  }
                  max={ticketType.section?.capacity}
                  required
                  className="border-line mt-1 h-10 w-full border px-2"
                />
              </label>
            )}
            <label>
              <span className="text-xs font-bold">{t("minPerOrder")}</span>
              <input
                type="number"
                name={`minimum:${ticketType.id}`}
                defaultValue={ticketType.minPerOrder}
                min={1}
                max={8}
                required
                className="border-line mt-1 h-10 w-full border px-2"
              />
            </label>
            <label>
              <span className="text-xs font-bold">{t("maxPerOrder")}</span>
              <input
                type="number"
                name={`maximum:${ticketType.id}`}
                defaultValue={ticketType.maxPerOrder}
                min={1}
                max={8}
                required
                className="border-line mt-1 h-10 w-full border px-2"
              />
            </label>
          </div>
        ))}
      </fieldset>

      {error && (
        <p role="alert" className="text-danger font-bold">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-brand font-bold">
          {t("updated")}
        </p>
      )}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="bg-brand px-5 py-3 font-bold text-white"
        >
          {pending ? t("saving") : t("submit")}
        </button>
      </div>
    </form>
  );
}
