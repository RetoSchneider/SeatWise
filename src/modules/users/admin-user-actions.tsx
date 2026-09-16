"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

export function RoleSelect({
  userId,
  currentRole,
}: {
  userId: string;
  currentRole: "CUSTOMER" | "ORGANIZER" | "ADMINISTRATOR";
}) {
  const common = useTranslations("common");
  const t = useTranslations("admin.userActions");
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function update(role: string) {
    try {
      setPending(true);
      setError("");
      const response = await fetch(`/api/v1/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as {
          error?: { message?: string };
        };
        setError(payload.error?.message ?? t("roleFailed"));
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
      <label>
        <span className="sr-only">{t("role")}</span>
        <select
          value={currentRole}
          disabled={pending}
          onChange={(event) => update(event.target.value)}
          className="border-line h-9 border bg-white px-2 text-xs font-bold"
        >
          <option value="CUSTOMER">{t("roleCustomer")}</option>
          <option value="ORGANIZER">{t("roleOrganizer")}</option>
          <option value="ADMINISTRATOR">{t("roleAdministrator")}</option>
        </select>
      </label>
      {error && (
        <p role="alert" className="text-danger mt-1 text-xs">
          {error}
        </p>
      )}
    </div>
  );
}

export function OrganizerStatusSelect({
  organizerId,
  currentStatus,
}: {
  organizerId: string;
  currentStatus: "PENDING" | "ACTIVE" | "SUSPENDED";
}) {
  const common = useTranslations("common");
  const t = useTranslations("admin.userActions");
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function update(status: string) {
    try {
      setPending(true);
      const response = await fetch(
        `/api/v1/admin/organizers/${organizerId}/status`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      if (!response.ok) {
        setError(common("requestFailed"));
        return;
      }
      setError("");
      router.refresh();
    } catch {
      setError(common("requestFailed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <label>
      <span className="sr-only">{t("organizerStatus")}</span>
      <select
        value={currentStatus}
        disabled={pending}
        onChange={(event) => update(event.target.value)}
        className="border-line h-9 border bg-white px-2 text-xs font-bold"
      >
        <option value="PENDING">{t("statusPending")}</option>
        <option value="ACTIVE">{t("statusActive")}</option>
        <option value="SUSPENDED">{t("statusSuspended")}</option>
      </select>
      {error && (
        <span role="alert" className="text-danger text-xs">
          {error}
        </span>
      )}
    </label>
  );
}
