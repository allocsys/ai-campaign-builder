import type { AboutContent } from "../lib/mock-data";

export function About({ content }: { content: AboutContent }) {
  return (
    <section className="mx-auto max-w-3xl px-6 py-16">
      <h2 className="text-2xl font-bold text-stone-900">{content.heading}</h2>
      <p className="mt-4 leading-relaxed text-stone-600">{content.description}</p>
    </section>
  );
}
