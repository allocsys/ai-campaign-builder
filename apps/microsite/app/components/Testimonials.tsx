import type { TestimonialsContent } from "../lib/mock-data";

export function Testimonials({ content }: { content: TestimonialsContent }) {
  return (
    <section className="mx-auto max-w-2xl px-6 py-16">
      <h2 className="text-2xl font-bold text-stone-900">{content.heading}</h2>
      <div className="mt-6 space-y-4">
        {content.items.map((t, i) => (
          <blockquote key={i} className="rounded-xl border border-stone-200 bg-white p-5">
            <p className="text-stone-700">{t.quote}</p>
            <footer className="mt-2 text-sm text-stone-500">— {t.author}</footer>
          </blockquote>
        ))}
      </div>
    </section>
  );
}
