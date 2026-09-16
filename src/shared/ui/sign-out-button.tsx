"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { authClient } from "@/modules/identity/auth-client";

export function SignOutButton() {
  const router = useRouter();
  const t = useTranslations("nav");
  const common = useTranslations("common");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    try {
      const result = await authClient.signOut();
      if (result.error) {
        setError(common("requestFailed"));
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError(common("requestFailed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={signOut}
        disabled={pending}
        className="text-muted hover:text-foreground inline-flex items-center gap-2 px-2 py-1.5 text-sm font-semibold"
      >
        <LogOut aria-hidden="true" className="size-4" />
        {pending ? t("signingOut") : t("signOut")}
      </button>
      {error && (
        <p role="alert" className="text-danger text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
