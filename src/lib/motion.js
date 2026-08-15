/* Motion helpers. Every one of these degrades to "final state, instantly"
   when the visitor asks for reduced motion — the animation is decoration
   on top of a page that already reads correctly without it. */
import { useEffect, useRef, useState } from 'react';

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** True once the element has scrolled into view (fires once). */
export function useInView(options = { threshold: 0.25 }) {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setSeen(true);
        io.disconnect();
      }
    }, options);
    io.observe(el);
    return () => io.disconnect();
  }, [seen, options]);

  return [ref, seen];
}

const easeOutExpo = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

/** Count from 0 to `value` once `run` flips true. */
export function useCountUp(value, run, duration = 1400) {
  const [n, setN] = useState(() => (prefersReducedMotion() ? value : 0));

  useEffect(() => {
    if (!run) return;
    if (prefersReducedMotion()) {
      setN(value);
      return;
    }
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      setN(value * easeOutExpo(t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, run, duration]);

  return n;
}

/** 0 -> 1 progress ramp, for driving SVG path reveals. */
export function useProgress(run, duration = 1600, delay = 0) {
  const [p, setP] = useState(() => (prefersReducedMotion() ? 1 : 0));

  useEffect(() => {
    if (!run) return;
    if (prefersReducedMotion()) {
      setP(1);
      return;
    }
    let raf;
    const start = performance.now() + delay;
    const tick = (now) => {
      const t = Math.max(0, Math.min(1, (now - start) / duration));
      setP(easeOutExpo(t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, duration, delay]);

  return p;
}

/**
 * Element width in pixels, kept current across resizes.
 *
 * Layout thresholds ("can this segment hold its own label?") have to be
 * decided in pixels. A percentage threshold looks right on a desktop bar
 * and clips words in half on a phone, because the same 15% is 150px in
 * one place and 53px in the other.
 */
export function useWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setW(el.clientWidth || 0);
    measure();
    if (!('ResizeObserver' in window)) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, w];
}
