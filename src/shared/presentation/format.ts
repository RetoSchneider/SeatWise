import { toBcp47 } from "@/i18n/config";

export function formatCurrency(cents: number, currency = "CHF", locale = "en") {
  return new Intl.NumberFormat(toBcp47(locale), {
    style: "currency",
    currency,
  }).format(cents / 100);
}

export function formatDateTime(
  value: Date | string,
  timeZone?: string,
  locale = "en",
) {
  return new Intl.DateTimeFormat(toBcp47(locale), {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value));
}

export function formatDate(value: Date | string, locale = "en") {
  return new Intl.DateTimeFormat(toBcp47(locale), {
    dateStyle: "long",
  }).format(new Date(value));
}
