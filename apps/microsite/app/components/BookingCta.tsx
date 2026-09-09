import type { BookingCtaContent } from "../lib/mock-data";

export function BookingCta({ content }: { content: BookingCtaContent }) {
  return (
    <section className="bg-[var(--accent-bg)] px-6 py-16 text-center text-[var(--accent-text)]">
      <h2 className="text-2xl font-bold">{content.heading}</h2>
      <button
        type="button"
        className="mt-5 rounded-full bg-[var(--surface-card)] px-6 py-2.5 font-medium text-[var(--text)] transition hover:bg-[var(--accent-hover)]"
      >
        {content.button_label}
      </button>
    </section>
  );
}
