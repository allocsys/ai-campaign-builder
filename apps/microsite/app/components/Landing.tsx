// Shown when the request carries no resolvable business context at all —
// a bare host with no subdomain and no ?slug= dev param (e.g. the raw
// workers.dev URL, or a bare apex domain before any business has claimed
// a subdomain). This is distinct from the per-business 404 in NotFound.tsx,
// which is for a *specific* unknown/unpublished slug. In production this
// path is rare (each business gets its own subdomain), but it's the only
// thing a visitor sees at the platform's own root, so it should read as an
// intentional landing page, not an error.
const DEMO_LINKS = [
  { slug: "narvan", label: "کافه نارون", description: "قالب Minimal Cafe" },
  { slug: "velora", label: "بوتیک ولورا", description: "قالب Bold Retail" },
  { slug: "titan", label: "باشگاه تایتان", description: "قالب Energetic Gym" },
  { slug: "ava", label: "کلینیک زیبایی آوا", description: "قالب Serene Beauty" },
  { slug: "simorgh", label: "رستوران سیمرغ", description: "قالب Fine Dining" },
];

export function Landing() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[var(--surface)] px-6 py-20 text-center">
      <span className="inline-block rounded-full bg-[var(--accent-bg)] px-4 py-1 text-sm text-[var(--accent-text)]">
        ai-campaign-builder
      </span>
      <h1 className="mx-auto mt-6 max-w-xl text-3xl font-bold text-[var(--text)] sm:text-4xl">
        میکروسایت هر کسب‌وکار، روی زیردامنه خودش
      </h1>
      <p className="mx-auto mt-4 max-w-md text-[var(--text-muted)]">
        این صفحه، آدرس اصلی پلتفرم است — نه میکروسایت یک کسب‌وکار خاص. هر
        کسب‌وکار صفحه خودش را روی زیردامنه اختصاصی‌اش می‌بیند.
      </p>

      <div className="mt-10 w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface-card)] p-6 text-right">
        <h2 className="text-sm font-medium text-[var(--text-subtle)]">
          نمونه میکروسایت‌ها
        </h2>
        <ul className="mt-4 divide-y divide-[var(--border)]">
          {DEMO_LINKS.map((demo) => (
            <li key={demo.slug}>
              <a
                href={`/?slug=${demo.slug}`}
                className="flex items-center justify-between py-3 transition hover:opacity-70"
              >
                <span>
                  <span className="block font-medium text-[var(--text)]">
                    {demo.label}
                  </span>
                  <span className="block text-sm text-[var(--text-subtle)]">
                    {demo.description}
                  </span>
                </span>
                <span aria-hidden="true" className="text-[var(--text-subtle)]">
                  ←
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
