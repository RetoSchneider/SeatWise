"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

export function RefundReviewButtons({
  refundRequestId,
  scope,
}: {
  refundRequestId: string;
  scope: "organizer" | "admin";
}) {
  const common = useTranslations("common");
  const t = useTranslations("refundReview");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function decide(decision: "APPROVE" | "REJECT") {
    try {
      setPending(true);
      setError("");
      const response = await fetch(
        `/api/v1/${scope}/refunds/${refundRequestId}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ decision }),
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

  return (
    <div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => decide("APPROVE")}
          disabled={pending}
          className="bg-brand px-3 py-1.5 text-xs font-bold text-white"
        >
          {t("approve")}
        </button>
        <button
          type="button"
          onClick={() => decide("REJECT")}
          disabled={pending}
          className="border-line border px-3 py-1.5 text-xs font-bold"
        >
          {t("reject")}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-danger mt-2 text-xs font-bold">
          {error}
        </p>
      )}
    </div>
  );
}
