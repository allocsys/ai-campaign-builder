import type { ProductMenuContent } from "../lib/mock-data";

export function ProductMenu({ content }: { content: ProductMenuContent }) {
  return (
    <section className="bg-[var(--surface-alt)] px-6 py-16">
      <div className="mx-auto max-w-2xl">
        <h2 className="text-2xl font-bold text-[var(--text)]">{content.heading}</h2>
        <ul className="mt-6 divide-y divide-[var(--border)]">
          {content.items.map((item) => (
            <li key={item.name} className="flex items-center justify-between py-3">
              <span className="text-[var(--text)]">{item.name}</span>
              <span className="font-medium text-[var(--text)]">
                {item.price_toman.toLocaleString("fa-IR")} تومان
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
