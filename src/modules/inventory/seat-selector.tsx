"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Accessibility, Armchair, Clock3, Minus, Plus } from "lucide-react";

import { formatCurrency, formatDateTime } from "@/shared/presentation/format";

interface PerformanceOption {
  id: string;
  startsAt: Date;
  reservationDurationMinutes: number;
  ticketTypes: Array<{
    id: string;
    name: string;
    description: string | null;
    priceCents: number;
    currency: string;
    section: string | null;
    generalAdmission: { capacity: number; available: number } | null;
  }>;
  seats: Array<{
    inventoryId: string;
    state: "AVAILABLE" | "RESERVED" | "SOLD" | "BLOCKED";
    section: string;
    sectionOrder: number;
    row: string;
    rowOrder: number;
    seat: string;
    seatOrder: number;
    accessible: boolean;
    companionSeat: boolean;
    ticketType: string;
    priceCents: number;
    currency: string;
  }>;
}

interface SeatSelectorProps {
  performances: PerformanceOption[];
  timezone: string;
  signedIn: boolean;
}

interface ApiError {
  error?: { message?: string };
}

export function SeatSelector({
  performances,
  timezone,
  signedIn,
}: SeatSelectorProps) {
  const common = useTranslations("common");
  const t = useTranslations("seatSelector");
  const locale = useLocale();
  const router = useRouter();
  const [performanceId, setPerformanceId] = useState(performances[0]?.id ?? "");
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const performance = performances.find((item) => item.id === performanceId);

  const selectedSeatDetails = useMemo(
    () =>
      performance?.seats.filter((seat) =>
        selectedSeats.includes(seat.inventoryId),
      ) ?? [],
    [performance, selectedSeats],
  );
  const totalQuantity =
    selectedSeats.length +
    Object.values(quantities).reduce((total, quantity) => total + quantity, 0);
  const estimatedSubtotal =
    selectedSeatDetails.reduce((total, seat) => total + seat.priceCents, 0) +
    (performance?.ticketTypes ?? []).reduce(
      (total, ticketType) =>
        total + (quantities[ticketType.id] ?? 0) * ticketType.priceCents,
      0,
    );
  const currency =
    selectedSeatDetails[0]?.currency ??
    performance?.ticketTypes[0]?.currency ??
    "CHF";

  function toggleSeat(inventoryId: string) {
    setError("");
    setSelectedSeats((current) => {
      if (current.includes(inventoryId)) {
        return current.filter((id) => id !== inventoryId);
      }
      if (totalQuantity >= 8) {
        setError(t("maxTickets"));
        return current;
      }
      return [...current, inventoryId];
    });
  }

  function changeQuantity(ticketTypeId: string, change: number) {
    setError("");
    setQuantities((current) => {
      const next = Math.max(0, (current[ticketTypeId] ?? 0) + change);
      if (change > 0 && totalQuantity >= 8) {
        setError(t("maxTickets"));
        return current;
      }
      return { ...current, [ticketTypeId]: next };
    });
  }

  async function reserve() {
    try {
      if (!signedIn) {
        router.push(
          `/sign-in?callbackURL=${encodeURIComponent(window.location.pathname)}`,
        );
        return;
      }
      if (!performance || totalQuantity === 0) {
        setError(t("chooseAtLeastOne"));
        return;
      }

      setPending(true);
      setError("");
      const response = await fetch("/api/v1/reservations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          performanceId: performance.id,
          seatInventoryIds: selectedSeats,
          generalAdmission: Object.entries(quantities)
            .filter(([, quantity]) => quantity > 0)
            .map(([ticketTypeId, quantity]) => ({ ticketTypeId, quantity })),
        }),
      });
      const payload = (await response.json()) as
        { data: { id: string } } | ApiError;
      if (!response.ok || !("data" in payload)) {
        setError(
          "error" in payload && payload.error?.message
            ? payload.error.message
            : t("reservationFailed"),
        );
        router.refresh();
        return;
      }
      router.push(`/cart/${payload.data.id}`);
    } catch {
      setError(common("requestFailed"));
    } finally {
      setPending(false);
    }
  }

  if (!performance) {
    return (
      <div className="border-line bg-surface rounded-2xl border p-8">
        <h2 className="font-extrabold">{t("noPerformancesTitle")}</h2>
        <p className="text-muted mt-2 text-sm">{t("noPerformancesText")}</p>
      </div>
    );
  }

  const sections = Map.groupBy(
    performance.seats,
    (seat) => `${seat.sectionOrder}:${seat.section}`,
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-6">
        <div className="border-line bg-surface rounded-2xl border p-5">
          <label className="block font-bold" htmlFor="performance">
            {t("performance")}
          </label>
          <select
            id="performance"
            value={performanceId}
            onChange={(event) => {
              setPerformanceId(event.target.value);
              setSelectedSeats([]);
              setQuantities({});
            }}
            className="border-line mt-2 h-11 w-full border bg-white px-3"
          >
            {performances.map((option) => (
              <option key={option.id} value={option.id}>
                {formatDateTime(option.startsAt, timezone, locale)}
              </option>
            ))}
          </select>
          <p className="text-muted mt-3 flex items-center gap-2 text-sm">
            <Clock3 aria-hidden="true" className="size-4" />
            {t("heldFor", { minutes: performance.reservationDurationMinutes })}
          </p>
        </div>

        {performance.seats.length > 0 && (
          <section
            aria-labelledby="seat-map-title"
            className="border-line bg-surface rounded-2xl border p-5 sm:p-7"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 id="seat-map-title" className="text-xl font-extrabold">
                  {t("chooseSeats")}
                </h2>
                <p className="text-muted mt-1 text-sm">{t("keyboardHint")}</p>
              </div>
              <ul
                aria-label={t("legendAria")}
                className="text-muted flex flex-wrap gap-3 text-xs"
              >
                <li className="flex items-center gap-1.5">
                  <span className="border-brand size-3 rounded-sm border bg-white" />
                  {t("legendAvailable")}
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="bg-brand size-3 rounded-sm" />
                  {t("legendSelected")}
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="size-3 rounded-sm bg-[#d5dad6]" />
                  {t("legendUnavailable")}
                </li>
              </ul>
            </div>
            <div
              aria-hidden="true"
              className="border-brand/50 text-muted mx-auto mt-8 max-w-xl rounded-t-[50%] border-t-4 pt-4 text-center text-xs font-bold tracking-[0.3em] uppercase"
            >
              {t("stage")}
            </div>
            <div className="mt-8 space-y-9">
              {Array.from(sections.entries()).map(([sectionKey, seats]) => {
                const rows = Map.groupBy(
                  seats,
                  (seat) => `${seat.rowOrder}:${seat.row}`,
                );
                return (
                  <fieldset key={sectionKey}>
                    <legend className="mb-3 font-extrabold">
                      {seats[0]?.section}
                    </legend>
                    <div className="space-y-2">
                      {Array.from(rows.entries()).map(([rowKey, rowSeats]) => (
                        <div
                          key={rowKey}
                          className="flex items-center gap-2 overflow-x-auto pb-1"
                        >
                          <span
                            aria-hidden="true"
                            className="text-muted w-8 shrink-0 text-center text-xs font-bold"
                          >
                            {rowSeats[0]?.row}
                          </span>
                          {rowSeats.map((seat) => {
                            const selected = selectedSeats.includes(
                              seat.inventoryId,
                            );
                            const available = seat.state === "AVAILABLE";
                            const seatLabel =
                              t("seatLabel", {
                                section: seat.section,
                                row: seat.row,
                                seat: seat.seat,
                                price: formatCurrency(
                                  seat.priceCents,
                                  seat.currency,
                                  locale,
                                ),
                              }) +
                              (seat.accessible ? t("seatAccessible") : "") +
                              (available ? "" : t("seatUnavailable"));
                            return (
                              <button
                                key={seat.inventoryId}
                                type="button"
                                disabled={!available}
                                aria-pressed={selected}
                                aria-label={seatLabel}
                                onClick={() => toggleSeat(seat.inventoryId)}
                                className={`grid size-9 shrink-0 place-items-center rounded-t-xl border text-xs font-bold ${
                                  selected
                                    ? "border-brand bg-brand text-white"
                                    : available
                                      ? "border-brand/60 text-brand hover:bg-accent bg-white"
                                      : "text-muted border-[#d5dad6] bg-[#e8ebe9]"
                                }`}
                              >
                                {seat.accessible ? (
                                  <Accessibility
                                    aria-hidden="true"
                                    className="size-4"
                                  />
                                ) : (
                                  seat.seat
                                )}
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </fieldset>
                );
              })}
            </div>
          </section>
        )}

        {performance.ticketTypes.some(
          (ticketType) => ticketType.generalAdmission,
        ) && (
          <section
            aria-labelledby="ga-title"
            className="border-line bg-surface rounded-2xl border p-5"
          >
            <h2 id="ga-title" className="text-xl font-extrabold">
              {t("generalAdmission")}
            </h2>
            <div className="divide-line mt-4 divide-y">
              {performance.ticketTypes
                .filter((ticketType) => ticketType.generalAdmission)
                .map((ticketType) => (
                  <div
                    key={ticketType.id}
                    className="flex items-center justify-between gap-4 py-4"
                  >
                    <div>
                      <h3 className="font-bold">{ticketType.name}</h3>
                      <p className="text-muted text-sm">
                        {formatCurrency(
                          ticketType.priceCents,
                          ticketType.currency,
                          locale,
                        )}{" "}
                        ·{" "}
                        {t("remaining", {
                          count: ticketType.generalAdmission?.available ?? 0,
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => changeQuantity(ticketType.id, -1)}
                        disabled={(quantities[ticketType.id] ?? 0) === 0}
                        aria-label={t("removeOne", { name: ticketType.name })}
                        className="border-line grid size-9 place-items-center border"
                      >
                        <Minus aria-hidden="true" className="size-4" />
                      </button>
                      <output
                        aria-live="polite"
                        aria-label={t("quantityLabel", {
                          name: ticketType.name,
                        })}
                        className="w-8 text-center font-bold"
                      >
                        {quantities[ticketType.id] ?? 0}
                      </output>
                      <button
                        type="button"
                        onClick={() => changeQuantity(ticketType.id, 1)}
                        disabled={
                          totalQuantity >= 8 ||
                          (quantities[ticketType.id] ?? 0) >=
                            (ticketType.generalAdmission?.available ?? 0)
                        }
                        aria-label={t("addOne", { name: ticketType.name })}
                        className="border-line grid size-9 place-items-center border"
                      >
                        <Plus aria-hidden="true" className="size-4" />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </section>
        )}
      </div>

      <aside className="border-line bg-surface h-fit rounded-2xl border p-5 shadow-sm lg:sticky lg:top-5">
        <div className="flex items-center gap-2">
          <Armchair aria-hidden="true" className="text-brand size-5" />
          <h2 className="text-lg font-extrabold">{t("yourSelection")}</h2>
        </div>
        {totalQuantity === 0 ? (
          <p className="text-muted mt-4 text-sm">{t("selectionEmpty")}</p>
        ) : (
          <>
            <p className="mt-4 text-sm">
              {t("ticketCount", { count: totalQuantity })}
            </p>
            <div className="border-line mt-4 flex items-center justify-between border-t pt-4">
              <span className="text-muted text-sm">
                {t("subtotalBeforeFees")}
              </span>
              <strong>
                {formatCurrency(estimatedSubtotal, currency, locale)}
              </strong>
            </div>
          </>
        )}
        {error && (
          <p
            role="alert"
            className="text-danger mt-4 rounded-lg bg-red-50 p-3 text-sm font-semibold"
          >
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={reserve}
          disabled={pending || totalQuantity === 0}
          className="bg-brand hover:bg-brand-dark mt-5 w-full px-4 py-3 font-bold text-white"
        >
          {pending
            ? t("reserving")
            : signedIn
              ? t("reserveSelection")
              : t("signInToReserve")}
        </button>
      </aside>
    </div>
  );
}
