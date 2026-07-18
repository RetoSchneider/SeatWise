"use client";

import { useTranslations } from "next-intl";

export default function GlobalError({ reset }: { reset: () => void }) {
  const t = useTranslations("errorPage");

  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="text-danger text-sm font-bold">{t("eyebrow")}</p>
      <h1 className="mt-2 text-4xl font-black tracking-tight">{t("title")}</h1>
      <p className="text-muted mt-4">{t("text")}</p>
      <button
        type="button"
        onClick={reset}
        className="bg-brand mt-7 px-5 py-3 font-bold text-white"
      >
        {t("tryAgain")}
      </button>
    </div>
  );
}
