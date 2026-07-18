import { getTranslations } from "next-intl/server";

export default async function Loading() {
  const t = await getTranslations("loading");
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div role="status" aria-label={t("label")} className="animate-pulse">
        <div className="bg-line h-4 w-24 rounded" />
        <div className="bg-line mt-4 h-10 w-80 max-w-full rounded" />
        <div className="bg-line mt-3 h-5 w-96 max-w-full rounded" />
        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="border-line bg-surface h-64 rounded-2xl border"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
