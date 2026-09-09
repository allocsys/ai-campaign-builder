import type { AboutContent } from "../lib/mock-data";

export function About({ content }: { content: AboutContent }) {
  return (
    <section className="mx-auto max-w-3xl px-6 py-16">
      <h2 className="text-2xl font-bold text-[var(--text)]">{content.heading}</h2>
      <p className="mt-4 leading-relaxed text-[var(--text-muted)]">{content.description}</p>
    </section>
  );
}
