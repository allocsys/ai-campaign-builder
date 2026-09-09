import type { GalleryContent } from "../lib/mock-data";

export function Gallery({ content }: { content: GalleryContent }) {
  return (
    <section className="mx-auto max-w-3xl px-6 py-16">
      <h2 className="text-2xl font-bold text-[var(--text)]">{content.heading}</h2>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {content.images.map((img, i) => (
          <div
            key={i}
            className="flex h-32 items-center justify-center rounded-lg bg-[var(--gallery-tile)] text-xs text-[var(--gallery-tile-text)]"
          >
            {img.alt}
          </div>
        ))}
      </div>
    </section>
  );
}
