import React, { useRef, useState } from 'react';
import { Sliders, Zap, Info, ToggleLeft, ToggleRight, Gauge, CheckCircle2, AlertTriangle } from 'lucide-react';
import { LabLayout } from '../../components/layout/LabLayout';
import { SimCanvas } from '../../components/canvas/SimCanvas';
import type { CanvasPointer, DrawFn } from '../../components/canvas/SimCanvas';
import { MONO, clamp, drawTag, fillGradient } from '../../components/canvas/draw';
import { Badge, FormulaList, Panel } from '../../components/ui/Panel';
import { Slider } from '../../components/ui/Slider';
import { CANVAS_COLORS } from '../../components/ui/theme';
import {
  DEFAULT_SERIES_CIRCUIT,
  DEFAULT_PARALLEL_CIRCUIT,
  DEFAULT_SERIES_PARALLEL_CIRCUIT,
  analyzeCircuit,
} from '../../physics/electricity/circuits';
import type { CircuitAnalysis, CircuitConfig, Resistor } from '../../physics/electricity/circuits';

const CANVAS_HEIGHT = 420;
const MAX_SCENE_W = 640;
const RES_HALF = 30; // half length of a resistor body (px)
const BAT_HALF = 14; // half height of the battery symbol (px)
const SW_HALF = 28; // half length of the switch (px)

const TOPOLOGIES = [
  { id: 'series', label: 'Series' },
  { id: 'parallel', label: 'Parallel' },
  { id: 'series-parallel', label: 'Series & parallel' },
] as const;
type TopologyId = (typeof TOPOLOGIES)[number]['id'];

const TAG_V = '#fbbf24';
const TAG_I = '#34d399';
const TAG_P = '#c084fc';

// ---- Formatting ---------------------------------------------------------------------------
const fmtV = (v: number) => `${v.toFixed(2)} V`;
function fmtI(i: number): string {
  if (i >= 1) return `${i.toFixed(2)} A`;
  const ma = i * 1000;
  return `${ma.toFixed(ma >= 100 ? 0 : ma >= 10 ? 1 : 2)} mA`;
}
function fmtP(p: number): string {
  return `${p.toFixed(p >= 100 ? 0 : p >= 10 ? 1 : 3)} W`;
}

// ---- Scene model --------------------------------------------------------------------------
interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
/** A polyline carrying one current; `vs[i]` is the electric potential at `pts[i]`. */
interface PathDef {
  id: string;
  pts: [number, number][];
  vs: number[];
  current: number;
}
interface ResEl {
  res: Resistor;
  cx: number;
  cy: number;
  vertical: boolean;
  /** Where the label stack goes relative to the resistor. */
  side: 'left' | 'right' | 'below';
}
interface NodeTag {
  x: number;
  y: number;
  text: string;
  align: 'left' | 'center' | 'right';
}
interface Scene {
  paths: PathDef[];
  boxes: Box[];
  resistors: ResEl[];
  junctions: { x: number; y: number; v: number }[];
  nodes: NodeTag[];
  batX: number;
  batY: number;
  swX: number;
  swY: number;
  vmax: number;
  corner: { x: number; y: number };
}

type Pt = [number, number, number];
const mk = (id: string, current: number, ...pts: Pt[]): PathDef => ({
  id,
  current,
  pts: pts.map((p) => [p[0], p[1]] as [number, number]),
  vs: pts.map((p) => p[2]),
});

/**
 * Lay the chosen topology out inside a (width × height) canvas. Every wire is an
 * ideal conductor, so its potential is constant between components; each component
 * changes the potential along the path by its own voltage drop (battery: + terminal
 * voltage, resistor: −ΔV, switch: −ΔV only while open).
 */
