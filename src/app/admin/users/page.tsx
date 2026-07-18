import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { getCurrentUser } from "@/modules/identity/authorization";
import {
  OrganizerStatusSelect,
  RoleSelect,
} from "@/modules/users/admin-user-actions";
import { listUsers } from "@/modules/users/admin-service";
import { formatDateTime } from "@/shared/presentation/format";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.users");
  return { title: t("metaTitle") };
}

export default async function AdminUsersPage() {
  const t = await getTranslations("admin.users");
  const tc = await getTranslations("common");
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?callbackURL=/admin/users");
  if (user.role !== "ADMINISTRATOR") redirect("/account");
  const users = await listUsers();

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <Link href="/admin" className="text-brand text-sm font-bold">
        {t("back")}
      </Link>
      <h1 className="mt-5 text-3xl font-black tracking-tight">{t("title")}</h1>
      <div className="border-line bg-surface mt-7 overflow-x-auto rounded-2xl border">
        <table className="w-full min-w-4xl text-left text-sm">
          <thead className="border-line bg-accent/60 border-b">
            <tr>
              <th scope="col" className="px-4 py-3">
                {t("user")}
              </th>
              <th scope="col" className="px-4 py-3">
                {t("joined")}
              </th>
              <th scope="col" className="px-4 py-3">
                {t("email")}
              </th>
              <th scope="col" className="px-4 py-3">
                {t("role")}
              </th>
              <th scope="col" className="px-4 py-3">
                {t("organizerStatus")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-line divide-y">
            {users.map((managedUser) => (
              <tr key={managedUser.id}>
                <td className="px-4 py-3">
                  <span className="block font-bold">{managedUser.name}</span>
                  <span className="text-muted text-xs">
                    {managedUser.email}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs">
                  {formatDateTime(managedUser.createdAt, undefined, locale)}
                </td>
                <td className="px-4 py-3 text-xs font-bold">
                  {managedUser.emailVerified ? t("verified") : t("unverified")}
                </td>
                <td className="px-4 py-3">
                  <RoleSelect
                    userId={managedUser.id}
                    currentRole={managedUser.role}
                  />
                </td>
                <td className="px-4 py-3">
                  {managedUser.organizerProfile ? (
                    <OrganizerStatusSelect
                      organizerId={managedUser.organizerProfile.id}
                      currentStatus={managedUser.organizerProfile.status}
                    />
                  ) : (
                    <span className="text-muted text-xs">
                      {tc("notApplicable")}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
