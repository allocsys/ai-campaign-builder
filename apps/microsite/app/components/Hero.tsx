import type { HeroContent } from "../lib/mock-data";

export function Hero({ content }: { content: HeroContent }) {
  return (
    <section className="border-b border-stone-200 bg-stone-50 px-6 py-20 text-center">
      <span className="inline-block rounded-full bg-stone-900 px-4 py-1 text-sm text-white">
        {content.badge_label}
      </span>
      <h1 className="mx-auto mt-6 max-w-2xl text-3xl font-bold text-stone-900 sm:text-4xl">
        {content.title}
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-stone-600">{content.subtitle}</p>
    </section>
  );
}
