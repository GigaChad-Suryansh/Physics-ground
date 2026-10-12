import React, { useCallback, useRef, useState } from 'react';
import { Sliders, Activity, Info, Waves as WaveIcon, Gauge } from 'lucide-react';
import { LabLayout } from '../../components/layout/LabLayout';
import { SimulationControls } from '../../components/controls/SimulationControls';
import { PhysicsChart } from '../../components/charts/PhysicsChart';
import { SimCanvas } from '../../components/canvas/SimCanvas';
import type { DrawFn } from '../../components/canvas/SimCanvas';
import {
  MONO,
  clamp,
  drawArrow,
  drawTag,
  fillGradient,
  formatTickValue,
  glowDot,
  niceStep,
  niceTicks,
} from '../../components/canvas/draw';
import { Badge, FormulaList, Panel, ReadoutBar } from '../../components/ui/Panel';
import { Slider } from '../../components/ui/Slider';
import { CANVAS_COLORS } from '../../components/ui/theme';
import type { Accent } from '../../components/ui/theme';
import { useSimulation } from '../../hooks/useSimulation';
import { useTelemetry } from '../../hooks/useTelemetry';
import {
  DEFAULT_DUAL_WAVE_PARAMS,
  DEFAULT_SHM_PARAMS,
  DEFAULT_WAVE_PARAMS,
  angularFrequency,
  getDampingRegime,
  getSHMState,
  period,
  springConstant,
  standingWaveDisplacement,
  waveDisplacement,
  waveNumber,
  waveSpeed,
} from '../../physics/waves/waves';
import type { DampingRegime, SHMParams, SHMState, WaveParams } from '../../physics/waves/waves';

type Mode = 'traveling' | 'standing' | 'shm';

interface Config {
  mode: Mode;
  wave: WaveParams;
  wave2: WaveParams;
  superOn: boolean;
  shm: SHMParams;
}

const CANVAS_HEIGHT = 400;
const TAU = Math.PI * 2;
const PAD = { left: 52, right: 18, top: 34, bottom: 40 };
const STRIP_H = 78; // particle strip for longitudinal waves

const C1 = '#38bdf8'; // wave 1
const C2 = '#fbbf24'; // wave 2
const CSUM = '#f472b6'; // superposition / standing wave
const CPHASE = '#34d399';

const MODES: { id: Mode; label: string }[] = [
  { id: 'traveling', label: 'Traveling wave' },
  { id: 'standing', label: 'Standing wave' },
  { id: 'shm', label: 'Spring-mass (SHM)' },
];

const REGIME_STYLE: Record<DampingRegime, { label: string; accent: Accent; color: string }> = {
  undamped: { label: 'Undamped', accent: 'sky', color: '#38bdf8' },
  underdamped: { label: 'Underdamped', accent: 'emerald', color: '#34d399' },
  critical: { label: 'Critically damped', accent: 'amber', color: '#fbbf24' },
  overdamped: { label: 'Overdamped', accent: 'rose', color: '#fb7185' },
};

const initialConfig: Config = {
  mode: 'traveling',
  wave: { ...DEFAULT_WAVE_PARAMS },
  wave2: { ...DEFAULT_DUAL_WAVE_PARAMS.wave2 },
  superOn: false,
  shm: { ...DEFAULT_SHM_PARAMS },
};

/** ∂y/∂t of a travelling wave at (x, t). */
function waveVelocity(p: WaveParams, x: number, t: number): number {
  const w = angularFrequency(p.frequency);
  return -p.amplitude * w * Math.cos(waveNumber(p.wavelength) * x - w * t + p.phase);
}

/** Total displacement field shown on the canvas for the active tab. */
function field(cfg: Config, x: number, t: number): number {
  if (cfg.mode === 'standing') return standingWaveDisplacement(cfg.wave, x, t);
  let y = waveDisplacement(cfg.wave, x, t);
  if (cfg.superOn) y += waveDisplacement(cfg.wave2, x, t);
  return y;
}

function worldWidth(cfg: Config): number {
  const lam = cfg.mode === 'traveling' && cfg.superOn ? Math.max(cfg.wave.wavelength, cfg.wave2.wavelength) : cfg.wave.wavelength;
  return Math.max(6, Math.ceil(lam * 3));
}

function peakAmplitude(cfg: Config): number {
  if (cfg.mode === 'standing') return 2 * cfg.wave.amplitude;
  return cfg.wave.amplitude + (cfg.superOn ? cfg.wave2.amplitude : 0);
}

/** Double-headed dimension arrow (two arrows from the midpoint). */
function dimArrow(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, color: string): void {
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  drawArrow(ctx, mx, my, x0, y0, color, { width: 1.5, head: 7 });
  drawArrow(ctx, mx, my, x1, y1, color, { width: 1.5, head: 7 });
}

function dashedLine(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, color: string, dash = [3, 4]): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.restore();
}

