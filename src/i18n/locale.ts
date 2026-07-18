"use server";

import { cookies } from "next/headers";

import {
  defaultLocale,
  isLocale,
  localeCookieName,
  type Locale,
} from "@/i18n/config";

const oneYearInSeconds = 60 * 60 * 24 * 365;

export async function getUserLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(localeCookieName)?.value;
  return value && isLocale(value) ? value : defaultLocale;
}

export async function setUserLocale(locale: Locale): Promise<void> {
  const store = await cookies();
  store.set(localeCookieName, locale, {
    path: "/",
    maxAge: oneYearInSeconds,
    sameSite: "lax",
    httpOnly: false,
  });
}
