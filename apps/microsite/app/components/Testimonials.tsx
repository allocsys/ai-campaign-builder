import type { TestimonialsContent } from "../lib/mock-data";

export function Testimonials({ content }: { content: TestimonialsContent }) {
  return (
    <section className="mx-auto max-w-2xl px-6 py-16">
      <h2 className="text-2xl font-bold text-[var(--text)]">{content.heading}</h2>
      <div className="mt-6 space-y-4">
        {content.items.map((t, i) => (
          <blockquote key={i} className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5">
            <p className="text-[var(--text)]">{t.quote}</p>
            <footer className="mt-2 text-sm text-[var(--text-subtle)]">— {t.author}</footer>
          </blockquote>
        ))}
      </div>
    </section>
  );
}
