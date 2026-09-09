export function StickyJoinCta({ href, label }: { href: string; label: string }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
      <a
        href={href}
        className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-[var(--surface-card)] px-6 py-3 font-medium text-[var(--text)] shadow-2xl ring-1 ring-[var(--border)] transition hover:bg-[var(--accent-hover)]"
      >
        {label}
      </a>
    </div>
  );
}
