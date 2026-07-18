import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Braces, KeyRound, RefreshCw } from "lucide-react";

import { openApiDocument } from "@/shared/http/openapi";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("docs");
  return { title: t("metaTitle") };
}

export default async function ApiDocumentationPage() {
  const t = await getTranslations("docs");
  const operations = Object.entries(openApiDocument.paths).flatMap(
    ([path, pathItem]) =>
      Object.entries(pathItem).map(([method, operation]) => ({
        path,
        method: method.toUpperCase(),
        summary: operation.summary,
        description:
          "description" in operation ? operation.description : undefined,
        protected:
          "security" in operation && Boolean(operation.security?.length),
      })),
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="text-brand text-sm font-bold">{t("eyebrow")}</p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight">{t("title")}</h1>
          <p className="text-muted mt-3 max-w-3xl">{t("intro")}</p>
        </div>
        <Link
          href="/api/v1/openapi"
          className="border-line bg-surface inline-flex items-center gap-2 border px-4 py-2.5 text-sm font-bold"
        >
          <Braces aria-hidden="true" className="size-4" />
          {t("openApiJson")}
        </Link>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <article className="border-line bg-surface rounded-2xl border p-5">
          <KeyRound aria-hidden="true" className="text-brand size-6" />
          <h2 className="mt-3 font-extrabold">{t("authTitle")}</h2>
          <p className="text-muted mt-1 text-sm">{t("authText")}</p>
        </article>
        <article className="border-line bg-surface rounded-2xl border p-5">
          <RefreshCw aria-hidden="true" className="text-brand size-6" />
          <h2 className="mt-3 font-extrabold">{t("idempotencyTitle")}</h2>
          <p className="text-muted mt-1 text-sm">{t("idempotencyText")}</p>
        </article>
        <article className="border-line bg-surface rounded-2xl border p-5">
          <Braces aria-hidden="true" className="text-brand size-6" />
          <h2 className="mt-3 font-extrabold">{t("errorsTitle")}</h2>
          <p className="text-muted mt-1 text-sm">{t("errorsText")}</p>
        </article>
      </div>

      <section className="mt-10" aria-labelledby="endpoints-title">
        <h2 id="endpoints-title" className="text-2xl font-black">
          {t("endpoints")}
        </h2>
        <div className="mt-5 space-y-3">
          {operations.map((operation) => (
            <article
              key={`${operation.method}:${operation.path}`}
              className="border-line bg-surface grid gap-3 rounded-xl border p-4 sm:grid-cols-[6rem_1fr_auto] sm:items-center"
            >
              <span
                className={`w-fit rounded px-2 py-1 font-mono text-xs font-black ${
                  operation.method === "GET"
                    ? "bg-blue-50 text-blue-800"
                    : operation.method === "DELETE"
                      ? "text-danger bg-red-50"
                      : "bg-accent text-brand"
                }`}
              >
                {operation.method}
              </span>
              <div>
                <code className="text-sm font-bold">{operation.path}</code>
                <p className="text-muted mt-1 text-sm">{operation.summary}</p>
                {operation.description && (
                  <p className="text-muted mt-1 text-xs">
                    {operation.description}
                  </p>
                )}
              </div>
              {operation.protected && (
                <span className="text-muted text-xs font-bold">
                  {t("session")}
                </span>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="border-line mt-10 rounded-2xl border bg-[#173f32] p-6 text-white">
        <h2 className="text-xl font-extrabold">{t("paymentSimulator")}</h2>
        <p className="mt-2 text-sm text-white/75">
          {t.rich("paymentSimulatorText", {
            code: (chunks) => <code>{chunks}</code>,
          })}
        </p>
      </section>
    </div>
  );
}
