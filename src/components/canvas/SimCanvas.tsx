/**
 * SimCanvas — a crisp, responsive 2D canvas for simulations.
 *
 * - Sizes itself to its container with a ResizeObserver (no window listeners).
 * - Renders at devicePixelRatio so lines and text stay sharp on HiDPI screens.
 * - The canvas is absolutely positioned inside a fixed-height host, so its
 *   bitmap size can never push the surrounding grid wider.
 * - Draw callbacks work in CSS pixels: `draw(ctx, width, height, time)`.
 * - Resizing only happens when the container size really changes — drawing a
 *   frame never reallocates the bitmap.
 *
 * Redraw rules:
 *   • animate = false (default): redraws whenever the `draw` function changes,
 *     i.e. on every React render of the page (physics state → new closure).
 *   • animate = true: also runs its own requestAnimationFrame loop and passes a
 *     continuously increasing `time` (seconds) — for decorative motion that is
 *     independent of the physics clock (light pulses, twinkling stars, …).
 *     Skipped under `prefers-reduced-motion` (a single static frame is drawn).
 */
import React, { useCallback, useEffect, useRef } from 'react';

export type DrawFn = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number
) => void;

export interface CanvasPointer {
  /** Pointer position in CSS pixels, relative to the canvas top-left. */
  x: number;
  y: number;
  event: React.PointerEvent<HTMLCanvasElement>;
}

interface SimCanvasProps {
  height: number;
  draw: DrawFn;
  animate?: boolean;
  className?: string;
  ariaLabel?: string;
  /** CSS cursor, e.g. "grab" when the canvas is draggable. */
  cursor?: string;
  onPointerDown?: (p: CanvasPointer) => void;
  onPointerMove?: (p: CanvasPointer) => void;
  onPointerUp?: (p: CanvasPointer) => void;
  onPointerLeave?: (p: CanvasPointer) => void;
}

const MAX_DPR = 2.5;

export const SimCanvas: React.FC<SimCanvasProps> = ({
  height,
  draw,
  animate = false,
  className = '',
  ariaLabel,
  cursor,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerLeave,
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawRef = useRef<DrawFn>(draw);
  drawRef.current = draw;
  const sizeRef = useRef({ width: 0, dpr: 1 });

  const render = useCallback(
    (time: number) => {
      const canvas = canvasRef.current;
      const { width, dpr } = sizeRef.current;
      if (!canvas || width === 0) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.save();
      drawRef.current(ctx, width, height, time);
      ctx.restore();
    },
    [height]
  );

  // Track the container size.
  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    const resize = () => {
      const width = Math.max(1, Math.floor(host.clientWidth));
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      const pw = Math.round(width * dpr);
      const ph = Math.round(height * dpr);
      if (canvas.width !== pw) canvas.width = pw;
      if (canvas.height !== ph) canvas.height = ph;
      sizeRef.current = { width, dpr };
      render(performance.now() / 1000);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    return () => observer.disconnect();
  }, [height, render]);

  // Redraw when the page hands us a new draw function.
  useEffect(() => {
    render(performance.now() / 1000);
  }, [draw, render]);

  // Optional free-running animation loop.
  useEffect(() => {
    if (!animate) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    let frame = 0;
    const loop = (now: number) => {
      render(now / 1000);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [animate, render]);

  const toPointer =
    (handler?: (p: CanvasPointer) => void) => (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!handler) return;
      const rect = event.currentTarget.getBoundingClientRect();
      handler({ x: event.clientX - rect.left, y: event.clientY - rect.top, event });
    };

  const interactive = Boolean(onPointerDown || onPointerMove || onPointerUp);

  return (
    <div
      ref={hostRef}
      className={`relative w-full overflow-hidden ${className}`}
      style={{ height }}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={ariaLabel}
        className="absolute inset-0 block h-full w-full"
        style={{ cursor, touchAction: interactive ? 'none' : undefined }}
        onPointerDown={toPointer(onPointerDown)}
        onPointerMove={toPointer(onPointerMove)}
        onPointerUp={toPointer(onPointerUp)}
        onPointerLeave={toPointer(onPointerLeave)}
      />
    </div>
  );
};
