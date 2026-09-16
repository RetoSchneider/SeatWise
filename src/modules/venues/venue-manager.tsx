"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

interface VenueSummary {
  id: string;
  name: string;
  city: string;
  timezone: string;
  sections: Array<{
    id: string;
    name: string;
    type: "RESERVED" | "GENERAL_ADMISSION";
    capacity: number;
  }>;
}

export function VenueManager({ venues }: { venues: VenueSummary[] }) {
  const common = useTranslations("common");
  const t = useTranslations("organizer.venueManager");
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  function formError(payload: unknown) {
    if (
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "object" &&
      payload.error !== null &&
      "message" in payload.error &&
      typeof payload.error.message === "string"
    ) {
      return payload.error.message;
    }
    return t("genericError");
  }

  async function createVenue(event: FormEvent<HTMLFormElement>) {
    try {
      event.preventDefault();
      setPending(true);
      setError("");
      const formElement = event.currentTarget;
      const form = new FormData(formElement);
      const response = await fetch("/api/v1/organizer/venues", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          description: form.get("description"),
          addressLine1: form.get("addressLine1"),
          city: form.get("city"),
          region: form.get("region"),
          postalCode: form.get("postalCode"),
          countryCode: form.get("countryCode"),
          timezone: form.get("timezone"),
        }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        setError(formError(payload));
        return;
      }
      formElement.reset();
      router.refresh();
    } catch {
      setError(common("requestFailed"));
    } finally {
      setPending(false);
    }
  }

  async function createSection(event: FormEvent<HTMLFormElement>) {
    try {
      event.preventDefault();
      setPending(true);
      setError("");
      const formElement = event.currentTarget;
      const form = new FormData(formElement);
      const venueId = String(form.get("venueId"));
      const type = String(form.get("type"));
      const rowCount = Number(form.get("rowCount"));
      const seatsPerRow = Number(form.get("seatsPerRow"));
      const capacity =
        type === "RESERVED"
          ? rowCount * seatsPerRow
          : Number(form.get("capacity"));
      const rows =
        type === "RESERVED"
          ? Array.from({ length: rowCount }, (_, rowIndex) => ({
              label: String.fromCharCode(65 + rowIndex),
              seats: Array.from({ length: seatsPerRow }, (_, seatIndex) => ({
                label: String(seatIndex + 1),
                accessible: rowIndex === 0 && seatIndex < 2,
                companionSeat: rowIndex === 0 && seatIndex === 2,
              })),
            }))
          : [];

      const response = await fetch(
        `/api/v1/organizer/venues/${venueId}/sections`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: form.get("sectionName"),
            type,
            capacity,
            rows,
          }),
        },
      );
      const payload: unknown = await response.json();
      if (!response.ok) {
        setError(formError(payload));
        return;
      }
      formElement.reset();
      router.refresh();
    } catch {
      setError(common("requestFailed"));
    } finally {
      setPending(false);
    }
  }

  const venueFields: Array<[string, string, string | undefined]> = [
    ["addressLine1", t("streetAddress"), undefined],
    ["city", t("city"), undefined],
    ["region", t("region"), undefined],
    ["postalCode", t("postalCode"), undefined],
    ["countryCode", t("countryCode"), "CH"],
    ["timezone", t("timezone"), "Europe/Zurich"],
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="border-line bg-surface rounded-2xl border p-6">
        <h2 className="text-xl font-extrabold">{t("createVenue")}</h2>
        <form onSubmit={createVenue} className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="text-sm font-bold">{t("venueName")}</span>
            <input
              name="name"
              required
              minLength={2}
              maxLength={100}
              className="border-line mt-1 h-11 w-full border px-3"
            />
          </label>
          <label className="sm:col-span-2">
            <span className="text-sm font-bold">{t("description")}</span>
            <textarea
              name="description"
              required
              minLength={20}
              maxLength={1000}
              rows={3}
              className="border-line mt-1 w-full border p-3"
            />
          </label>
          {venueFields.map(([name, label, defaultValue]) => (
            <label key={name}>
              <span className="text-sm font-bold">{label}</span>
              <input
                name={name}
                required
                defaultValue={defaultValue}
                className="border-line mt-1 h-11 w-full border px-3"
              />
            </label>
          ))}
          <button
            type="submit"
            disabled={pending}
            className="bg-brand px-4 py-2.5 font-bold text-white sm:col-span-2"
          >
            {pending ? t("saving") : t("createVenueSubmit")}
          </button>
        </form>
      </section>

      <section className="border-line bg-surface rounded-2xl border p-6">
        <h2 className="text-xl font-extrabold">{t("addSection")}</h2>
        {venues.length === 0 ? (
          <p className="text-muted mt-4 text-sm">{t("createVenueFirst")}</p>
        ) : (
          <form onSubmit={createSection} className="mt-5 grid gap-4">
            <label>
              <span className="text-sm font-bold">{t("venue")}</span>
              <select
                name="venueId"
                className="border-line mt-1 h-11 w-full border bg-white px-3"
              >
                {venues.map((venue) => (
                  <option key={venue.id} value={venue.id}>
                    {venue.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="text-sm font-bold">{t("sectionName")}</span>
              <input
                name="sectionName"
                required
                className="border-line mt-1 h-11 w-full border px-3"
              />
            </label>
            <label>
              <span className="text-sm font-bold">{t("admissionType")}</span>
              <select
                name="type"
                className="border-line mt-1 h-11 w-full border bg-white px-3"
              >
                <option value="RESERVED">{t("assignedSeats")}</option>
                <option value="GENERAL_ADMISSION">
                  {t("generalAdmission")}
                </option>
              </select>
            </label>
            <div className="grid grid-cols-3 gap-3">
              <label>
                <span className="text-xs font-bold">{t("rows")}</span>
                <input
                  type="number"
                  name="rowCount"
                  min={1}
                  max={26}
                  defaultValue={4}
                  required
                  className="border-line mt-1 h-11 w-full border px-2"
                />
              </label>
              <label>
                <span className="text-xs font-bold">{t("seatsPerRow")}</span>
                <input
                  type="number"
                  name="seatsPerRow"
                  min={1}
                  max={50}
                  defaultValue={8}
                  required
                  className="border-line mt-1 h-11 w-full border px-2"
                />
              </label>
              <label>
                <span className="text-xs font-bold">{t("gaCapacity")}</span>
                <input
                  type="number"
                  name="capacity"
                  min={1}
                  max={10000}
                  defaultValue={100}
                  required
                  className="border-line mt-1 h-11 w-full border px-2"
                />
              </label>
            </div>
            <p className="text-muted text-xs">{t("sectionHint")}</p>
            <button
              type="submit"
              disabled={pending}
              className="bg-brand px-4 py-2.5 font-bold text-white"
            >
              {pending ? t("saving") : t("addSectionSubmit")}
            </button>
          </form>
        )}
      </section>

      {error && (
        <p
          role="alert"
          className="text-danger rounded-xl bg-red-50 p-4 font-bold lg:col-span-2"
        >
          {error}
        </p>
      )}

      <section className="border-line bg-surface rounded-2xl border p-6 lg:col-span-2">
        <h2 className="text-xl font-extrabold">{t("currentLayouts")}</h2>
        {venues.length > 0 ? (
          <ul className="divide-line mt-4 divide-y">
            {venues.map((venue) => (
              <li key={venue.id} className="py-4">
                <h3 className="font-bold">
                  {venue.name} · {venue.city}
                </h3>
                <p className="text-muted mt-1 text-sm">
                  {venue.sections.length > 0
                    ? venue.sections
                        .map((section) =>
                          t("sectionSummary", {
                            name: section.name,
                            capacity: section.capacity,
                            type:
                              section.type === "RESERVED"
                                ? t("typeAssigned")
                                : t("typeGa"),
                          }),
                        )
                        .join(" · ")
                    : t("noSections")}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted mt-4 text-sm">{t("noVenues")}</p>
        )}
      </section>
    </div>
  );
}
