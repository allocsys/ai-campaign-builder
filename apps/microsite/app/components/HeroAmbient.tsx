import { useEffect, useRef } from "react";

/**
 * Subtle ambient canvas background for the hero section.
 *
 * Inspired by allocsys/madmcp-orchestration-viz: let plain Canvas2D +
 * requestAnimationFrame do cheap, GPU-friendly drawing instead of animating
 * real DOM nodes with a JS library (framer-motion et al.). Two techniques
 * borrowed directly from that piece, scaled way down for a marketing hero:
 *
 *  1. Cached gradient "sprites" — each soft blob's radial gradient is drawn
 *     once to an offscreen canvas and reused every frame via drawImage(),
 *     instead of calling createRadialGradient() per blob per frame (mirrors
 *     the viz's shimmerTextureCache/trailTextureCache pattern).
 *  2. prefers-reduced-motion freezes the scene to a single static frame
 *     instead of looping forever, same as the viz's reducedMotion checks.
 *
 * No dependency, no bundle-size cost — native browser APIs only. Purely
 * decorative (aria-hidden), positioned behind the hero's real text content.
 */
export function HeroAmbient() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    function resize() {
      const rect = canvas!.getBoundingClientRect();
      width = canvas!.width = rect.width;
      height = canvas!.height = rect.height;
    }
    resize();
    window.addEventListener("resize", resize);

    // Three very soft blobs — indigo / amber / green, matching the brand's
    // existing accents elsewhere in the app without introducing new colors.
    const palette = ["#c7d2fe", "#fde68a", "#bbf7d0"];
    const blobs = palette.map((color, i) => {
      const size = 480;
      const off = document.createElement("canvas");
      off.width = off.height = size;
      const octx = off.getContext("2d")!;
      const grd = octx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      grd.addColorStop(0, color + "55");
      grd.addColorStop(1, color + "00");
      octx.fillStyle = grd;
      octx.fillRect(0, 0, size, size);
      return {
        sprite: off,
        size,
        baseX: 0.2 + i * 0.3,
        baseY: 0.3 + (i % 2) * 0.3,
        speed: 0.00006 + i * 0.00002,
        phase: i * 2.1,
      };
    });

    let raf = 0;
    function draw(now: number) {
      ctx!.clearRect(0, 0, width, height);
      blobs.forEach((b) => {
        const t = reducedMotion ? 0 : now * b.speed + b.phase;
        const x = width * b.baseX + Math.sin(t) * width * 0.08;
        const y = height * b.baseY + Math.cos(t * 0.8) * height * 0.1;
        ctx!.drawImage(b.sprite, x - b.size / 2, y - b.size / 2);
      });
      if (!reducedMotion) raf = requestAnimationFrame(draw);
    }
    draw(0);

    return () => {
      window.removeEventListener("resize", resize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 h-full w-full"
    />
  );
}