function buildScene(w: number, h: number, cfg: CircuitConfig, an: CircuitAnalysis): Scene {
  const compact = w < 520;
  const sceneW = Math.min(w, MAX_SCENE_W);
  const ox = (w - sceneW) / 2;
  const L = ox + (compact ? 34 : 52);
  const T = 56;
  const B = h - 64;
  const cy = (T + B) / 2;
  const Vt = an.terminalVoltage;
  const open = !an.isCircuitComplete;
  const Itot = an.totalCurrent;
  const rs = an.resistors;
  const d = (i: number) => rs[i]?.voltageDrop ?? 0;
  const cur = (i: number) => rs[i]?.current ?? 0;
  const paths: PathDef[] = [];
  const boxes: Box[] = [];
  const resistors: ResEl[] = [];
  const junctions: Scene['junctions'] = [];
  const nodes: NodeTag[] = [];

  const resBox = (cx: number, cyy: number, vertical: boolean): Box =>
    vertical
      ? { x: cx - 13, y: cyy - RES_HALF, w: 26, h: RES_HALF * 2 }
      : { x: cx - RES_HALF, y: cyy - 13, w: RES_HALF * 2, h: 26 };
  const addRes = (i: number, cx: number, cyy: number, vertical: boolean, side: ResEl['side']) => {
    if (!rs[i]) return;
    boxes.push(resBox(cx, cyy, vertical));
    resistors.push({ res: rs[i], cx, cy: cyy, vertical, side });
  };

  boxes.push({ x: L - 14, y: cy - BAT_HALF, w: 28, h: BAT_HALF * 2 });

  const corner = { x: L, y: B };
  let swX = 0;
  let vmax = Math.max(an.batteryVoltage, 1e-9);

  if (cfg.topology === 'parallel') {
    const x1 = L + (compact ? 86 : 110);
    const x3 = ox + sceneW - (compact ? 76 : 96);
    const x2 = (x1 + x3) / 2;
    const xs = [x1, x2, x3];
    swX = (L + x1) / 2;
    boxes.push({ x: swX - SW_HALF, y: B - 14, w: SW_HALF * 2, h: 28 });
    const vSw = open ? Vt : Vt - d(0);
    paths.push(mk('in', Itot, [L, cy + BAT_HALF, 0], [L, cy - BAT_HALF, Vt], [L, T, Vt], [x1, T, Vt]));
    paths.push(mk('top2', cur(1) + cur(2), [x1, T, Vt], [x2, T, Vt]));
    paths.push(mk('top3', cur(2), [x2, T, Vt], [x3, T, Vt]));
    xs.forEach((x, i) => {
      const vb = Vt - d(i);
      paths.push(mk(`b${i}`, cur(i), [x, T, Vt], [x, cy - RES_HALF, Vt], [x, cy + RES_HALF, vb], [x, B, vb]));
      addRes(i, x, cy, true, 'right');
    });
    paths.push(mk('bot3', cur(2), [x3, B, Vt - d(2)], [x2, B, Vt - d(2)]));
    paths.push(mk('bot2', cur(1) + cur(2), [x2, B, Vt - d(1)], [x1, B, Vt - d(1)]));
    paths.push(
      mk('out', Itot, [x1, B, vSw], [swX + SW_HALF, B, vSw], [swX - SW_HALF, B, open ? 0 : vSw], [L, B, open ? 0 : vSw], [L, cy + BAT_HALF, open ? 0 : vSw])
    );
    junctions.push({ x: x1, y: T, v: Vt }, { x: x2, y: T, v: Vt }, { x: x1, y: B, v: vSw }, { x: x2, y: B, v: vSw });
  } else if (cfg.topology === 'series-parallel') {
    const xb = ox + sceneW - (compact ? 76 : 96);
    const xa = L + clamp((xb - L) * 0.52, 110, 220);
    const xr = (L + xa) / 2;
    swX = xr;
    boxes.push({ x: swX - SW_HALF, y: B - 14, w: SW_HALF * 2, h: 28 });
    const vA = Vt - d(0);
    const vB = vA - d(1);
    const vSw = open ? vA : vB;
    paths.push(
      mk('in', Itot, [L, cy + BAT_HALF, 0], [L, cy - BAT_HALF, Vt], [L, T, Vt], [xr - RES_HALF, T, Vt], [xr + RES_HALF, T, vA], [xa, T, vA])
    );
    addRes(0, xr, T, false, 'below');
    paths.push(mk('topb', cur(2), [xa, T, vA], [xb, T, vA]));
    paths.push(mk('b1', cur(1), [xa, T, vA], [xa, cy - RES_HALF, vA], [xa, cy + RES_HALF, vB], [xa, B, vB]));
    paths.push(mk('b2', cur(2), [xb, T, vA], [xb, cy - RES_HALF, vA], [xb, cy + RES_HALF, vB], [xb, B, vB]));
    addRes(1, xa, cy, true, 'right');
    addRes(2, xb, cy, true, 'right');
    paths.push(mk('botb', cur(2), [xb, B, vB], [xa, B, vB]));
    paths.push(
      mk('out', Itot, [xa, B, vSw], [swX + SW_HALF, B, vSw], [swX - SW_HALF, B, open ? 0 : vSw], [L, B, open ? 0 : vSw], [L, cy + BAT_HALF, open ? 0 : vSw])
    );
    junctions.push({ x: xa, y: T, v: vA }, { x: xa, y: B, v: vSw });
    nodes.push({ x: xa + 8, y: T - 17, text: `A ${fmtV(vA)}`, align: 'left' });
  } else {
    // Series: one clockwise loop — R1, R2 on top, R3 on the right, switch at the bottom.
    const R = ox + sceneW - 40;
    const x1 = L + (R - L) * 0.26;
    const x2 = L + (R - L) * 0.64;
    swX = (L + R) / 2 - 10;
    boxes.push({ x: swX - SW_HALF, y: B - 14, w: SW_HALF * 2, h: 28 });
    const v1 = Vt - d(0);
    const v2 = v1 - d(1);
    const v3 = v2 - d(2);
    const vAfter = open ? 0 : v3;
    paths.push(
      mk(
        'loop',
        Itot,
        [L, cy + BAT_HALF, 0],
        [L, cy - BAT_HALF, Vt],
        [L, T, Vt],
        [x1 - RES_HALF, T, Vt],
        [x1 + RES_HALF, T, v1],
        [x2 - RES_HALF, T, v1],
        [x2 + RES_HALF, T, v2],
        [R, T, v2],
        [R, cy - RES_HALF, v2],
        [R, cy + RES_HALF, v3],
        [R, B, v3],
        [swX + SW_HALF, B, v3],
        [swX - SW_HALF, B, vAfter],
        [L, B, vAfter],
        [L, cy + BAT_HALF, vAfter]
      )
    );
    addRes(0, x1, T, false, 'below');
    addRes(1, x2, T, false, 'below');
    addRes(2, R, cy, true, 'left');
    nodes.push({ x: R, y: T - 17, text: fmtV(v2), align: 'right' });
  }

  if (cfg.topology !== 'series') vmax = Math.max(vmax, Vt);
  return { paths, boxes, resistors, junctions, nodes, batX: L, batY: cy, swX, swY: B, vmax, corner };
}

