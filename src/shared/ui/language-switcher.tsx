"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";

import { locales, type Locale } from "@/i18n/config";
import { setUserLocale } from "@/i18n/locale";

export function LanguageSwitcher() {
  const t = useTranslations("language");
  const activeLocale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const nextLocale = event.target.value as Locale;
    startTransition(async () => {
      await setUserLocale(nextLocale);
      router.refresh();
    });
  }

  return (
    <label className="text-muted hover:text-foreground inline-flex items-center gap-1.5 text-sm font-semibold">
      <Globe aria-hidden="true" className="size-4" />
      <span className="sr-only">{t("selectAria")}</span>
      <select
        value={activeLocale}
        onChange={onChange}
        disabled={pending}
        className="cursor-pointer border-none bg-transparent py-1.5 pr-1 font-semibold focus-visible:outline-2"
      >
        {locales.map((locale) => (
          <option key={locale} value={locale}>
            {t(locale)}
          </option>
        ))}
      </select>
    </label>
  );
}
