import Link from "next/link";
import { getTranslations } from "next-intl/server";

export async function SiteFooter() {
  const t = await getTranslations("footer");

  return (
    <footer className="border-line bg-surface mt-16 border-t">
      <div className="text-muted mx-auto flex max-w-7xl flex-col gap-5 px-4 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p>{t("tagline")}</p>
        <nav aria-label={t("aria")}>
          <ul className="flex flex-wrap gap-5">
            <li>
              <Link href="/events" className="hover:text-foreground">
                {t("browseEvents")}
              </Link>
            </li>
            <li>
              <Link href="/docs/api" className="hover:text-foreground">
                {t("apiDocs")}
              </Link>
            </li>
            {process.env.NODE_ENV === "development" && (
              <li>
                <a
                  href="http://localhost:8025"
                  className="hover:text-foreground"
                >
                  {t("devMail")}
                </a>
              </li>
            )}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
