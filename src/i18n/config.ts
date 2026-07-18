export const locales = ["en", "de"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export const localeCookieName = "seatwise.locale";

const bcp47ByLocale: Record<Locale, string> = {
  en: "en-US",
  de: "de-CH",
};

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

export function toBcp47(locale: string): string {
  return isLocale(locale)
    ? bcp47ByLocale[locale]
    : bcp47ByLocale[defaultLocale];
}

export const localeLabels: Record<Locale, string> = {
  en: "English",
  de: "Deutsch",
};
