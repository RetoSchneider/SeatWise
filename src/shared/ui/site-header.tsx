import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Armchair } from "lucide-react";

import { getCurrentUser } from "@/modules/identity/authorization";
import { LanguageSwitcher } from "@/shared/ui/language-switcher";
import { SignOutButton } from "@/shared/ui/sign-out-button";

export async function SiteHeader() {
  const user = await getCurrentUser();
  const t = await getTranslations("nav");

  return (
    <header className="border-line bg-surface border-b">
      <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="mr-auto inline-flex items-center gap-2 rounded-md text-lg font-extrabold tracking-tight"
        >
          <span className="bg-brand grid size-9 place-items-center rounded-lg text-white">
            <Armchair aria-hidden="true" className="size-5" />
          </span>
          SeatWise
        </Link>
        <nav
          aria-label={t("primaryAria")}
          className="order-3 w-full sm:order-2 sm:w-auto"
        >
          <ul className="flex flex-wrap items-center gap-1">
            <li>
              <Link
                href="/events"
                className="text-muted hover:text-foreground block px-3 py-2 text-sm font-semibold"
              >
                {t("events")}
              </Link>
            </li>
            {user && (
              <>
                <li>
                  <Link
                    href="/account"
                    className="text-muted hover:text-foreground block px-3 py-2 text-sm font-semibold"
                  >
                    {t("myAccount")}
                  </Link>
                </li>
                {user.role === "ORGANIZER" && (
                  <li>
                    <Link
                      href="/organizer"
                      className="text-muted hover:text-foreground block px-3 py-2 text-sm font-semibold"
                    >
                      {t("organizer")}
                    </Link>
                  </li>
                )}
                {user.role === "ADMINISTRATOR" && (
                  <li>
                    <Link
                      href="/admin"
                      className="text-muted hover:text-foreground block px-3 py-2 text-sm font-semibold"
                    >
                      {t("administration")}
                    </Link>
                  </li>
                )}
              </>
            )}
          </ul>
        </nav>
        <div className="order-2 flex items-center gap-2 sm:order-3">
          <LanguageSwitcher />
          {user ? (
            <>
              <span className="text-muted hidden text-sm lg:inline">
                {user.name}
              </span>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="text-muted hover:text-foreground px-3 py-2 text-sm font-semibold"
              >
                {t("signIn")}
              </Link>
              <Link
                href="/register"
                className="bg-brand hover:bg-brand-dark px-4 py-2 text-sm font-bold text-white"
              >
                {t("createAccount")}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
