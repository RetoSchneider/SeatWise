"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

export function EventStatusButton({
  eventId,
  action,
  scope = "organizer",
}: {
  eventId: string;
  action: "PUBLISH" | "UNPUBLISH" | "CANCEL";
  scope?: "organizer" | "admin";
}) {
  const common = useTranslations("common");
  const t = useTranslations("organizer.eventStatus");
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function update() {
    try {
      if (action === "CANCEL" && !window.confirm(t("confirmCancel"))) {
        return;
      }
      setPending(true);
      setError("");
      const response = await fetch(
        `/api/v1/${scope}/events/${eventId}/status`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );
      if (!response.ok) {
        const payload = (await response.json()) as {
          error?: { message?: string };
        };
        setError(payload.error?.message ?? t("failed"));
        return;
      }
      router.refresh();
    } catch {
      setError(common("requestFailed"));
    } finally {
      setPending(false);
    }
  }

  const actionLabel = {
    PUBLISH: t("publish"),
    UNPUBLISH: t("unpublish"),
    CANCEL: t("cancel"),
  }[action];

  return (
    <div>
      <button
        type="button"
        onClick={update}
        disabled={pending}
        className={`px-3 py-1.5 text-xs font-bold ${
          action === "CANCEL"
            ? "text-danger border border-red-200"
            : "border-line text-brand border"
        }`}
      >
        {pending ? t("saving") : actionLabel}
      </button>
      {error && (
        <p role="alert" className="text-danger mt-1 max-w-52 text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
