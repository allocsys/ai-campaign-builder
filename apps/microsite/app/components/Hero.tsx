import type { HeroContent } from "../lib/mock-data";
import { HeroAmbient } from "./HeroAmbient";

export function Hero({ content }: { content: HeroContent }) {
  return (
    <section className="relative overflow-hidden border-b border-[var(--border)] bg-[var(--surface-alt)] px-6 py-20 text-center">
      <HeroAmbient />
      <div className="relative z-10">
        <span className="inline-block rounded-full bg-[var(--accent-bg)] px-4 py-1 text-sm text-[var(--accent-text)]">
          {content.badge_label}
        </span>
        <h1 className="mx-auto mt-6 max-w-2xl text-3xl font-bold text-[var(--text)] sm:text-4xl">
          {content.title}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-[var(--text-muted)]">{content.subtitle}</p>
      </div>
    </section>
  );
}
