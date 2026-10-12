import React, { useMemo, useRef, useState } from 'react';
import { Sliders, Eye, Info, MousePointerClick, Sparkles } from 'lucide-react';
import { LabLayout } from '../../components/layout/LabLayout';
import { SimCanvas } from '../../components/canvas/SimCanvas';
import type { CanvasPointer, DrawFn } from '../../components/canvas/SimCanvas';
import {
  MONO,
  clamp,
  drawArrow,
  drawTag,
  fillGradient,
  glowDot,
} from '../../components/canvas/draw';
import type { TagBox, TagOptions } from '../../components/canvas/draw';
import { Badge, FormulaList, Panel, ReadoutBar } from '../../components/ui/Panel';
import { Slider } from '../../components/ui/Slider';
import { CANVAS_COLORS } from '../../components/ui/theme';
import type { Accent } from '../../components/ui/theme';
import {
  DEFAULT_OPTICS_PARAMS,
  calculateImage,
  generatePrincipalRays,
  getFocalMarkers,
  imageX,
  isMirror,
} from '../../physics/optics/optics';
import type { OpticalElement, OpticsParams } from '../../physics/optics/optics';

const CANVAS_HEIGHT = 380;
const PAD = { left: 26, right: 26, top: 36, bottom: 46 };
const U_MIN = 5;
const U_MAX = 60;
const GRAB_PX = 36;

const OBJECT_COLOR = '#34d399';
const REAL_COLOR = '#f472b6';
const VIRTUAL_COLOR = '#c084fc';
const ELEMENT_COLOR = '#38bdf8';

const ELEMENTS: { id: OpticalElement; label: string }[] = [
  { id: 'converging-lens', label: 'Converging lens' },
  { id: 'diverging-lens', label: 'Diverging lens' },
  { id: 'concave-mirror', label: 'Concave mirror' },
  { id: 'convex-mirror', label: 'Convex mirror' },
];

interface Layout {
  scale: number; // px per cm (same for x and y)
  ox: number; // screen x of the element (x = 0)
  oy: number; // screen y of the optical axis
  left: number;
  right: number;
  top: number;
  bottom: number;
  apertureCm: number;
  toX: (x: number) => number;
  toY: (y: number) => number;
}

/**
 * One uniform scale (cm → px) for both axes, fitted so the object, the focal
 * points, the element and the image (when it is within sensible reach) are all
 * on screen. A very distant or very tall image is handled by the caller with an
 * off-screen indicator instead of shrinking the whole diagram to a speck.
 */
function makeLayout(width: number, height: number, params: OpticsParams): Layout {
  const result = calculateImage(params);
  const wide = width >= 620;
  const left = PAD.left;
  const right = width - PAD.right;
  const top = PAD.top;
  const bottom = height - PAD.bottom;
  const plotW = Math.max(40, right - left);
  const plotH = Math.max(40, bottom - top);

  const absF = Math.abs(result.signedFocalLength);
  const u = params.objectDistance;
  const h = params.objectHeight;

  const xs = [-u, 0];
  getFocalMarkers(params.element, absF).forEach((m) => {
    if (wide || !m.label.startsWith('2')) xs.push(m.x);
  });

  const apertureCm = Math.max(h * 1.3, 6);
  let yMax = apertureCm;

  const v = result.imageDistance;
  if (Number.isFinite(v)) {
    const ix = imageX(params.element, v);
    if (Math.abs(ix) <= 3 * Math.max(u, 2 * absF)) xs.push(ix);
    const ih = Math.abs(result.imageHeight);
    if (ih <= 3 * Math.max(h, 5)) yMax = Math.max(yMax, ih * 1.1);
  }

  let xMin = Math.min(...xs) - 1.5;
  let xMax = Math.max(...xs) + 1.5;
  if (xMax - xMin < 30) {
    const mid = (xMax + xMin) / 2;
    xMin = mid - 15;
    xMax = mid + 15;
  }

  const scale = Math.min(plotW / (xMax - xMin), plotH / (2 * yMax * 1.04));
  const ox = left + plotW / 2 - (scale * (xMin + xMax)) / 2;
  const oy = top + plotH / 2;
  return {
    scale,
    ox,
    oy,
    left,
    right,
    top,
    bottom,
    apertureCm,
    toX: (x) => ox + x * scale,
    toY: (y) => oy - y * scale,
  };
}

type Pt = { x: number; y: number };

