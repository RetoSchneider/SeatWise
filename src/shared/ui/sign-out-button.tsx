"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { LogOut } from "lucide-react";

import { authClient } from "@/modules/identity/auth-client";

export function SignOutButton() {
  const t = useTranslations("nav");
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    await authClient.signOut();
    window.location.assign("/");
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={pending}
      className="text-muted hover:text-foreground inline-flex items-center gap-2 px-2 py-1.5 text-sm font-semibold"
    >
      <LogOut aria-hidden="true" className="size-4" />
      {pending ? t("signingOut") : t("signOut")}
    </button>
  );
}
