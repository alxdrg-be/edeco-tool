import { useEffect, useLayoutEffect, useRef, useState } from "react";

interface AnimationOptions { enabled?: boolean; immediate?: boolean; duration?: number }
const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Animate pixels/normalized geometry only. Calculation values and status stay exact. */
export function useAnimatedGeometry<T extends Record<string, number>>(target: T, { enabled = true, immediate = false, duration = 260 }: AnimationOptions = {}): T {
  const [frame, setFrame] = useState<T>(target), current = useRef<T>(target);
  const request = useRef<number | null>(null);
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion);
  const signature = JSON.stringify(target);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useLayoutEffect(() => {
    if (request.current !== null) cancelAnimationFrame(request.current);
    if (!enabled || immediate || reducedMotion || duration <= 0) {
      current.current = target;
      setFrame(target);
      return;
    }
    const keys = Object.keys(target), from = current.current;
    if (keys.every(key => from[key] === target[key])) return;
    const started = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, Math.max(0, (now - started) / duration));
      const eased = 1 - (1 - progress) ** 3;
      const next = Object.fromEntries(keys.map(key => {
        const start = Number.isFinite(from[key]) ? from[key] : target[key];
        return [key, start + (target[key] - start) * eased];
      })) as T;
      current.current = next;
      setFrame(next);
      request.current = progress < 1 ? requestAnimationFrame(tick) : null;
    };
    request.current = requestAnimationFrame(tick);
    return () => { if (request.current !== null) cancelAnimationFrame(request.current); };
    // The serialized numeric target avoids restarting on a freshly allocated record.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, enabled, immediate, reducedMotion, duration]);
  if (!enabled || immediate || reducedMotion) return target;
  return Object.fromEntries(Object.keys(target).map(key => [key, frame[key] ?? target[key]])) as T;
}
