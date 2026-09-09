import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * Lightweight scroll-reveal wrapper: fades + slides a section in the first
 * time it enters the viewport. IntersectionObserver + a CSS transition do
 * all the work — no JS animation loop, no framer-motion, no per-frame
 * React re-renders (mirrors the philosophy behind HeroAmbient: let the
 * platform do animation work for free instead of shipping a library for it).
 *
 * Safe-by-default: the server-rendered/no-JS state is always fully visible
 * (no hidden class applied). JS only ever adds a "start hidden, animate in"
 * state for content that's below the fold at load time, and does so inside
 * useLayoutEffect (before paint) so there's no flash of visible-then-hidden
 * content for JS users. This means search crawlers, no-JS browsers, and
 * users with `prefers-reduced-motion: reduce` always see full content
 * immediately — this can never make content permanently invisible.
 */
export function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!("IntersectionObserver" in window)) return;

    const rect = el.getBoundingClientRect();
    const alreadyVisible = rect.top < window.innerHeight * 0.9;
    if (alreadyVisible) return;

    setHidden(true);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHidden(false);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`reveal ${hidden ? "reveal-hidden" : ""} ${className}`}>
      {children}
    </div>
  );
}