// ---- Drawing helpers ----------------------------------------------------------------------
const potColor = (v: number, vmax: number): string => {
  const t = vmax > 0 ? clamp(v / vmax, 0, 1) : 0;
  return `hsl(${(210 - 170 * t).toFixed(0)}, 85%, 58%)`;
};

const HEAT_COLD: [number, number, number] = [125, 211, 252];
const HEAT_HOT: [number, number, number] = [251, 113, 60];
const mixRgb = (t: number): string => {
  const c = HEAT_COLD.map((a, i) => Math.round(a + (HEAT_HOT[i] - a) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
};

/** Log-ish mapping so 1 mA … 1 A all stay visible: 0 → still, 1 → fastest. */
const flowLevel = (i: number): number => (i < 1e-6 ? 0 : clamp(Math.log10(i / 1e-3) / 3, 0, 1));

function pathLengths(pts: [number, number][]): { cum: number[]; total: number } {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  return { cum, total: cum[cum.length - 1] };
}

function pointAt(pts: [number, number][], cum: number[], s: number): { x: number; y: number; a: number } {
  let i = 1;
  while (i < pts.length - 1 && cum[i] < s) i++;
  const [x0, y0] = pts[i - 1];
  const [x1, y1] = pts[i];
  const seg = cum[i] - cum[i - 1] || 1;
  const t = clamp((s - cum[i - 1]) / seg, 0, 1);
  return { x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t, a: Math.atan2(y1 - y0, x1 - x0) };
}

const insideAny = (boxes: Box[], x: number, y: number, pad: number): boolean =>
  boxes.some((b) => x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad);

function drawResistor(ctx: CanvasRenderingContext2D, r: ResEl, heat: number, live: boolean): void {
  ctx.save();
  ctx.translate(r.cx, r.cy);
  if (r.vertical) ctx.rotate(Math.PI / 2);
  if (heat > 0.01) {
    ctx.shadowColor = `rgba(251, 113, 60, ${(0.35 + 0.65 * heat).toFixed(2)})`;
    ctx.shadowBlur = 8 + 22 * heat;
    ctx.fillStyle = `rgba(251, 113, 60, ${(0.06 + 0.3 * heat).toFixed(3)})`;
    ctx.beginPath();
    ctx.roundRect(-RES_HALF + 2, -13, RES_HALF * 2 - 4, 26, 8);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.strokeStyle = live ? mixRgb(Math.sqrt(heat)) : '#64748b';
  ctx.lineWidth = 2.4;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-RES_HALF, 0);
  ctx.lineTo(-RES_HALF + 5, 0);
  const n = 6;
  const span = RES_HALF * 2 - 10;
  for (let i = 0; i < n; i++) {
    ctx.lineTo(-RES_HALF + 5 + (span * (i + 0.5)) / n, i % 2 ? 8 : -8);
  }
  ctx.lineTo(RES_HALF - 5, 0);
  ctx.lineTo(RES_HALF, 0);
  ctx.stroke();
  ctx.restore();
}

function drawBattery(ctx: CanvasRenderingContext2D, x: number, cy: number): void {
  ctx.save();
  ctx.strokeStyle = '#fbbf24';
  ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(251, 191, 36, 0.55)';
  ctx.shadowBlur = 8;
  // leads
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(x, cy - BAT_HALF);
  ctx.lineTo(x, cy - 5);
  ctx.moveTo(x, cy + 5);
  ctx.lineTo(x, cy + BAT_HALF);
  ctx.stroke();
  // long (+) plate, short thick (−) plate
  ctx.beginPath();
  ctx.moveTo(x - 12, cy - 5);
  ctx.lineTo(x + 12, cy - 5);
  ctx.stroke();
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.moveTo(x - 6, cy + 5);
  ctx.lineTo(x + 6, cy + 5);
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.font = 'bold 13px Inter, system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fbbf24';
  ctx.fillText('+', x - 13, cy - 8);
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('−', x - 13, cy + 9);
  ctx.restore();
}

function drawSwitch(ctx: CanvasRenderingContext2D, x: number, y: number, angleDeg: number, closed: boolean): void {
  const color = closed ? '#34d399' : '#fb7185';
  const hx = x - SW_HALF;
  const rad = (angleDeg * Math.PI) / 180;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = '#0b1220';
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.shadowColor = color;
  ctx.shadowBlur = closed ? 8 : 4;
  ctx.beginPath();
  ctx.moveTo(hx, y);
  ctx.lineTo(hx + Math.cos(rad) * SW_HALF * 2, y - Math.sin(rad) * SW_HALF * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 2;
  for (const cx of [hx, x + SW_HALF]) {
    ctx.beginPath();
    ctx.arc(cx, y, 3.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

// ---- Page ---------------------------------------------------------------------------------
export const CircuitsPage: React.FC = () => {
  const [config, setConfig] = useState<CircuitConfig>(DEFAULT_SERIES_CIRCUIT);
  const [hoverSwitch, setHoverSwitch] = useState(false);

  const analysis = analyzeCircuit(config);
  const sw = config.switches[0];

  const phases = useRef<Record<string, number>>({});
  const lastTime = useRef<number | null>(null);
  const swAngle = useRef<number>(sw.closed ? 0 : 32);

  const setTopology = (top: TopologyId) => {
    if (top === 'series') setConfig(DEFAULT_SERIES_CIRCUIT);
    else if (top === 'parallel') setConfig(DEFAULT_PARALLEL_CIRCUIT);
    else setConfig(DEFAULT_SERIES_PARALLEL_CIRCUIT);
  };
  const setVoltage = (voltage: number) => setConfig((p) => ({ ...p, battery: { ...p.battery, voltage } }));
  const setInternal = (internalResistance: number) =>
    setConfig((p) => ({ ...p, battery: { ...p.battery, internalResistance } }));
  const setResistance = (id: string, resistance: number) =>
    setConfig((p) => ({ ...p, resistors: p.resistors.map((r) => (r.id === id ? { ...r, resistance } : r)) }));
  const toggleSwitch = () =>
    setConfig((p) => ({ ...p, switches: p.switches.map((s, i) => (i === 0 ? { ...s, closed: !s.closed } : s)) }));

  // ---- Canvas interaction: click the switch to open / close it -----------------------------
  const overSwitch = (p: CanvasPointer): boolean => {
    const w = p.event.currentTarget.clientWidth;
    const s = buildScene(w, CANVAS_HEIGHT, config, analysis);
    return Math.abs(p.x - s.swX) < SW_HALF + 16 && p.y > s.swY - 56 && p.y < s.swY + 22;
  };
  const onPointerDown = (p: CanvasPointer) => {
    if (overSwitch(p)) toggleSwitch();
  };
  const onPointerMove = (p: CanvasPointer) => {
    const over = overSwitch(p);
    if (over !== hoverSwitch) setHoverSwitch(over);
  };

  // ---- Scene -----------------------------------------------------------------------------
  const draw: DrawFn = (ctx, width, height, time) => {
    const dt = lastTime.current === null ? 0 : clamp(time - lastTime.current, 0, 0.1);
    lastTime.current = time;
    const scene = buildScene(width, height, config, analysis);
    const compact = width < 520;
    const font = compact ? MONO.replace('11px', '10px') : MONO;
    const tagOpts = { font, padX: compact ? 4 : 6, padY: 3 };
    const fontPx = compact ? 10 : 11;
    const stackGap = fontPx + 8;
    const { boxes } = scene;
    const live = analysis.isCircuitComplete && analysis.totalCurrent > 0;

    fillGradient(ctx, width, height, '#0a1124', CANVAS_COLORS.bgDeep);

    // Wires and moving current, clipped so they never run through component bodies.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    boxes.forEach((b) => ctx.rect(b.x, b.y, b.w, b.h));
    ctx.clip('evenodd');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const wireAlpha = live ? 1 : 0.55;
    for (const path of scene.paths) {
      for (const [lw, a] of [[8, 0.1], [2.6, 1]] as const) {
        ctx.lineWidth = lw;
        ctx.globalAlpha = a * wireAlpha;
        for (let i = 0; i < path.pts.length - 1; i++) {
          const [x0, y0] = path.pts[i];
          const [x1, y1] = path.pts[i + 1];
          if (x0 === x1 && y0 === y1) continue;
          const g = ctx.createLinearGradient(x0, y0, x1, y1);
          g.addColorStop(0, potColor(path.vs[i], scene.vmax));
          g.addColorStop(1, potColor(path.vs[i + 1], scene.vmax));
          ctx.strokeStyle = g;
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;

    // Conventional current: chevrons whose speed and density follow log-scaled branch current.
    if (live) {
      ctx.strokeStyle = '#e0f2fe';
      ctx.shadowColor = 'rgba(56, 189, 248, 0.9)';
      ctx.shadowBlur = 6;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const path of scene.paths) {
        const f = flowLevel(path.current);
        if (f <= 0 && path.current < 1e-6) continue;
        const { cum, total } = pathLengths(path.pts);
        const speed = 14 + 96 * f;
        const spacing = 38 - 22 * f;
        const ph = (phases.current[path.id] ?? 0) + speed * dt;
        phases.current[path.id] = ph % 100000;
        const size = 2.8 + 1.8 * f;
        ctx.lineWidth = 1.6 + 0.8 * f;
        for (let s = ph % spacing; s < total; s += spacing) {
          const q = pointAt(path.pts, cum, s);
          if (insideAny(boxes, q.x, q.y, 4)) continue;
          ctx.save();
          ctx.translate(q.x, q.y);
          ctx.rotate(q.a);
          ctx.beginPath();
          ctx.moveTo(-size, -size * 0.95);
          ctx.lineTo(size * 0.55, 0);
          ctx.lineTo(-size, size * 0.95);
          ctx.stroke();
          ctx.restore();
        }
      }
      ctx.shadowBlur = 0;
    }
    ctx.restore();

    // Junction dots
    for (const j of scene.junctions) {
      ctx.fillStyle = potColor(j.v, scene.vmax);
      ctx.globalAlpha = wireAlpha;
      ctx.beginPath();
      ctx.arc(j.x, j.y, 3.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Components
    drawBattery(ctx, scene.batX, scene.batY);
    const pMax = Math.max(0, ...analysis.resistors.map((r) => r.power));
    for (const r of scene.resistors) {
      drawResistor(ctx, r, pMax > 0 ? r.res.power / pMax : 0, live);
    }
    swAngle.current += ((sw.closed ? 0 : 32) - swAngle.current) * (1 - Math.exp(-dt * 14));
    drawSwitch(ctx, scene.swX, scene.swY, swAngle.current, sw.closed);

    // Labels: battery
    const bx = scene.batX + 17;
    const bat = config.battery;
    drawTag(ctx, `${bat.voltage} V`, bx, scene.batY - stackGap, { ...tagOpts, color: '#fbbf24', border: 'rgba(251,191,36,0.35)' });
    drawTag(ctx, `r=${bat.internalResistance} Ω`, bx, scene.batY, { ...tagOpts, color: '#cbd5e1' });
    drawTag(ctx, `Vt=${analysis.terminalVoltage.toFixed(2)}V`, bx, scene.batY + stackGap, { ...tagOpts, color: '#7dd3fc' });

    // Labels: resistors (name above / beside, then ΔV, I, P pills — all stacked, so none overlap)
    for (const r of scene.resistors) {
      const name = `${r.res.id} ${r.res.resistance} Ω`;
      const lines: [string, string][] = [
        [fmtV(r.res.voltageDrop), TAG_V],
        [fmtI(r.res.current), TAG_I],
        [fmtP(r.res.power), TAG_P],
      ];
      if (r.vertical) {
        const align = r.side === 'left' ? 'right' : 'left';
        const x = r.side === 'left' ? r.cx - 16 : r.cx + 14;
        const all: [string, string][] = [[name, '#e2e8f0'], ...lines];
        all.forEach(([t, c], i) => {
          drawTag(ctx, t, x, r.cy + (i - 1.5) * stackGap, {
            ...tagOpts,
            align,
            color: c,
            border: i === 0 ? 'rgba(148,163,184,0.35)' : undefined,
          });
        });
      } else {
        drawTag(ctx, name, r.cx, r.cy - 34, { ...tagOpts, align: 'center', color: '#e2e8f0', border: 'rgba(148,163,184,0.35)' });
        lines.forEach(([t, c], i) => {
          drawTag(ctx, t, r.cx, r.cy + 28 + i * stackGap, { ...tagOpts, align: 'center', color: c });
        });
      }
    }

    // Node potentials and ground reference
    for (const n of scene.nodes) {
      drawTag(ctx, n.text, n.x, n.y, { ...tagOpts, align: n.align, color: '#fde68a', bg: 'rgba(7, 11, 20, 0.6)' });
    }
    drawTag(ctx, '0 V', scene.corner.x - 8, scene.corner.y + 18, { ...tagOpts, color: '#7dd3fc', bg: 'rgba(7, 11, 20, 0.6)' });
    ctx.fillStyle = '#7dd3fc';
    ctx.beginPath();
    ctx.arc(scene.corner.x, scene.corner.y, 3.4, 0, Math.PI * 2);
    ctx.fill();

    // Switch label (clickable)
    drawTag(ctx, `S1 ${sw.closed ? 'CLOSED' : 'OPEN'}`, scene.swX, scene.swY - 46, {
      ...tagOpts,
      align: 'center',
      color: sw.closed ? '#34d399' : '#fb7185',
      border: hoverSwitch ? (sw.closed ? '#34d399' : '#fb7185') : 'rgba(148,163,184,0.35)',
    });

    if (!analysis.isCircuitComplete) {
      drawTag(ctx, 'Open circuit — I = 0', width / 2, height - 16, {
        ...tagOpts,
        align: 'center',
        color: '#fecdd3',
        bg: 'rgba(136, 19, 55, 0.55)',
        border: 'rgba(251, 113, 133, 0.5)',
      });
    }
  };

  // ---- Readouts & Kirchhoff checks -----------------------------------------------------------
  const open = !analysis.isCircuitComplete;
  const rs = analysis.resistors;
  const sumPower = rs.reduce((s, r) => s + r.power, 0) + analysis.internalPower;
  const vi = analysis.batteryVoltage * analysis.totalCurrent;
  let sumDrops = 0;
  if (config.topology === 'parallel') sumDrops = rs[0].voltageDrop;
  else if (config.topology === 'series-parallel') sumDrops = rs[0].voltageDrop + rs[1].voltageDrop;
  else sumDrops = rs.reduce((s, r) => s + r.voltageDrop, 0);
  const kvlOk = Math.abs(sumDrops - analysis.terminalVoltage) < 1e-6 * Math.max(1, analysis.batteryVoltage);
  const powerOk = Math.abs(sumPower - vi) < 1e-6 * Math.max(1, vi);
  const kclOk =
    config.topology === 'parallel'
      ? Math.abs(rs.reduce((s, r) => s + r.current, 0) - analysis.totalCurrent) < 1e-9 * Math.max(1, analysis.totalCurrent) + 1e-12
      : config.topology === 'series-parallel'
        ? Math.abs(rs[1].current + rs[2].current - rs[0].current) < 1e-9 * Math.max(1, rs[0].current) + 1e-12
        : true;

  const readouts: { label: string; value: string; color: string }[] = [
    { label: 'R_eq (external)', value: isFinite(analysis.totalResistance) ? `${analysis.totalResistance.toFixed(2)} Ω` : '∞ Ω', color: 'text-sky-400' },
    { label: 'I total', value: fmtI(analysis.totalCurrent), color: 'text-emerald-400' },
    { label: 'P total (V·I)', value: fmtP(analysis.totalPower), color: 'text-purple-400' },
    { label: 'Terminal V', value: fmtV(analysis.terminalVoltage), color: 'text-amber-400' },
    { label: 'Lost inside', value: fmtP(analysis.internalPower), color: 'text-rose-400' },
  ];

  const circuitFormulas = [
    "V = I R \\quad (\\text{Ohm's law})",
    'V_t = \\mathcal{E} - I\\,r',
    'R_{\\text{series}} = R_1 + R_2 + R_3',
    '\\frac{1}{R_{\\text{par}}} = \\frac{1}{R_1} + \\frac{1}{R_2} + \\frac{1}{R_3}',
    '\\mathcal{E} I = \\sum I_k^2 R_k + I^2 r',
  ];

  return (
    <LabLayout title="Electric Circuits Laboratory" category="Electromagnetism">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/70 p-2.5">
          <span className="pl-2 pr-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-500">Topology</span>
          {TOPOLOGIES.map((t) => (
            <button
              key={t.id}
              onClick={() => setTopology(t.id)}
              aria-pressed={config.topology === t.id}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                config.topology === t.id
                  ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                  : 'border-transparent bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
          <button
            onClick={toggleSwitch}
            className="ml-auto flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 font-mono text-xs font-medium text-slate-200 transition-colors hover:bg-slate-700"
          >
            {sw.closed ? <ToggleRight className="h-4 w-4 text-emerald-400" /> : <ToggleLeft className="h-4 w-4 text-rose-400" />}
            <span>Switch {sw.closed ? 'closed' : 'open'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="min-w-0 space-y-4 lg:col-span-2">
            <Panel
              title={`Schematic — ${config.topology.replace('-', ' & ')}`}
              icon={Zap}
              accent="amber"
              flush
              right={
                <div className="hidden items-center gap-2 sm:flex">
                  <Badge accent="amber">ΔV</Badge>
                  <Badge accent="emerald">I</Badge>
                  <Badge accent="purple">P</Badge>
                </div>
              }
              footer={
                <div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-3 sm:grid-cols-5">
                    {readouts.map((r) => (
                      <div key={r.label} className="min-w-0">
                        <div className="truncate text-[10px] font-medium uppercase tracking-wider text-slate-500">{r.label}</div>
                        <div className={`mt-0.5 truncate font-mono text-sm font-semibold tabular-nums ${r.color}`}>{r.value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 border-t border-slate-800/80 px-4 py-2.5">
                    {open ? (
                      <Badge accent="rose">
                        <AlertTriangle className="h-3 w-3" /> Open circuit — I = 0
                      </Badge>
                    ) : (
                      <>
                        <Badge accent={kvlOk ? 'emerald' : 'rose'}>
                          <CheckCircle2 className="h-3 w-3" /> KVL: ΣΔV {sumDrops.toFixed(3)} = V_t {analysis.terminalVoltage.toFixed(3)} V
                        </Badge>
                        <Badge accent={powerOk ? 'emerald' : 'rose'}>
                          <CheckCircle2 className="h-3 w-3" /> ΣP {sumPower.toFixed(3)} = ℰI {vi.toFixed(3)} W
                        </Badge>
                        {config.topology !== 'series' && (
                          <Badge accent={kclOk ? 'emerald' : 'rose'}>
                            <CheckCircle2 className="h-3 w-3" /> KCL: branches sum to I
                          </Badge>
                        )}
                      </>
                    )}
                  </div>
                </div>
              }
            >
              <SimCanvas
                height={CANVAS_HEIGHT}
                draw={draw}
                animate
                cursor={hoverSwitch ? 'pointer' : 'default'}
                ariaLabel={`Schematic of a ${config.topology} circuit with live current flow`}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerLeave={() => setHoverSwitch(false)}
              />
            </Panel>
            <p className="px-1 text-[11px] leading-relaxed text-slate-500">
              Chevrons show conventional current (+ to −). Speed and density follow log₁₀(I), wire colour follows potential (blue = 0 V, amber = highest),
              resistor glow follows P / P_max. Click the switch on the diagram to open or close it.
            </p>
          </div>

          <div className="space-y-5">
            <Panel title="Component values" icon={Sliders} accent="amber">
              <Slider label="Battery EMF (ℰ)" value={config.battery.voltage} min={1} max={48} unit="V" accent="amber" onChange={setVoltage} />
              <Slider
                label="Internal resistance (r)"
                value={config.battery.internalResistance}
                min={0}
                max={5}
                step={0.1}
                unit="Ω"
                accent="rose"
                onChange={setInternal}
              />
              {config.resistors.map((r) => (
                <Slider
                  key={r.id}
                  label={`${r.id} resistance`}
                  value={r.resistance}
                  min={10}
                  max={500}
                  step={10}
                  unit="Ω"
                  accent="sky"
                  onChange={(v) => setResistance(r.id, v)}
                />
              ))}
            </Panel>

            <Panel title="Branch summary" icon={Gauge} accent="emerald">
              <div className="overflow-hidden rounded-lg border border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-[10px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">Part</th>
                      <th className="px-2 py-2 text-right font-medium">ΔV</th>
                      <th className="px-2 py-2 text-right font-medium">I</th>
                      <th className="px-2 py-2 text-right font-medium">P</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 font-mono tabular-nums">
                    {rs.map((r) => (
                      <tr key={r.id}>
                        <td className="px-3 py-1.5 font-sans text-slate-400">{r.id}</td>
                        <td className="px-2 py-1.5 text-right text-amber-300">{fmtV(r.voltageDrop)}</td>
                        <td className="px-2 py-1.5 text-right text-emerald-300">{fmtI(r.current)}</td>
                        <td className="px-2 py-1.5 text-right text-purple-300">{fmtP(r.power)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td className="px-3 py-1.5 font-sans text-slate-400">r (int.)</td>
                      <td className="px-2 py-1.5 text-right text-amber-300">{fmtV(analysis.totalCurrent * config.battery.internalResistance)}</td>
                      <td className="px-2 py-1.5 text-right text-emerald-300">{fmtI(analysis.totalCurrent)}</td>
                      <td className="px-2 py-1.5 text-right text-purple-300">{fmtP(analysis.internalPower)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Panel>

            <Panel title="Circuit laws" icon={Info} accent="indigo">
              <FormulaList formulas={circuitFormulas} />
            </Panel>
          </div>
        </div>
      </div>
    </LabLayout>
  );
};
