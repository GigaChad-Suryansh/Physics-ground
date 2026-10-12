/**
 * Small, dependency-free canvas drawing helpers shared by every simulation
 * scene: nice axis ticks, arrows with heads, readable text tags, glowing dots
 * and a seeded random generator for stable decorations (stars, sparkles).
 *
 * All functions draw in CSS pixels (SimCanvas already applies the DPR scale).
 */

export const MONO = '11px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
export const SANS = '12px Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';

/** A "nice" step (1, 2, 5 × 10ⁿ) so that `range` holds roughly `target` ticks. */
export function niceStep(range: number, target = 5): number {
  if (!(range > 0) || !Number.isFinite(range)) return 1;
  const raw = range / Math.max(1, target);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const mult = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
  return mult * mag;
}

/** Tick values from `min` to `max` (inclusive) on a nice step. */
export function niceTicks(min: number, max: number, target = 5): number[] {
  const step = niceStep(max - min, target);
  const first = Math.ceil(min / step - 1e-9) * step;
  const out: number[] = [];
  for (let v = first; v <= max + step * 1e-6; v += step) {
    out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
    if (out.length > 200) break;
  }
  return out;
}

/** Format a tick value with just enough decimals for its step. */
export function formatTickValue(value: number, step: number): string {
  if (value === 0) return '0';
  const decimals = step >= 1 ? 0 : Math.min(4, Math.ceil(-Math.log10(step)));
  return value.toFixed(decimals);
}

export interface ArrowOptions {
  width?: number;
  head?: number;
  dash?: number[];
  alpha?: number;
}

/** A line with a filled triangular head at (x1, y1). Tiny arrows draw only a head-less stub. */
export function drawArrow(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: string,
  { width = 2, head = 8, dash, alpha = 1 }: ArrowOptions = {}
): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  if (len < 0.5) return;

  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  if (dash) ctx.setLineDash(dash);

  const h = Math.min(head, len * 0.6);
  const ux = dx / len;
  const uy = dy / len;

  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1 - ux * h * 0.6, y1 - uy * h * 0.6);
  ctx.stroke();
  ctx.setLineDash([]);

  if (len > 4) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - ux * h - uy * h * 0.45, y1 - uy * h + ux * h * 0.45);
    ctx.lineTo(x1 - ux * h + uy * h * 0.45, y1 - uy * h - ux * h * 0.45);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

export interface TagOptions {
  color?: string;
  bg?: string;
  border?: string;
  align?: 'left' | 'center' | 'right';
  baseline?: 'top' | 'middle' | 'bottom';
  font?: string;
  padX?: number;
  padY?: number;
}

export interface TagBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Text on a dark rounded pill so labels stay readable on top of lines and
 * arrows. Returns the box that was drawn (handy for simple collision nudging).
 */
export function drawTag(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  {
    color = '#e2e8f0',
    bg = 'rgba(7, 11, 20, 0.78)',
    border,
    align = 'left',
    baseline = 'middle',
    font = MONO,
    padX = 6,
    padY = 3,
  }: TagOptions = {}
): TagBox {
  ctx.save();
  ctx.font = font;
  const textW = ctx.measureText(text).width;
  const fontPx = parseInt(font, 10) || 11;
  const w = textW + padX * 2;
  const h = fontPx + padY * 2;
  const bx = align === 'left' ? x : align === 'center' ? x - w / 2 : x - w;
  const by = baseline === 'top' ? y : baseline === 'middle' ? y - h / 2 : y - h;

  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(bx, by, w, h, Math.min(6, h / 2));
  ctx.fill();
  if (border) {
    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, bx + padX, by + h / 2 + 0.5);
  ctx.restore();
  return { x: bx, y: by, w, h };
}

/** A soft glowing disc. */
export function glowDot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  glow = radius * 2.4
): void {
  ctx.save();
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius + glow);
  g.addColorStop(0, color);
  g.addColorStop(Math.min(0.95, radius / (radius + glow)), color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha *= 0.35;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, radius + glow, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Deterministic PRNG (mulberry32) — stable stars / sparkles between frames. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Faint static stars for night-sky backgrounds. `twinkle` is a time in seconds (or 0 for static). */
export function drawStars(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  count = 70,
  twinkle = 0,
  seed = 7
): void {
  const rand = mulberry32(seed);
  ctx.save();
  for (let i = 0; i < count; i++) {
    const x = rand() * width;
    const y = rand() * height;
    const r = 0.4 + rand() * 1.1;
    const phase = rand() * Math.PI * 2;
    const base = 0.18 + rand() * 0.35;
    const a = twinkle ? base * (0.65 + 0.35 * Math.sin(twinkle * (0.8 + rand()) + phase)) : base;
    ctx.fillStyle = `rgba(203, 213, 225, ${a.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Vertical background gradient, top → bottom. */
export function fillGradient(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  top: string,
  bottom: string
): void {
  const g = ctx.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
}

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
