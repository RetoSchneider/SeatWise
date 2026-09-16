"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

interface VenueOption {
  id: string;
  name: string;
  sections: Array<{
    id: string;
    name: string;
    type: "RESERVED" | "GENERAL_ADMISSION";
    capacity: number;
  }>;
}

export function CreateEventForm({ venues }: { venues: VenueOption[] }) {
  const common = useTranslations("common");
  const t = useTranslations("organizer.createEvent");
  const router = useRouter();
  const [venueId, setVenueId] = useState(venues[0]?.id ?? "");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const venue = venues.find((item) => item.id === venueId);

  async function submit(event: FormEvent<HTMLFormElement>) {
    try {
      event.preventDefault();
      setPending(true);
      setError("");
      const form = new FormData(event.currentTarget);
      const sectionId = String(form.get("sectionId"));
      const section = venue?.sections.find((item) => item.id === sectionId);
      const toUtc = (name: string) => {
        const value = String(form.get(name) ?? "");
        return value ? new Date(value).toISOString() : undefined;
      };
      const response = await fetch("/api/v1/organizer/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          venueId,
          title: form.get("title"),
          summary: form.get("summary"),
          description: form.get("description"),
          category: form.get("category"),
          refundPolicy: form.get("refundPolicy"),
          performance: {
            startsAt: toUtc("startsAt"),
            doorsAt: toUtc("doorsAt"),
            endsAt: toUtc("endsAt"),
            salesStartAt: toUtc("salesStartAt"),
            salesEndAt: toUtc("salesEndAt"),
            reservationDurationMinutes: Number(
              form.get("reservationDurationMinutes"),
            ),
          },
          ticketTypes: [
            {
              sectionId,
              name: form.get("ticketTypeName"),
              description: form.get("ticketTypeDescription") || undefined,
              priceCents: Math.round(Number(form.get("price")) * 100),
              currency: form.get("currency"),
              minPerOrder: 1,
              maxPerOrder: 8,
              capacity:
                section?.type === "GENERAL_ADMISSION"
                  ? Number(form.get("capacity"))
                  : undefined,
            },
          ],
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
        return;
      }
      router.push("/organizer");
      router.refresh();
    } catch {
      setError(common("requestFailed"));
    } finally {
      setPending(false);
    }
  }

  if (venues.length === 0) {
    return (
      <div className="border-line bg-surface rounded-2xl border border-dashed p-10 text-center">
        <p className="font-bold">{t("needVenueTitle")}</p>
        <p className="text-muted mt-2 text-sm">{t("needVenueText")}</p>
      </div>
    );
  }

  const scheduleFields: Array<[string, string]> = [
    ["startsAt", t("startsAt")],
    ["doorsAt", t("doorsAt")],
    ["endsAt", t("endsAt")],
    ["salesStartAt", t("salesStartAt")],
    ["salesEndAt", t("salesEndAt")],
  ];

  return (
    <form
      onSubmit={submit}
      className="border-line bg-surface grid gap-6 rounded-2xl border p-6 sm:p-8"
    >
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-4 text-xl font-extrabold">
          {t("eventDetails")}
        </legend>
        <label>
          <span className="text-sm font-bold">{t("titleField")}</span>
          <input
            name="title"
            required
            minLength={3}
            maxLength={120}
            className="border-line mt-1 h-11 w-full border px-3"
          />
        </label>
        <label>
          <span className="text-sm font-bold">{t("category")}</span>
          <input
            name="category"
            required
            placeholder={t("categoryPlaceholder")}
            className="border-line mt-1 h-11 w-full border px-3"
          />
        </label>
        <label className="sm:col-span-2">
          <span className="text-sm font-bold">{t("summary")}</span>
          <input
            name="summary"
            required
            minLength={20}
            maxLength={240}
            className="border-line mt-1 h-11 w-full border px-3"
          />
        </label>
        <label className="sm:col-span-2">
          <span className="text-sm font-bold">{t("description")}</span>
          <textarea
            name="description"
            required
            minLength={50}
            maxLength={5000}
            rows={5}
            className="border-line mt-1 w-full border p-3"
          />
        </label>
        <label>
          <span className="text-sm font-bold">{t("refundPolicy")}</span>
          <select
            name="refundPolicy"
            className="border-line mt-1 h-11 w-full border bg-white px-3"
          >
            <option value="UNTIL_24_HOURS">{t("refundUntil24")}</option>
            <option value="UNTIL_7_DAYS">{t("refundUntil7")}</option>
            <option value="NON_REFUNDABLE">{t("refundNon")}</option>
          </select>
        </label>
        <label>
          <span className="text-sm font-bold">{t("venue")}</span>
          <select
            name="venueId"
            value={venueId}
            onChange={(event) => setVenueId(event.target.value)}
            className="border-line mt-1 h-11 w-full border bg-white px-3"
          >
            {venues.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
      </fieldset>

      <fieldset className="border-line grid gap-4 border-t pt-6 sm:grid-cols-2">
        <legend className="mb-4 text-xl font-extrabold">
          {t("scheduleAndSales")}
        </legend>
        {scheduleFields.map(([name, label]) => (
          <label key={name}>
            <span className="text-sm font-bold">{label}</span>
            <input
              type="datetime-local"
              name={name}
              required={["startsAt", "salesStartAt", "salesEndAt"].includes(
                name,
              )}
              className="border-line mt-1 h-11 w-full border px-3"
            />
          </label>
        ))}
        <label>
          <span className="text-sm font-bold">{t("holdDuration")}</span>
          <input
            type="number"
            name="reservationDurationMinutes"
            min={1}
            max={30}
            defaultValue={10}
            required
            className="border-line mt-1 h-11 w-full border px-3"
          />
        </label>
      </fieldset>

      <fieldset className="border-line grid gap-4 border-t pt-6 sm:grid-cols-2">
        <legend className="mb-4 text-xl font-extrabold">
          {t("initialTicketType")}
        </legend>
        <label>
          <span className="text-sm font-bold">{t("section")}</span>
          <select
            name="sectionId"
            className="border-line mt-1 h-11 w-full border bg-white px-3"
          >
            {venue?.sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.name} ·{" "}
                {section.type === "RESERVED" ? t("typeAssigned") : t("typeGa")}{" "}
                · {section.capacity}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="text-sm font-bold">{t("ticketTypeName")}</span>
          <input
            name="ticketTypeName"
            required
            defaultValue="Standard"
            className="border-line mt-1 h-11 w-full border px-3"
          />
        </label>
        <label>
          <span className="text-sm font-bold">{t("ticketDescription")}</span>
          <input
            name="ticketTypeDescription"
            placeholder={t("ticketDescriptionPlaceholder")}
            className="border-line mt-1 h-11 w-full border px-3"
          />
        </label>
        <div className="grid grid-cols-3 gap-3">
          <label>
            <span className="text-sm font-bold">{t("price")}</span>
            <input
              type="number"
              name="price"
              min={0}
              step="0.01"
              required
              className="border-line mt-1 h-11 w-full border px-2"
            />
          </label>
          <label>
            <span className="text-sm font-bold">{t("currency")}</span>
            <input
              name="currency"
              defaultValue="CHF"
              minLength={3}
              maxLength={3}
              required
              className="border-line mt-1 h-11 w-full border px-2 uppercase"
            />
          </label>
          <label>
            <span className="text-sm font-bold">{t("gaCapacity")}</span>
            <input
              type="number"
              name="capacity"
              min={1}
              defaultValue={venue?.sections[0]?.capacity ?? 1}
              required
              className="border-line mt-1 h-11 w-full border px-2"
            />
          </label>
        </div>
      </fieldset>

      {venue?.sections.length === 0 && (
        <p role="alert" className="text-danger font-bold">
          {t("addSectionFirst")}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="text-danger rounded-xl bg-red-50 p-4 font-bold"
        >
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending || venue?.sections.length === 0}
          className="bg-brand px-5 py-3 font-bold text-white"
        >
          {pending ? t("creating") : t("submit")}
        </button>
      </div>
    </form>
  );
}