/** Glow-under, crisp-over polyline from a sampling function. */
function strokeCurve(
  ctx: CanvasRenderingContext2D,
  samples: number,
  at: (i: number) => { x: number; y: number },
  color: string,
  width: number,
  glow: boolean,
  dash?: number[]
): void {
  const path = () => {
    ctx.beginPath();
    for (let i = 0; i <= samples; i++) {
      const p = at(i);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
  };
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (glow) {
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.2;
    ctx.lineWidth = width + 6;
    path();
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  if (dash) ctx.setLineDash(dash);
  path();
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------
// Wave scene (traveling + standing)
// ---------------------------------------------------------------------------------------------
function drawWaveScene(ctx: CanvasRenderingContext2D, width: number, height: number, cfg: Config, t: number): void {
  const { wave: w1, wave2: w2, superOn, mode } = cfg;
  const standing = mode === 'standing';
  const longitudinal = !standing && w1.waveType === 'longitudinal';
  const sup = !standing && superOn;

  const xMax = worldWidth(cfg);
  const peak = peakAmplitude(cfg);
  const yMax = peak * 1.3;
  const plotTop = PAD.top + (longitudinal ? STRIP_H : 0);
  const plotBottom = height - PAD.bottom;
  const plotW = Math.max(40, width - PAD.left - PAD.right);
  const right = PAD.left + plotW;
  const midY = (plotTop + plotBottom) / 2;
  const halfH = (plotBottom - plotTop) / 2;
  const sx = plotW / xMax;
  const toX = (x: number) => PAD.left + x * sx;
  const toY = (y: number) => midY - (y / yMax) * halfH;
  const k1 = waveNumber(w1.wavelength);
  const om1 = angularFrequency(w1.frequency);

  fillGradient(ctx, width, height, '#0a1124', CANVAS_COLORS.bgDeep);

  // ---- axes, grid, ticks --------------------------------------------------------------------
  ctx.font = MONO;
  ctx.lineWidth = 1;
  const xStep = niceStep(xMax, Math.max(3, Math.floor(plotW / 70)));
  for (let gx = 0; gx <= xMax + 1e-9; gx += xStep) {
    const cx = toX(gx);
    ctx.strokeStyle = gx === 0 ? CANVAS_COLORS.gridStrong : CANVAS_COLORS.grid;
    ctx.beginPath();
    ctx.moveTo(cx, plotTop);
    ctx.lineTo(cx, plotBottom);
    ctx.stroke();
    ctx.fillStyle = CANVAS_COLORS.text;
    ctx.textAlign = 'center';
    ctx.fillText(formatTickValue(gx, xStep), cx, plotBottom + 16);
  }
  for (const gy of niceTicks(-yMax, yMax, 6)) {
    const cy = toY(gy);
    if (gy === 0) continue;
    ctx.strokeStyle = CANVAS_COLORS.grid;
    ctx.beginPath();
    ctx.moveTo(PAD.left, cy);
    ctx.lineTo(right, cy);
    ctx.stroke();
    ctx.fillStyle = CANVAS_COLORS.text;
    ctx.textAlign = 'right';
    ctx.fillText(formatTickValue(gy, niceStep(2 * yMax, 6)), PAD.left - 8, cy + 4);
  }
  // equilibrium axis
  ctx.strokeStyle = CANVAS_COLORS.axis;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(PAD.left, midY);
  ctx.lineTo(right, midY);
  ctx.stroke();
  ctx.fillStyle = CANVAS_COLORS.text;
  ctx.textAlign = 'right';
  ctx.fillText('0', PAD.left - 8, midY + 4);
  ctx.fillStyle = CANVAS_COLORS.axis;
  ctx.textAlign = 'right';
  ctx.fillText('x (m)', right, plotBottom + 33);
  ctx.textAlign = 'left';
  ctx.fillText(longitudinal ? 'ξ (m)' : 'y (m)', 8, plotTop - 12 + (longitudinal ? 0 : 0));

  // ---- curves ---------------------------------------------------------------------------------
  const samples = Math.max(60, Math.floor(plotW / 2));
  const curveAt = (fn: (x: number) => number) => (i: number) => {
    const x = (i / samples) * xMax;
    return { x: toX(x), y: toY(fn(x)) };
  };

  if (standing) {
    // Envelope ±2A|sin kx| (dashed)
    for (const sgn of [1, -1]) {
      strokeCurve(
        ctx,
        samples,
        curveAt((x) => sgn * 2 * w1.amplitude * Math.abs(Math.sin(k1 * x))),
        'rgba(251, 191, 36, 0.75)',
        1.3,
        false,
        [6, 5]
      );
    }
    strokeCurve(ctx, samples, curveAt((x) => standingWaveDisplacement(w1, x, t)), CSUM, 2.8, true);
  } else if (sup) {
    strokeCurve(ctx, samples, curveAt((x) => waveDisplacement(w1, x, t)), C1, 1.5, false);
    strokeCurve(ctx, samples, curveAt((x) => waveDisplacement(w2, x, t)), C2, 1.5, false);
    strokeCurve(ctx, samples, curveAt((x) => field(cfg, x, t)), CSUM, 3.6, true);
  } else {
    strokeCurve(ctx, samples, curveAt((x) => waveDisplacement(w1, x, t)), C1, 2.8, true);
  }

  // ---- standing: nodes + antinodes ----------------------------------------------------------
  if (standing) {
    const lam = w1.wavelength;
    const nodeGapPx = (lam / 2) * sx;
    const labels = nodeGapPx >= 30;
    for (let n = 0; n * (lam / 2) <= xMax + 1e-9; n++) {
      const nx = n * (lam / 2);
      const cx = toX(nx);
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1.5;
      ctx.fillStyle = CANVAS_COLORS.bgDeep;
      ctx.beginPath();
      ctx.arc(cx, midY, 4, 0, TAU);
      ctx.fill();
      ctx.stroke();
      if (labels && cx > PAD.left + 8 && cx < right - 8) {
        drawTag(ctx, 'N', cx, midY + 17, { color: '#e2e8f0', align: 'center', padX: 5, padY: 2 });
      }
      const ax = nx + lam / 4;
      if (ax <= xMax + 1e-9) {
        const acx = toX(ax);
        glowDot(ctx, acx, toY(2 * w1.amplitude), 3, '#fbbf24', 5);
        glowDot(ctx, acx, toY(-2 * w1.amplitude), 3, '#fbbf24', 5);
        if (labels && acx > PAD.left + 8 && acx < right - 8) {
          drawTag(ctx, 'A', acx, toY(2 * w1.amplitude) - 15, { color: '#fbbf24', align: 'center', padX: 5, padY: 2 });
        }
      }
    }
    drawTag(ctx, 'envelope ±2A·|sin kx|', right, PAD.top - 16, {
      color: '#fbbf24',
      align: 'right',
      font: '11px Inter, system-ui, sans-serif',
    });
    drawTag(ctx, 'N node', PAD.left + 66, PAD.top - 16, { color: '#e2e8f0', align: 'left', font: '11px Inter, system-ui, sans-serif' });
    drawTag(ctx, 'A antinode', PAD.left + 130, PAD.top - 16, { color: '#fbbf24', align: 'left', font: '11px Inter, system-ui, sans-serif' });
  }

  // ---- traveling: dimensions + phase marker -------------------------------------------------
  if (!standing) {
    const lam = w1.wavelength;
    const c0 = (((Math.PI / 2 + om1 * t - w1.phase) / k1) % lam + lam) % lam;
    const m = Math.ceil((0.04 * xMax - c0) / lam);
    const c1 = c0 + m * lam;
    const c2 = c1 + lam;
    const A = w1.amplitude;
    const arrowY = toY(yMax * 0.8);

    // amplitude dimension at the first crest
    dashedLine(ctx, toX(c1) - 12, toY(A), toX(c1) + 12, toY(A), 'rgba(52, 211, 153, 0.7)', [2, 3]);
    dimArrow(ctx, toX(c1), toY(0), toX(c1), toY(A), CPHASE);
    drawTag(ctx, 'A', toX(c1) - 9, toY(A / 2), { color: CPHASE, align: 'right', padX: 5, padY: 2 });

    // wavelength dimension between two crests
    if (c2 <= xMax) {
      dashedLine(ctx, toX(c1), toY(A), toX(c1), arrowY - 6, 'rgba(148, 163, 184, 0.55)');
      dashedLine(ctx, toX(c2), toY(A), toX(c2), arrowY - 6, 'rgba(148, 163, 184, 0.55)');
      dimArrow(ctx, toX(c1), arrowY, toX(c2), arrowY, '#e2e8f0');
      drawTag(ctx, `λ = ${lam.toFixed(2)} m`, (toX(c1) + toX(c2)) / 2, arrowY - 14, { color: '#e2e8f0', align: 'center' });
    }

    // phase marker riding the crest, with a velocity arrow
    const px = toX(c1);
    const py = toY(A);
    drawArrow(ctx, px + 8, py, px + 8 + 30, py, CPHASE, { width: 2, head: 8 });
    glowDot(ctx, px, py, 4.5, CPHASE, 8);
    drawTag(ctx, 'v', px + 44, py, { color: CPHASE, align: 'left', padX: 4, padY: 2 });
  }

  // ---- medium particles ----------------------------------------------------------------------
  if (longitudinal) {
    const lam = w1.wavelength;
    const count = clamp(Math.round(xMax / (lam / 6)), 24, 90);
    const sp = xMax / count;
    const maxShift = 0.12 * lam; // keeps the strain amplitude below 1 so particles never cross
    const shift = (x: number) => (field(cfg, x, t) / peak) * maxShift;
    const rowY = [PAD.top + 14, PAD.top + 14 + 22, PAD.top + 14 + 44];
    const radius = clamp(sp * sx * 0.32, 1.6, 3.6);
    const trackedI = Math.round(count * 0.5);
    const h = lam * 0.01;

    ctx.fillStyle = CANVAS_COLORS.text;
    ctx.textAlign = 'left';
    ctx.font = MONO;
    ctx.fillText('medium', 8, rowY[1] + 4);

    // rest-position guide for the tracked particle
    const trackedRest = (trackedI + 0.5) * sp;
    dashedLine(ctx, toX(trackedRest), PAD.top + 2, toX(trackedRest), plotTop - 8, 'rgba(244, 63, 94, 0.55)');

    for (let i = 0; i < count; i++) {
      const rest = (i + 0.5) * sp;
      const d = shift(rest);
      const strain = (shift(rest + h) - shift(rest - h)) / (2 * h);
      const density = clamp(1 - strain, 0.2, 2); // >1 = compression
      const mix = clamp((density - 1) / 0.8, -1, 1);
      const color = mix >= 0 ? `rgba(251, 191, 36, ${0.45 + 0.5 * mix})` : `rgba(56, 189, 248, ${0.45 - 0.35 * mix})`;
      const cx = toX(rest + d);
      for (const ry of rowY) {
        if (i === trackedI) {
          glowDot(ctx, cx, ry, radius + 1.2, '#f43f5e', 5);
        } else {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(cx, ry, radius, 0, TAU);
          ctx.fill();
        }
      }
    }
    const lab = { color: CANVAS_COLORS.text, font: '10px Inter, system-ui, sans-serif', bg: 'rgba(7, 11, 20, 0.0)' };
    drawTag(ctx, 'amber = compression · blue = rarefaction', right, PAD.top - 16, { ...lab, align: 'right' });
  } else {
    // transverse particles with tethers
    const lam = standing || !sup ? w1.wavelength : Math.min(w1.wavelength, w2.wavelength);
    const count = clamp(Math.round(xMax / (lam / 4)), 12, Math.max(12, Math.floor(plotW / 22)));
    const sp = xMax / count;
    for (let i = 0; i < count; i++) {
      const x = (i + 0.5) * sp;
      const y = field(cfg, x, t);
      const cx = toX(x);
      const cy = toY(y);
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, midY);
      ctx.lineTo(cx, cy);
      ctx.stroke();
      glowDot(ctx, cx, cy, 4, '#f43f5e', 6);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Spring-mass scene
// ---------------------------------------------------------------------------------------------
function drawShmScene(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  p: SHMParams,
  s: SHMState,
  regime: DampingRegime
): void {
  const k = springConstant(p.mass, p.frequency);
  const E0 = 0.5 * k * p.amplitude * p.amplitude;
  const BLOCK = 56;
  const wallX = 30;
  const floorY = 150;
  const blockTop = floorY - BLOCK;
  const minSpring = 34;
  const maxDisp = 2; // amplitude slider maximum, so the scale never changes with A
  const centreMin = wallX + minSpring + BLOCK / 2;
  const centreMax = width - 16 - BLOCK / 2;
  const sPx = Math.max(10, (centreMax - centreMin) / (2 * maxDisp));
  const eqC = (centreMin + centreMax) / 2;
  const toX = (x: number) => eqC + x * sPx;
  const bx = toX(s.displacement);
  const style = REGIME_STYLE[regime];
  const sans = '11px Inter, system-ui, sans-serif';

  fillGradient(ctx, width, height, '#0a1124', CANVAS_COLORS.bgDeep);

  // wall
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(12, blockTop - 22, 18, BLOCK + 22 + 6);
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1;
  ctx.strokeRect(12, blockTop - 22, 18, BLOCK + 22 + 6);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
  for (let y = blockTop - 18; y < floorY + 4; y += 8) {
    ctx.beginPath();
    ctx.moveTo(12, y + 8);
    ctx.lineTo(30, y);
    ctx.stroke();
  }

  // floor with hatch
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(30, floorY);
  ctx.lineTo(width - 8, floorY);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
  ctx.lineWidth = 1;
  for (let x = 36; x < width - 8; x += 9) {
    ctx.beginPath();
    ctx.moveTo(x, floorY + 1);
    ctx.lineTo(x - 7, floorY + 9);
    ctx.stroke();
  }

  // equilibrium line
  dashedLine(ctx, eqC, blockTop - 28, eqC, floorY + 24, 'rgba(226, 232, 240, 0.55)', [5, 4]);

  // spring
  const sx0 = 30;
  const sx1 = bx - BLOCK / 2;
  const lead = 10;
  const turns = 16;
  const coilAmp = 11;
  const cy = blockTop + BLOCK / 2;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const springPath = () => {
    ctx.beginPath();
    ctx.moveTo(sx0, cy);
    ctx.lineTo(sx0 + lead, cy);
    const a = sx0 + lead;
    const b = sx1 - lead;
    for (let i = 1; i < turns * 2; i++) {
      const px = a + ((b - a) * i) / (turns * 2);
      ctx.lineTo(px, cy + (i % 2 === 1 ? -coilAmp : coilAmp));
    }
    ctx.lineTo(b, cy);
    ctx.lineTo(sx1, cy);
  };
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
  ctx.lineWidth = 7;
  springPath();
  ctx.stroke();
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  springPath();
  ctx.stroke();
  ctx.restore();

  // block
  ctx.save();
  const g = ctx.createLinearGradient(0, blockTop, 0, floorY);
  g.addColorStop(0, '#0ea5e9');
  g.addColorStop(1, '#0369a1');
  ctx.shadowColor = '#38bdf8';
  ctx.shadowBlur = 14;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(bx - BLOCK / 2, blockTop, BLOCK, BLOCK, 7);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#f8fafc';
  ctx.font = '600 12px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${p.mass} kg`, bx, cy + 1);
  ctx.textBaseline = 'alphabetic';

  // force arrows
  const fNorm = Math.max(1e-9, k * p.amplitude);
  const forceArrow = (f: number, row: number, color: string, name: string) => {
    const len = clamp((f / fNorm) * 70, -96, 96);
    const y = blockTop - 14 - row * 24;
    dashedLine(ctx, bx, y + 4, bx, blockTop, 'rgba(148, 163, 184, 0.35)', [2, 3]);
    drawArrow(ctx, bx, y, bx + len, y, color, { width: 2.6, head: 9 });
    ctx.font = MONO;
    const text = `${name} ${f >= 0 ? '+' : '−'}${Math.abs(f).toFixed(2)} N`;
    const tw = ctx.measureText(text).width + 12;
    const right = len >= 0;
    let tx = right ? bx + len + 8 : bx + len - 8;
    tx = right ? Math.min(tx, width - tw - 4) : Math.max(tx, tw + 4);
    if (Math.abs(len) < 3) tx = bx + 12;
    drawTag(ctx, text, tx, y, { color, align: right || Math.abs(len) < 3 ? 'left' : 'right' });
  };
  forceArrow(s.springForce, 0, '#34d399', 'Fₛ');
  forceArrow(s.dampingForce, 1, '#fb7185', 'F_d');

  // regime tag
  drawTag(ctx, style.label.toUpperCase(), width - 10, 16, { color: style.color, border: style.color, align: 'right', font: MONO });
  drawTag(ctx, `x = ${s.displacement >= 0 ? '+' : '−'}${Math.abs(s.displacement).toFixed(2)} m`, 10, 16, { color: '#e2e8f0', align: 'left' });

  // ruler under the floor
  const rulerY = floorY + 24;
  const R = 2.2;
  ctx.strokeStyle = CANVAS_COLORS.axis;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(toX(-R), rulerY);
  ctx.lineTo(toX(R), rulerY);
  ctx.stroke();
  ctx.font = MONO;
  ctx.textAlign = 'center';
  const tickStep = niceStep(2 * R, Math.max(3, Math.floor((2 * R * sPx) / 52)));
  for (const v of niceTicks(-R, R, 8)) {
    if (Math.abs(v / tickStep - Math.round(v / tickStep)) > 1e-6) continue;
    ctx.strokeStyle = CANVAS_COLORS.axis;
    ctx.beginPath();
    ctx.moveTo(toX(v), rulerY - 4);
    ctx.lineTo(toX(v), rulerY + 4);
    ctx.stroke();
    ctx.fillStyle = CANVAS_COLORS.text;
    ctx.fillText(formatTickValue(v, tickStep), toX(v), rulerY + 18);
  }
  ctx.fillStyle = CANVAS_COLORS.axis;
  ctx.textAlign = 'left';
  ctx.fillText('x (m)', 8, rulerY + 18);
  // ±A markers
  for (const sgn of [-1, 1]) {
    const mx = toX(sgn * p.amplitude);
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.moveTo(mx, rulerY - 3);
    ctx.lineTo(mx - 4, rulerY - 11);
    ctx.lineTo(mx + 4, rulerY - 11);
    ctx.closePath();
    ctx.fill();
    drawTag(ctx, sgn < 0 ? '−A' : '+A', mx, rulerY + 38, { color: '#fbbf24', align: 'center', padX: 4, padY: 2 });
  }

  // energy bars
  const barsTop = 262;
  ctx.font = sans;
  ctx.fillStyle = CANVAS_COLORS.text;
  ctx.textAlign = 'left';
  ctx.fillText(`Energy  (full bar = E₀ = ${E0.toFixed(2)} J)`, 10, barsTop - 12);
  const labelW = 46;
  const valueW = 74;
  const bx0 = 10 + labelW;
  const bw = Math.max(40, width - bx0 - valueW - 10);
  const bars = [
    { name: 'KE', val: s.kineticEnergy, color: '#38bdf8' },
    { name: 'PE', val: s.potentialEnergy, color: '#c084fc' },
    { name: 'Total', val: s.totalEnergy, color: '#34d399' },
  ];
  bars.forEach((b, i) => {
    const y = barsTop + i * 28;
    ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
    ctx.beginPath();
    ctx.roundRect(bx0, y, bw, 16, 4);
    ctx.fill();
    const fw = clamp(b.val / Math.max(E0, 1e-9), 0, 1) * bw;
    if (fw > 0.5) {
      ctx.save();
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.roundRect(bx0, y, Math.max(fw, 2), 16, 4);
      ctx.fill();
      ctx.restore();
    }
    ctx.font = sans;
    ctx.fillStyle = b.color;
    ctx.textAlign = 'left';
    ctx.fillText(b.name, 10, y + 12);
    ctx.font = MONO;
    ctx.fillStyle = CANVAS_COLORS.textBright;
    ctx.fillText(`${b.val.toFixed(2)} J`, bx0 + bw + 8, y + 12);
  });
}

// ---------------------------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------------------------
const segBtn = (active: boolean) =>
  `rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
    active
      ? 'border-sky-500/40 bg-sky-500/15 text-sky-300'
      : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
  }`;

export const WavesPage: React.FC = () => {
  const [cfg, setCfg] = useState<Config>(initialConfig);
  const cfgRef = useRef(cfg);
  const [t, setT] = useState(0);
  const telemetry = useTelemetry(6000, 2);

  const { state: simState, play, pause, reset, step, setSpeed } = useSimulation({
    dt: 1 / 120,
    onStep: (_dt, total) => {
      const c = cfgRef.current;
      setT(total);
      if (c.mode === 'shm') {
        const s = getSHMState(c.shm, total);
        telemetry.push({
          time: total,
          x: s.displacement,
          v: s.velocity,
          ke: s.kineticEnergy,
          pe: s.potentialEnergy,
          total: s.totalEnergy,
        });
      } else if (c.mode === 'standing') {
        const q = c.wave.wavelength;
        telemetry.push({
          time: total,
          anti: standingWaveDisplacement(c.wave, q / 4, total),
          left: standingWaveDisplacement(c.wave, q / 8, total),
          right: standingWaveDisplacement(c.wave, (3 * q) / 8, total),
        });
      } else {
        const y1 = waveDisplacement(c.wave, 0, total);
        const point: { time: number; [k: string]: number } = {
          time: total,
          y1,
          v: waveVelocity(c.wave, 0, total),
        };
        if (c.superOn) {
          point.y2 = waveDisplacement(c.wave2, 0, total);
          point.sum = y1 + point.y2;
          point.v += waveVelocity(c.wave2, 0, total);
        }
        telemetry.push(point);
      }
    },
    onReset: () => {
      telemetry.clear();
      setT(0);
    },
  });

  const update = useCallback(
    (patch: Partial<Config>) => {
      const next = { ...cfgRef.current, ...patch };
      cfgRef.current = next;
      setCfg(next);
      reset();
    },
    [reset]
  );
  const updWave = (p: Partial<WaveParams>) => update({ wave: { ...cfgRef.current.wave, ...p } });
  const updWave2 = (p: Partial<WaveParams>) => update({ wave2: { ...cfgRef.current.wave2, ...p } });
  const updShm = (p: Partial<SHMParams>) => update({ shm: { ...cfgRef.current.shm, ...p } });

  const { mode, wave, wave2, superOn, shm } = cfg;
  const regime = getDampingRegime(shm);
  const regimeStyle = REGIME_STYLE[regime];
  const shmState = getSHMState(shm, t);
  const kSpring = springConstant(shm.mass, shm.frequency);
  const omega0 = angularFrequency(shm.frequency);
  const gamma = shm.damping / (2 * shm.mass);
  const zeta = gamma / omega0;
  const critical = 4 * Math.PI * shm.mass * shm.frequency;

  const omega = angularFrequency(wave.frequency);
  const longitudinal = mode === 'traveling' && wave.waveType === 'longitudinal';

  const draw: DrawFn = (ctx, width, height) => {
    if (mode === 'shm') drawShmScene(ctx, width, height, shm, shmState, regime);
    else drawWaveScene(ctx, width, height, cfg, t);
  };

  // ---- readouts -------------------------------------------------------------------------------
  const readouts =
    mode === 'shm'
      ? [
          { label: 'Time t', value: `${t.toFixed(2)} s`, accent: 'sky' as Accent },
          { label: 'Displacement x', value: `${shmState.displacement.toFixed(3)} m`, accent: 'emerald' as Accent },
          { label: 'Velocity v', value: `${shmState.velocity.toFixed(3)} m/s`, accent: 'purple' as Accent },
          { label: 'Acceleration a', value: `${shmState.acceleration.toFixed(2)} m/s²`, accent: 'amber' as Accent },
        ]
      : [
          { label: 'Speed v = fλ', value: `${waveSpeed(wave.frequency, wave.wavelength).toFixed(2)} m/s`, accent: 'sky' as Accent },
          { label: 'Period T', value: `${period(wave.frequency).toFixed(2)} s`, accent: 'emerald' as Accent },
          { label: 'Wave number k', value: `${waveNumber(wave.wavelength).toFixed(2)} rad/m`, accent: 'purple' as Accent },
          { label: 'Angular freq ω', value: `${omega.toFixed(2)} rad/s`, accent: 'amber' as Accent },
        ];

  // ---- charts -------------------------------------------------------------------------------
  const chartA =
    mode === 'shm' ? (
      <PhysicsChart
        data={telemetry.data}
        title="Displacement & velocity vs time"
        series={[
          { key: 'x', name: 'Displacement x', color: '#34d399', unit: 'm' },
          { key: 'v', name: 'Velocity v', color: '#c084fc', unit: 'm/s', axis: 'right' },
        ]}
        referenceY={0}
        exportFilename="shm-displacement.csv"
      />
    ) : mode === 'standing' ? (
      <PhysicsChart
        data={telemetry.data}
        title="Displacement at the antinode (x = λ/4)"
        series={[{ key: 'anti', name: 'y(λ/4, t)', color: CSUM, unit: 'm' }]}
        referenceY={0}
        exportFilename="standing-antinode.csv"
      />
    ) : (
      <PhysicsChart
        data={telemetry.data}
        title={`${longitudinal ? 'Displacement ξ' : 'Displacement y'} at x = 0`}
        series={[
          { key: 'y1', name: superOn ? 'Wave 1' : 'y(0, t)', color: C1, unit: 'm' },
          ...(superOn
            ? [
                { key: 'y2', name: 'Wave 2', color: C2, unit: 'm' },
                { key: 'sum', name: 'Sum', color: CSUM, unit: 'm' },
              ]
            : []),
        ]}
        referenceY={0}
        exportFilename="wave-displacement.csv"
      />
    );

  const chartB =
    mode === 'shm' ? (
      <PhysicsChart
        data={telemetry.data}
        title="Energy vs time"
        series={[
          { key: 'ke', name: 'Kinetic', color: '#38bdf8', unit: 'J' },
          { key: 'pe', name: 'Potential', color: '#c084fc', unit: 'J' },
          { key: 'total', name: 'Total', color: '#34d399', unit: 'J' },
        ]}
        exportFilename="shm-energy.csv"
      />
    ) : mode === 'standing' ? (
      <PhysicsChart
        data={telemetry.data}
        title="Either side of a node (λ/8 vs 3λ/8)"
        series={[
          { key: 'left', name: 'y(λ/8, t)', color: '#38bdf8', unit: 'm' },
          { key: 'right', name: 'y(3λ/8, t)', color: '#fbbf24', unit: 'm' },
        ]}
        referenceY={0}
        exportFilename="standing-neighbours.csv"
      />
    ) : (
      <PhysicsChart
        data={telemetry.data}
        title="Particle velocity ∂y/∂t at x = 0"
        series={[{ key: 'v', name: superOn ? 'Net velocity' : 'Velocity', color: '#34d399', unit: 'm/s' }]}
        referenceY={0}
        exportFilename="wave-velocity.csv"
      />
    );

  const formulas =
    mode === 'shm'
      ? [
          'm\\ddot{x} + c\\dot{x} + kx = 0, \\quad k = m\\omega_0^2',
          '\\gamma = \\tfrac{c}{2m}, \\quad \\zeta = \\tfrac{\\gamma}{\\omega_0}',
          'x(t) = A e^{-\\gamma t}\\left[\\cos\\omega_d t + \\tfrac{\\gamma}{\\omega_d}\\sin\\omega_d t\\right]',
          'E = \\tfrac{1}{2}mv^2 + \\tfrac{1}{2}kx^2',
        ]
      : mode === 'standing'
        ? [
            'y(x,t) = 2A\\sin(kx)\\cos(\\omega t)',
            '\\text{nodes: } x = n\\tfrac{\\lambda}{2}, \\quad \\text{antinodes: } x = (2n+1)\\tfrac{\\lambda}{4}',
            'v = f\\lambda = \\tfrac{\\omega}{k}',
          ]
        : [
            'y(x,t) = A\\sin(kx - \\omega t + \\phi)',
            'v = f\\lambda = \\tfrac{\\omega}{k}, \\quad k = \\tfrac{2\\pi}{\\lambda}, \\quad \\omega = 2\\pi f',
            'y_{\\text{sum}} = y_1 + y_2',
          ];

  const headerBadges =
    mode === 'shm' ? (
      <Badge accent={regimeStyle.accent}>{regimeStyle.label}</Badge>
    ) : mode === 'standing' ? (
      <div className="hidden items-center gap-2 sm:flex">
        <Badge accent="pink">Standing wave</Badge>
        <Badge accent="amber">Envelope</Badge>
      </div>
    ) : (
      <div className="hidden items-center gap-2 sm:flex">
        <Badge accent="sky">Wave 1</Badge>
        {superOn && <Badge accent="amber">Wave 2</Badge>}
        {superOn && <Badge accent="pink">Sum</Badge>}
      </div>
    );

  const ariaLabel =
    mode === 'shm' ? 'Spring-mass oscillator' : mode === 'standing' ? 'Standing wave' : 'Traveling wave';

  return (
    <LabLayout title="Waves & Oscillations Laboratory" category="Wave Mechanics">
      <div className="space-y-6">
        <SimulationControls
          state={simState}
          onPlay={play}
          onPause={pause}
          onReset={reset}
          onStep={step}
          onSpeedChange={setSpeed}
        />

        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Simulation mode">
          {MODES.map((m) => (
            <button
              key={m.id}
              role="tab"
              aria-selected={mode === m.id}
              onClick={() => mode !== m.id && update({ mode: m.id })}
              className={segBtn(mode === m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="min-w-0 space-y-4 lg:col-span-2">
            <Panel
              title={MODES.find((m) => m.id === mode)?.label}
              icon={mode === 'shm' ? Activity : WaveIcon}
              accent="sky"
              flush
              right={headerBadges}
              footer={<ReadoutBar items={readouts} />}
            >
              <SimCanvas height={CANVAS_HEIGHT} draw={draw} ariaLabel={ariaLabel} />
            </Panel>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {chartA}
              {chartB}
            </div>
          </div>

          <div className="min-w-0 space-y-5">
            <Panel title="Parameters" icon={Sliders} accent="sky">
              {mode === 'traveling' && (
                <>
                  <div className="flex gap-2">
                    {(['transverse', 'longitudinal'] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => wave.waveType !== type && updWave({ waveType: type })}
                        className={`${segBtn(wave.waveType === type)} flex-1 capitalize`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                  <Slider label="Amplitude (A)" value={wave.amplitude} min={0.2} max={2} step={0.1} unit="m" accent="sky" onChange={(v) => updWave({ amplitude: v })} />
                  <Slider label="Frequency (f)" value={wave.frequency} min={0.2} max={4} step={0.1} unit="Hz" accent="emerald" onChange={(v) => updWave({ frequency: v })} />
                  <Slider label="Wavelength (λ)" value={wave.wavelength} min={0.5} max={6} step={0.25} unit="m" accent="purple" onChange={(v) => updWave({ wavelength: v })} />
                  <Slider
                    label="Phase (φ)"
                    value={Math.round((wave.phase * 180) / Math.PI)}
                    min={0}
                    max={360}
                    step={5}
                    unit="°"
                    accent="indigo"
                    onChange={(v) => updWave({ phase: (v * Math.PI) / 180 })}
                  />

                  <div className="space-y-3 border-t border-slate-800/80 pt-3">
                    <label className="flex cursor-pointer items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={superOn}
                        onChange={(e) => update({ superOn: e.target.checked })}
                        className="h-4 w-4 rounded border-slate-600 bg-slate-800 accent-pink-500"
                      />
                      <span className="text-xs font-medium text-slate-300">Add a second wave (superposition)</span>
                    </label>
                    {superOn && (
                      <>
                        <Slider label="Wave 2 amplitude" value={wave2.amplitude} min={0.2} max={2} step={0.1} unit="m" accent="amber" onChange={(v) => updWave2({ amplitude: v })} />
                        <Slider label="Wave 2 frequency" value={wave2.frequency} min={0.2} max={4} step={0.1} unit="Hz" accent="amber" onChange={(v) => updWave2({ frequency: v })} />
                        <Slider label="Wave 2 wavelength" value={wave2.wavelength} min={0.5} max={6} step={0.25} unit="m" accent="amber" onChange={(v) => updWave2({ wavelength: v })} />
                      </>
                    )}
                  </div>
                </>
              )}

              {mode === 'standing' && (
                <>
                  <Slider label="Amplitude of each wave (A)" value={wave.amplitude} min={0.2} max={2} step={0.1} unit="m" accent="sky" onChange={(v) => updWave({ amplitude: v })} />
                  <Slider label="Frequency (f)" value={wave.frequency} min={0.2} max={4} step={0.1} unit="Hz" accent="emerald" onChange={(v) => updWave({ frequency: v })} />
                  <Slider label="Wavelength (λ)" value={wave.wavelength} min={0.5} max={6} step={0.25} unit="m" accent="purple" onChange={(v) => updWave({ wavelength: v })} />
                  <p className="text-[11px] leading-relaxed text-slate-500">
                    Two equal waves travelling in opposite directions. Nodes never move; antinodes swing through ±2A.
                  </p>
                </>
              )}

              {mode === 'shm' && (
                <>
                  <Slider label="Initial displacement (A)" value={shm.amplitude} min={0.2} max={2} step={0.1} unit="m" accent="sky" onChange={(v) => updShm({ amplitude: v })} />
                  <Slider label="Natural frequency (f₀)" value={shm.frequency} min={0.2} max={4} step={0.1} unit="Hz" accent="emerald" onChange={(v) => updShm({ frequency: v })} />
                  <Slider label="Mass (m)" value={shm.mass} min={0.5} max={5} step={0.5} unit="kg" accent="purple" onChange={(v) => updShm({ mass: v })} />
                  <Slider
                    label="Damping coefficient (c)"
                    value={Math.round(shm.damping * 100) / 100}
                    min={0}
                    max={Math.max(10, Math.ceil(critical * 2.5))}
                    step={0.1}
                    unit="kg/s"
                    accent="rose"
                    onChange={(v) => updShm({ damping: v })}
                    hint={
                      <div className="space-y-2 pt-1">
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            { name: 'Undamped', c: 0, r: 'undamped' as DampingRegime },
                            { name: 'Under', c: critical * 0.2, r: 'underdamped' as DampingRegime },
                            { name: 'Critical', c: critical, r: 'critical' as DampingRegime },
                            { name: 'Over', c: critical * 2, r: 'overdamped' as DampingRegime },
                          ].map((preset) => (
                            <button
                              key={preset.name}
                              onClick={() => updShm({ damping: preset.c })}
                              className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                                regime === preset.r
                                  ? 'border-rose-400/50 bg-rose-500/15 text-rose-300'
                                  : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                              }`}
                            >
                              {preset.name}
                            </button>
                          ))}
                        </div>
                        <div>Critical damping for these settings: c = 2mω₀ = {critical.toFixed(2)} kg/s</div>
                      </div>
                    }
                  />
                </>
              )}
            </Panel>

            {mode === 'shm' && (
              <Panel
                title="Oscillator"
                icon={Gauge}
                accent="rose"
                right={<Badge accent={regimeStyle.accent}>{regimeStyle.label}</Badge>}
              >
                <ReadoutBar
                  className="!px-0 !py-0 sm:!grid-cols-2"
                  items={[
                    { label: 'Spring k', value: `${kSpring.toFixed(1)} N/m` },
                    { label: 'ω₀', value: `${omega0.toFixed(2)} rad/s`, accent: 'sky' },
                    { label: 'γ = c/2m', value: `${gamma.toFixed(2)} 1/s`, accent: 'rose' },
                    { label: 'ζ = γ/ω₀', value: zeta.toFixed(3), accent: 'amber' },
                  ]}
                />
              </Panel>
            )}

            <Panel title="Governing equations" icon={Info} accent="indigo">
              <FormulaList formulas={formulas} />
            </Panel>
          </div>
        </div>
      </div>
    </LabLayout>
  );
};
