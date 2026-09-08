import type { BookingCtaContent } from "../lib/mock-data";

export function BookingCta({ content }: { content: BookingCtaContent }) {
  return (
    <section className="bg-stone-900 px-6 py-16 text-center text-white">
      <h2 className="text-2xl font-bold">{content.heading}</h2>
      <button
        type="button"
        className="mt-5 rounded-full bg-white px-6 py-2.5 font-medium text-stone-900 transition hover:bg-stone-100"
      >
        {content.button_label}
      </button>
    </section>
  );
}
