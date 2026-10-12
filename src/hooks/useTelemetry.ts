/**
 * useTelemetry — bounded, frame-throttled data recorder for live charts.
 *
 * Physics runs at 120 Hz (or much faster when fast-forwarding), but a chart
 * needs neither that many points nor a React re-render per point. This hook:
 *
 *   - keeps only every `stride`-th sample (default: every 4th step ≈ 30 Hz),
 *   - keeps at most `maxSamples` of the most recent samples (sliding window),
 *   - pushes into a ref and publishes to React state at most once per frame.
 *
 * `push(point, force)` — `force: true` always records (use for the final
 * sample, e.g. the landing point, so the curve ends where the run ends).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DataPoint } from '../components/charts/PhysicsChart';

export interface Telemetry {
  data: DataPoint[];
  push: (point: DataPoint, force?: boolean) => void;
  clear: () => void;
}

export function useTelemetry(maxSamples = 1500, stride = 4): Telemetry {
  const bufferRef = useRef<DataPoint[]>([]);
  const counterRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const [data, setData] = useState<DataPoint[]>([]);

  const flush = useCallback(() => {
    rafRef.current = null;
    setData(bufferRef.current.slice());
  }, []);

  const schedule = useCallback(() => {
    if (rafRef.current === null) rafRef.current = requestAnimationFrame(flush);
  }, [flush]);

  const push = useCallback(
    (point: DataPoint, force = false) => {
      const keep = force || counterRef.current % stride === 0;
      counterRef.current += 1;
      if (!keep) return;

      const buf = bufferRef.current;
      buf.push(point);
      if (buf.length > maxSamples) buf.splice(0, buf.length - maxSamples);
      schedule();
    },
    [maxSamples, stride, schedule]
  );

  const clear = useCallback(() => {
    bufferRef.current = [];
    counterRef.current = 0;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setData([]);
  }, []);

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    []
  );

  return { data, push, clear };
}
