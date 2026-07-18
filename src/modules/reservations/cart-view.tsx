"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Clock3, Tag, Trash2 } from "lucide-react";

import { formatCurrency, formatDateTime } from "@/shared/presentation/format";

interface CartViewProps {
  reservation: {
    id: string;
    status: string;
    expiresAt: Date;
    event: {
      title: string;
      slug: string;
      venue: string;
      startsAt: Date;
    };
    items: Array<{
      id: string;
      ticketType: string;
      quantity: number;
      unitPriceCents: number;
      seat: { section: string; row: string; number: string } | null;
    }>;
    price: {
      currency: string;
      subtotalCents: number;
      discountCents: number;
      feeCents: number;
      totalCents: number;
      promotionCode: string | null;
    };
  };
}

interface ErrorPayload {
  error?: { message?: string; details?: { retryable?: boolean } };
}

function remainingSeconds(expiresAt: Date) {
  return Math.max(
    0,
    Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1_000),
  );
}

export function CartView({ reservation: initialReservation }: CartViewProps) {
  const t = useTranslations("cart");
  const locale = useLocale();
  const router = useRouter();
  const [reservation, setReservation] = useState(initialReservation);
  const [remaining, setRemaining] = useState(() =>
    remainingSeconds(initialReservation.expiresAt),
  );
  const [paymentToken, setPaymentToken] = useState("pm_success");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const next = remainingSeconds(reservation.expiresAt);
      setRemaining(next);
      if (next === 0) {
        window.clearInterval(timer);
      }
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [reservation.expiresAt]);

  async function applyPromotion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch(
      `/api/v1/reservations/${reservation.id}/promotion`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: String(form.get("code")) }),
      },
    );
    const payload = (await response.json()) as
      { data: CartViewProps["reservation"] } | ErrorPayload;
    if (!response.ok || !("data" in payload)) {
      setError(
        "error" in payload && payload.error?.message
          ? payload.error.message
          : t("promotionFailed"),
      );
      return;
    }
    setReservation(payload.data);
  }

  async function release() {
    setPending(true);
    await fetch(`/api/v1/reservations/${reservation.id}`, {
      method: "DELETE",
    });
    router.push(`/events/${reservation.event.slug}`);
    router.refresh();
  }

  async function pay() {
    if (remaining === 0) {
      setError(t("expired"));
      return;
    }
    setPending(true);
    setError("");
    const response = await fetch("/api/v1/checkout", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": crypto.randomUUID(),
      },
      body: JSON.stringify({
        reservationId: reservation.id,
        paymentToken,
      }),
    });
    const payload = (await response.json()) as
      { data: { id: string } } | ErrorPayload;
    if (!response.ok || !("data" in payload)) {
      setError(
        "error" in payload && payload.error?.message
          ? payload.error.message
          : t("paymentFailed"),
      );
      setPending(false);
      return;
    }
    router.push(`/account/orders/${payload.data.id}?paid=1`);
    router.refresh();
  }

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  const paymentOutcomes: Array<[string, string]> = [
    ["pm_success", t("outcomeSuccess")],
    ["pm_decline", t("outcomeDecline")],
    ["pm_timeout", t("outcomeTimeout")],
    ["pm_transient", t("outcomeTransient")],
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-6">
        <section className="border-line bg-surface rounded-2xl border p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-brand text-sm font-bold">{t("reserved")}</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight">
                {reservation.event.title}
              </h1>
              <p className="text-muted mt-2 text-sm">
                {formatDateTime(reservation.event.startsAt, undefined, locale)}{" "}
                · {reservation.event.venue}
              </p>
            </div>
            <div
              role="timer"
              aria-live="polite"
              className={`flex items-center gap-2 rounded-xl px-4 py-3 font-black ${
                remaining < 120
                  ? "text-danger bg-red-50"
                  : "bg-accent text-brand"
              }`}
            >
              <Clock3 aria-hidden="true" className="size-5" />
              <span>
                {minutes}:{seconds.toString().padStart(2, "0")}
              </span>
            </div>
          </div>
          <div className="divide-line border-line mt-7 divide-y border-y">
            {reservation.items.map((item) => (
              <div
                key={item.id}
                className="flex justify-between gap-4 py-4 text-sm"
              >
                <div>
                  <p className="font-bold">
                    {item.ticketType} × {item.quantity}
                  </p>
                  {item.seat && (
                    <p className="text-muted mt-1">
                      {t("seatLine", {
                        section: item.seat.section,
                        row: item.seat.row,
                        number: item.seat.number,
                      })}
                    </p>
                  )}
                </div>
                <p className="font-bold">
                  {formatCurrency(
                    item.unitPriceCents * item.quantity,
                    reservation.price.currency,
                    locale,
                  )}
                </p>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={release}
            disabled={pending}
            className="text-danger mt-5 inline-flex items-center gap-2 text-sm font-bold"
          >
            <Trash2 aria-hidden="true" className="size-4" />
            {t("releaseTickets")}
          </button>
        </section>

        <section className="border-line bg-surface rounded-2xl border p-5 sm:p-7">
          <div className="flex items-center gap-2">
            <Tag aria-hidden="true" className="text-brand size-5" />
            <h2 className="text-xl font-extrabold">{t("promotionCode")}</h2>
          </div>
          <form
            onSubmit={applyPromotion}
            className="mt-4 flex flex-col gap-3 sm:flex-row"
          >
            <label className="flex-1">
              <span className="sr-only">{t("promotionCode")}</span>
              <input
                name="code"
                required
                maxLength={30}
                defaultValue={reservation.price.promotionCode ?? ""}
                placeholder={t("enterCode")}
                className="border-line h-11 w-full border bg-white px-3 uppercase"
              />
            </label>
            <button
              type="submit"
              className="bg-foreground px-5 py-2 font-bold text-white"
            >
              {t("apply")}
            </button>
          </form>
        </section>

        <section className="border-line bg-surface rounded-2xl border p-5 sm:p-7">
          <h2 className="text-xl font-extrabold">{t("paymentSimulator")}</h2>
          <p className="text-muted mt-1 text-sm">{t("paymentSimulatorHint")}</p>
          <fieldset className="mt-4 grid gap-3 sm:grid-cols-2">
            <legend className="sr-only">{t("paymentOutcome")}</legend>
            {paymentOutcomes.map(([value, label]) => (
              <label
                key={value}
                className="border-line flex items-center gap-3 rounded-xl border p-3 text-sm font-semibold"
              >
                <input
                  type="radio"
                  name="paymentOutcome"
                  value={value}
                  checked={paymentToken === value}
                  onChange={() => setPaymentToken(value)}
                />
                {label}
              </label>
            ))}
          </fieldset>
        </section>
      </div>

      <aside className="border-line bg-surface h-fit rounded-2xl border p-5 shadow-sm lg:sticky lg:top-5">
        <h2 className="text-xl font-extrabold">{t("orderSummary")}</h2>
        <dl className="mt-5 space-y-3 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted">{t("tickets")}</dt>
            <dd>
              {formatCurrency(
                reservation.price.subtotalCents,
                reservation.price.currency,
                locale,
              )}
            </dd>
          </div>
          {reservation.price.discountCents > 0 && (
            <div className="text-brand flex justify-between gap-3">
              <dt>
                {t("promotion", {
                  code: reservation.price.promotionCode ?? "",
                })}
              </dt>
              <dd>
                −
                {formatCurrency(
                  reservation.price.discountCents,
                  reservation.price.currency,
                  locale,
                )}
              </dd>
            </div>
          )}
          <div className="flex justify-between gap-3">
            <dt className="text-muted">{t("serviceFee")}</dt>
            <dd>
              {formatCurrency(
                reservation.price.feeCents,
                reservation.price.currency,
                locale,
              )}
            </dd>
          </div>
          <div className="border-line flex justify-between gap-3 border-t pt-4 text-base font-black">
            <dt>{t("total")}</dt>
            <dd>
              {formatCurrency(
                reservation.price.totalCents,
                reservation.price.currency,
                locale,
              )}
            </dd>
          </div>
        </dl>
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
          onClick={pay}
          disabled={pending || remaining === 0}
          className="bg-brand hover:bg-brand-dark mt-5 w-full px-4 py-3 font-bold text-white"
        >
          {pending ? t("processing") : t("payAndGet")}
        </button>
        <p className="text-muted mt-3 text-xs leading-5">
          {t("revalidationNote")}
        </p>
      </aside>
    </div>
  );
}