/** Liang–Barsky: the visible parameter range [t0, t1] of segment p→q inside the rect, or null. */
function clipSegment(p: Pt, q: Pt, w: number, h: number): [number, number] | null {
  let t0 = 0;
  let t1 = 1;
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const checks: [number, number][] = [
    [-dx, p.x],
    [dx, w - p.x],
    [-dy, p.y],
    [dy, h - p.y],
  ];
  for (const [pp, qq] of checks) {
    if (Math.abs(pp) < 1e-12) {
      if (qq < 0) return null;
    } else {
      const r = qq / pp;
      if (pp < 0) {
        if (r > t1) return null;
        t0 = Math.max(t0, r);
      } else {
        if (r < t0) return null;
        t1 = Math.min(t1, r);
      }
    }
  }
  return t0 < t1 ? [t0, t1] : null;
}

function arrowHead(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, size: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(size * 0.6, 0);
  ctx.lineTo(-size * 0.5, -size * 0.45);
  ctx.lineTo(-size * 0.5, size * 0.45);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

const fmt = (n: number, d = 2) => (Number.isFinite(n) ? n.toFixed(d) : '∞');

export const OpticsPage: React.FC = () => {
  const [params, setParams] = useState<OpticsParams>(DEFAULT_OPTICS_PARAMS);
  const [hover, setHover] = useState(false);
  const [dragging, setDragging] = useState(false);
  const lastLayout = useRef<Layout | null>(null);
  const drag = useRef<{ layout: Layout; grabDx: number } | null>(null);

  const result = useMemo(() => calculateImage(params), [params]);
  const rays = useMemo(() => generatePrincipalRays(params, result), [params, result]);
  const mirror = isMirror(params.element);
  const atInfinity = !Number.isFinite(result.imageDistance);
  const f = result.signedFocalLength;
  const power = 100 / f; // dioptres, f in cm
  const sameSize = result.nature.includes('Same size');

  const setField = (patch: Partial<OpticsParams>) => setParams((p) => ({ ...p, ...patch }));

  // ---- Drag the object along the axis -----------------------------------------------------
  const objectPx = (p: CanvasPointer, lay: Layout) => Math.abs(p.x - lay.toX(-params.objectDistance));

  const moveObject = (p: CanvasPointer) => {
    const d = drag.current;
    if (!d) return;
    const u = (d.layout.ox - (p.x - d.grabDx)) / d.layout.scale;
    const next = clamp(Math.round(u * 2) / 2, U_MIN, U_MAX);
    setParams((prev) => (prev.objectDistance === next ? prev : { ...prev, objectDistance: next }));
  };

  const onPointerDown = (p: CanvasPointer) => {
    const lay = lastLayout.current;
    if (!lay || objectPx(p, lay) > GRAB_PX) return;
    p.event.currentTarget.setPointerCapture(p.event.pointerId);
    drag.current = { layout: lay, grabDx: p.x - lay.toX(-params.objectDistance) };
    setDragging(true);
    moveObject(p);
  };
  const onPointerMove = (p: CanvasPointer) => {
    if (drag.current) {
      moveObject(p);
      return;
    }
    const lay = lastLayout.current;
    const near = Boolean(lay) && objectPx(p, lay as Layout) <= GRAB_PX;
    if (near !== hover) setHover(near);
  };
  const onPointerUp = () => {
    drag.current = null;
    setDragging(false);
  };

  // ---- Scene ------------------------------------------------------------------------------
  const draw: DrawFn = (ctx, width, height, time) => {
    const lay = drag.current?.layout ?? makeLayout(width, height, params);
    if (!drag.current) lastLayout.current = lay;
    const { toX, toY, scale, oy, left, right, top, bottom } = lay;
    const boxes: TagBox[] = [];

    /** Draw a tag, clamped inside the canvas and nudged by `dy` until it stops overlapping earlier tags. */
    const place = (text: string, x: number, y: number, opt: TagOptions & { dy?: number } = {}) => {
      const { dy = 19, ...tagOpt } = opt;
      const font = tagOpt.font ?? MONO;
      ctx.font = font;
      const w = ctx.measureText(text).width + (tagOpt.padX ?? 6) * 2;
      const hgt = (parseInt(font, 10) || 11) + (tagOpt.padY ?? 3) * 2;
      const align = tagOpt.align ?? 'left';
      let bx = align === 'left' ? x : align === 'center' ? x - w / 2 : x - w;
      bx = clamp(bx, 4, Math.max(4, width - w - 4));
      let by = clamp((tagOpt.baseline ?? 'middle') === 'top' ? y : (tagOpt.baseline ?? 'middle') === 'middle' ? y - hgt / 2 : y - hgt, 4, height - hgt - 4);
      for (let i = 0; i < 6; i++) {
        const hit = boxes.some((b) => bx < b.x + b.w + 2 && bx + w + 2 > b.x && by < b.y + b.h + 1 && by + hgt + 1 > b.y);
        if (!hit) break;
        by = clamp(by + dy, 4, height - hgt - 4);
      }
      const box = drawTag(ctx, text, bx, by, { ...tagOpt, align: 'left', baseline: 'top' });
      boxes.push(box);
      return box;
    };

    fillGradient(ctx, width, height, '#0a1124', CANVAS_COLORS.bgDeep);

    // Faint horizontal guides at the object height
    ctx.save();
    ctx.strokeStyle = CANVAS_COLORS.grid;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 6]);
    for (const k of [-1, 1]) {
      const gy = toY(k * params.objectHeight);
      if (gy > top - 10 && gy < bottom + 10) {
        ctx.beginPath();
        ctx.moveTo(left, gy);
        ctx.lineTo(right, gy);
        ctx.stroke();
      }
    }
    ctx.restore();

    // Optical axis
    ctx.strokeStyle = '#3b4a63';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, oy);
    ctx.lineTo(width, oy);
    ctx.stroke();

    // ---- Element
    const apPx = Math.min(lay.apertureCm * scale, (bottom - top) / 2 - 2);
    const ex = lay.ox;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = ELEMENT_COLOR;
    ctx.fillStyle = 'rgba(56, 189, 248, 0.14)';
    ctx.lineWidth = 2.2;
    ctx.shadowColor = ELEMENT_COLOR;
    ctx.shadowBlur = 8;
    if (!mirror) {
      const converging = params.element === 'converging-lens';
      ctx.beginPath();
      if (converging) {
        ctx.moveTo(ex, oy - apPx);
        ctx.quadraticCurveTo(ex - 16, oy, ex, oy + apPx);
        ctx.quadraticCurveTo(ex + 16, oy, ex, oy - apPx);
      } else {
        ctx.moveTo(ex - 9, oy - apPx);
        ctx.lineTo(ex + 9, oy - apPx);
        ctx.quadraticCurveTo(ex - 1, oy, ex + 9, oy + apPx);
        ctx.lineTo(ex - 9, oy + apPx);
        ctx.quadraticCurveTo(ex + 1 - 18 + 18 - 18 + 18 - 0, oy, ex - 9, oy - apPx);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      // Arrowheads on the tips: pointing out for converging, in for diverging
      const s = converging ? 1 : -1;
      const tipTop = oy - apPx;
      const tipBot = oy + apPx;
      arrowHead(ctx, ex, tipTop - (converging ? 3 : -3) + (converging ? 0 : -6), -Math.PI / 2 * s, 11, ELEMENT_COLOR);
      arrowHead(ctx, ex, tipBot + (converging ? 3 : -3) + (converging ? 0 : 6), (Math.PI / 2) * s, 11, ELEMENT_COLOR);
    } else {
      const sag = 14;
      const xe = params.element === 'concave-mirror' ? -sag : sag;
      ctx.shadowBlur = 8;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(ex + xe, oy - apPx);
      ctx.quadraticCurveTo(ex - xe, oy, ex + xe, oy + apPx);
      ctx.stroke();
      ctx.shadowBlur = 0;
      // Hatched back (non-reflecting side, to the right)
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const n = Math.max(6, Math.round(apPx / 7));
      for (let i = 0; i <= n; i++) {
        const yy = -apPx + (2 * apPx * i) / n;
        const xx = xe * (yy / apPx) ** 2;
        ctx.moveTo(ex + xx + 1.5, oy + yy);
        ctx.lineTo(ex + xx + 9, oy + yy + 7);
      }
      ctx.stroke();
    }
    ctx.restore();

    // ---- Focal markers: dots on the axis, dark-pill labels below it, nudged apart
    const absF = Math.abs(f);
    const markers = getFocalMarkers(params.element, absF)
      .map((m) => ({ ...m, px: toX(m.x) }))
      .filter((m) => m.px > left - 8 && m.px < right + 8)
      .sort((a, b) => (a.label.startsWith('2') ? 1 : 0) - (b.label.startsWith('2') ? 1 : 0));
    // Keep element tag + object/image tags clear of the focal labels: reserve them first
    markers.forEach((m) => {
      ctx.save();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = m.virtual ? '#94a3b8' : '#cbd5e1';
      ctx.fillStyle = m.virtual ? CANVAS_COLORS.bgDeep : '#cbd5e1';
      ctx.beginPath();
      ctx.arc(m.px, oy, 3.6, 0, Math.PI * 2);
      ctx.fill();
      if (m.virtual) ctx.setLineDash([2, 2]);
      ctx.stroke();
      ctx.restore();
    });
    markers.forEach((m) => {
      place(m.label, m.px, oy + 9, {
        align: 'center',
        baseline: 'top',
        color: m.virtual ? '#94a3b8' : '#e2e8f0',
        border: m.virtual ? 'rgba(148,163,184,0.35)' : undefined,
      });
    });

    // ---- Rays
    const objX = toX(-params.objectDistance);
    const objTipY = toY(params.objectHeight);
    const toPx = (p: Pt): Pt => ({ x: toX(p.x), y: toY(p.y) });
    const pulseSpeed = 110; // px / s, decorative

    rays.forEach((r, ri) => {
      const pts = r.points.map(toPx);
      ctx.save();
      ctx.lineJoin = 'round';

      // Virtual back-extension: dashed, drawn first so the solid ray sits on top
      if (r.virtualExtension && r.virtualExtension.length > 1) {
        const ext = r.virtualExtension.map(toPx);
        ctx.strokeStyle = r.color;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 1.4;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(ext[0].x, ext[0].y);
        for (let i = 1; i < ext.length; i++) ctx.lineTo(ext[i].x, ext[i].y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }

      // Solid path with a soft glow underneath
      const path = () => {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      };
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = 0.18;
      ctx.lineWidth = 5;
      path();
      ctx.stroke();
      ctx.globalAlpha = 0.95;
      ctx.lineWidth = 1.6;
      path();
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Visible pieces (for direction arrowheads + travelling pulses)
      const pieces: { a: Pt; b: Pt; len: number }[] = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const t = clipSegment(pts[i], pts[i + 1], width, height);
        if (!t) continue;
        const a = { x: pts[i].x + (pts[i + 1].x - pts[i].x) * t[0], y: pts[i].y + (pts[i + 1].y - pts[i].y) * t[0] };
        const b = { x: pts[i].x + (pts[i + 1].x - pts[i].x) * t[1], y: pts[i].y + (pts[i + 1].y - pts[i].y) * t[1] };
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        pieces.push({ a, b, len });
        if (len > 34) {
          arrowHead(ctx, (a.x + b.x) / 2, (a.y + b.y) / 2, Math.atan2(b.y - a.y, b.x - a.x), 9, r.color);
        }
      }

      const total = pieces.reduce((s, q) => s + q.len, 0);
      if (total > 20) {
        for (let k = 0; k < 2; k++) {
          let d = (((time * pulseSpeed + (ri / 3 + k / 2) * total) % total) + total) % total;
          for (const q of pieces) {
            if (d <= q.len) {
              const t = q.len > 0 ? d / q.len : 0;
              glowDot(ctx, q.a.x + (q.b.x - q.a.x) * t, q.a.y + (q.b.y - q.a.y) * t, 2.4, '#ffffff', 5);
              break;
            }
            d -= q.len;
          }
        }
      }
      ctx.restore();
    });

    // ---- Object
    const grabbed = hover || dragging;
    if (grabbed) glowDot(ctx, objX, oy, 4, OBJECT_COLOR, 12);
    drawArrow(ctx, objX, oy, objX, objTipY, OBJECT_COLOR, { width: 3.2, head: 12 });
    ctx.save();
    ctx.fillStyle = CANVAS_COLORS.bgDeep;
    ctx.strokeStyle = OBJECT_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(objX, oy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // ---- Image
    const imgColor = result.isReal ? REAL_COLOR : VIRTUAL_COLOR;
    if (!atInfinity) {
      const ix = toX(imageX(params.element, result.imageDistance));
      const iy = toY(result.imageHeight);
      const offRight = ix > right + 4;
      const offLeft = ix < left - 4;
      const cy = clamp(iy, top, bottom);
      const clippedY = cy !== iy;
      if (offRight || offLeft) {
        const edgeX = offRight ? right : left;
        const cm = Math.abs(imageX(params.element, result.imageDistance));
        place(`${result.isReal ? 'real' : 'virtual'} image ${offRight ? '→' : '←'} ${cm.toFixed(0)} cm`, edgeX, oy - 24, {
          align: offRight ? 'right' : 'left',
          color: imgColor,
          dy: -19,
        });
      } else {
        ctx.save();
        if (!result.isReal) ctx.globalAlpha = 0.85;
        drawArrow(ctx, ix, oy, ix, cy, imgColor, {
          width: 3.2,
          head: clippedY ? 0 : 12,
          dash: result.isReal ? undefined : [6, 5],
        });
        ctx.restore();
        if (!result.isReal) {
          // Hollow head to read as "not really there"
          const dir = iy < oy ? -1 : 1;
          if (!clippedY) {
            ctx.save();
            ctx.strokeStyle = CANVAS_COLORS.bgDeep;
            ctx.fillStyle = CANVAS_COLORS.bgDeep;
            ctx.beginPath();
            ctx.moveTo(ix, iy + dir * 3);
            ctx.lineTo(ix - 3.5, iy - dir * 4 + dir * 7);
            ctx.lineTo(ix + 3.5, iy - dir * 4 + dir * 7);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          }
        }
        const up = iy < oy;
        place(
          `${result.isReal ? 'Real' : 'Virtual'} image${clippedY ? ' (off scale)' : ''}`,
          ix,
          up ? cy - 14 : cy + 14,
          { align: 'center', color: imgColor, dy: up ? -19 : 19 }
        );
      }
    } else {
      place('Image at infinity: rays emerge parallel', width / 2, top + 4, {
        align: 'center',
        baseline: 'top',
        color: '#fbbf24',
        border: 'rgba(251,191,36,0.4)',
      });
    }

    // ---- Labels (placed after the markers so they get nudged away from them)
    const elemName = ELEMENTS.find((e) => e.id === params.element)?.label ?? '';
    place(elemName, ex, oy - apPx - 16, { align: 'center', color: ELEMENT_COLOR, dy: -19 });
    place('Object', objX, objTipY - 14, { align: 'center', color: OBJECT_COLOR, dy: -19 });

    // Hints
    place(dragging || hover ? '↔ moving object' : '↔ drag the object', 8, height - 8, {
      baseline: 'bottom',
      color: OBJECT_COLOR,
      font: '11px Inter, system-ui, sans-serif',
      bg: 'rgba(7, 11, 20, 0.6)',
      dy: -19,
    });
    place(`1 cm = ${scale.toFixed(1)} px`, width - 8, height - 8, {
      align: 'right',
      baseline: 'bottom',
      color: CANVAS_COLORS.axis,
      bg: 'rgba(7, 11, 20, 0.5)',
      dy: -19,
    });
  };

  // ---- Readouts ---------------------------------------------------------------------------
  const natureBadges: { text: string; accent: Accent }[] = atInfinity
    ? [{ text: 'Image at infinity', accent: 'amber' }]
    : [
        { text: result.isReal ? 'Real' : 'Virtual', accent: result.isReal ? 'pink' : 'purple' },
        { text: result.isInverted ? 'Inverted' : 'Erect', accent: result.isInverted ? 'amber' : 'sky' },
        sameSize
          ? { text: 'Same size', accent: 'emerald' }
          : { text: result.isEnlarged ? 'Enlarged' : 'Diminished', accent: result.isEnlarged ? 'rose' : 'cyan' },
      ];

  const rayLegend = [
    { color: '#ef4444', text: mirror ? 'Parallel to axis, reflects through F' : 'Parallel to axis, bends through F' },
    { color: '#22c55e', text: mirror ? 'Aimed at the pole, reflects symmetrically' : 'Through the centre, undeviated' },
    { color: '#3b82f6', text: mirror ? 'Through F, reflects parallel' : 'Through F, leaves parallel' },
  ];

  return (
    <LabLayout title="Geometric Optics & Ray Tracing" category="Optics & Waves">
      <div className="space-y-6">
        <div
          role="tablist"
          aria-label="Optical element"
          className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/70 p-2.5"
        >
          <span className="px-2 font-mono text-xs font-semibold uppercase text-slate-500">Element</span>
          {ELEMENTS.map((el) => (
            <button
              key={el.id}
              role="tab"
              aria-selected={params.element === el.id}
              onClick={() => setField({ element: el.id })}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                params.element === el.id
                  ? 'border-rose-500/40 bg-rose-500/20 text-rose-300 shadow-sm'
                  : 'border-transparent bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {el.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="min-w-0 space-y-4 lg:col-span-2">
            <Panel
              title="Principal ray tracing"
              icon={Eye}
              accent="rose"
              flush
              right={
                <div className="hidden items-center gap-2 sm:flex">
                  <Badge accent="emerald">Object</Badge>
                  <Badge accent={result.isReal ? 'pink' : 'purple'}>{result.isReal ? 'Real image' : 'Virtual image'}</Badge>
                </div>
              }
              footer={
                <ReadoutBar
                  items={[
                    { label: 'Image distance v', value: atInfinity ? '∞' : `${fmt(result.imageDistance)} cm`, accent: 'rose' },
                    { label: 'Magnification m', value: atInfinity ? '∞' : `${fmt(result.magnification)}×`, accent: 'sky' },
                    { label: 'Image height hᵢ', value: atInfinity ? '∞' : `${fmt(result.imageHeight)} cm`, accent: 'purple' },
                    { label: 'Power P = 1/f', value: `${fmt(power, 2)} D`, accent: 'emerald' },
                  ]}
                />
              }
            >
              <SimCanvas
                height={CANVAS_HEIGHT}
                draw={draw}
                animate
                cursor={dragging ? 'grabbing' : hover ? 'grab' : 'default'}
                ariaLabel="Ray diagram showing image formation"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={() => setHover(false)}
              />
              <div className="flex flex-wrap items-center gap-2 border-t border-slate-800/80 px-4 py-2.5">
                <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Image</span>
                {natureBadges.map((b) => (
                  <Badge key={b.text} accent={b.accent}>
                    {b.text}
                  </Badge>
                ))}
              </div>
            </Panel>

            <Panel title="Principal rays" icon={Sparkles} accent="amber">
              <ul className="grid grid-cols-1 gap-2 text-xs text-slate-300 sm:grid-cols-3">
                {rayLegend.map((r) => (
                  <li key={r.color} className="flex items-start gap-2">
                    <span className="mt-1.5 h-0.5 w-4 shrink-0 rounded" style={{ background: r.color }} />
                    <span>{r.text}</span>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] leading-relaxed text-slate-500">
                Solid lines are real light paths. Dashed lines are back-extensions: for a virtual image the rays only
                appear to come from the image, so only their extensions meet.
              </p>
            </Panel>
          </div>

          <div className="min-w-0 space-y-5">
            <Panel title="Optical parameters" icon={Sliders} accent="rose">
              <Slider
                label="Object distance (u)"
                value={params.objectDistance}
                min={U_MIN}
                max={U_MAX}
                step={0.5}
                unit="cm"
                accent="emerald"
                onChange={(v) => setField({ objectDistance: v })}
                hint={
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[
                      { name: 'u = f/2', u: params.focalLength / 2 },
                      { name: 'u = f', u: params.focalLength },
                      { name: 'u = 2f', u: params.focalLength * 2 },
                      { name: 'u = 3f', u: params.focalLength * 3 },
                    ].map((p) => {
                      const target = clamp(Math.round(p.u * 2) / 2, U_MIN, U_MAX);
                      return (
                        <button
                          key={p.name}
                          onClick={() => setField({ objectDistance: target })}
                          className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                            params.objectDistance === target
                              ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-300'
                              : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                          }`}
                        >
                          {p.name}
                        </button>
                      );
                    })}
                  </div>
                }
              />
              <Slider
                label="Focal length (|f|)"
                value={params.focalLength}
                min={5}
                max={35}
                unit="cm"
                accent="sky"
                onChange={(v) => setField({ focalLength: v })}
              />
              <Slider
                label="Object height (hₒ)"
                value={params.objectHeight}
                min={1}
                max={15}
                step={0.5}
                unit="cm"
                accent="purple"
                onChange={(v) => setField({ objectHeight: v })}
              />
              <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <MousePointerClick className="h-3.5 w-3.5 shrink-0" /> You can also drag the object on the canvas.
              </p>
            </Panel>

            <Panel title="Lens & mirror equations" icon={Info} accent="indigo">
              <FormulaList
                formulas={[
                  '\\frac{1}{f} = \\frac{1}{u} + \\frac{1}{v} \\;\\Rightarrow\\; v = \\frac{u f}{u - f}',
                  'm = \\frac{h_i}{h_o} = -\\frac{v}{u}',
                  'P = \\frac{1}{f\\,(\\text{m})} \\quad (\\text{dioptres})',
                ]}
              />
              <p className="text-[11px] leading-relaxed text-slate-500">
                Real-is-positive convention: f &gt; 0 converging, f &lt; 0 diverging; v &gt; 0 real image, v &lt; 0
                virtual; m &lt; 0 inverted.
              </p>
            </Panel>
          </div>
        </div>
      </div>
    </LabLayout>
  );
};
