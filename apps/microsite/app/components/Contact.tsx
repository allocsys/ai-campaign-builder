import type { ContactContent } from "../lib/mock-data";

export function Contact({ content }: { content: ContactContent }) {
  const rows: { label: string; value: string }[] = [
    { label: "آدرس", value: content.address },
    { label: "تلفن", value: content.phone },
    { label: "ساعات کاری", value: content.hours },
  ];
  return (
    <section className="bg-stone-50 px-6 py-16">
      <div className="mx-auto grid max-w-2xl gap-4 sm:grid-cols-3">
        {rows.map((row) => (
          <div
            key={row.label}
            className="rounded-xl border border-stone-200 bg-white p-4 text-center"
          >
            <div className="text-sm text-stone-500">{row.label}</div>
            <div className="mt-1 font-medium text-stone-900">{row.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
