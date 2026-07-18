import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function NotFound() {
  const t = await getTranslations("notFound");

  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="text-brand text-sm font-bold">{t("code")}</p>
      <h1 className="mt-2 text-4xl font-black tracking-tight">{t("title")}</h1>
      <p className="text-muted mt-4">{t("text")}</p>
      <Link
        href="/events"
        className="bg-brand mt-7 inline-block px-5 py-3 font-bold text-white"
      >
        {t("browseEvents")}
      </Link>
    </div>
  );
}
