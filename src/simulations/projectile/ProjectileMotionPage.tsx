import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Sliders, Target, Info, MousePointerClick, CheckCircle2 } from 'lucide-react';
import { LabLayout } from '../../components/layout/LabLayout';
import { SimulationControls } from '../../components/controls/SimulationControls';
import { PhysicsChart } from '../../components/charts/PhysicsChart';
import { SimCanvas } from '../../components/canvas/SimCanvas';
import type { CanvasPointer, DrawFn } from '../../components/canvas/SimCanvas';
import {
  MONO,
  clamp,
  drawArrow,
  drawStars,
  drawTag,
  fillGradient,
  formatTickValue,
  glowDot,
  niceStep,
} from '../../components/canvas/draw';
import { Badge, FormulaList, Panel, ReadoutBar } from '../../components/ui/Panel';
import { Slider } from '../../components/ui/Slider';
import { CANVAS_COLORS } from '../../components/ui/theme';
import { useSimulation } from '../../hooks/useSimulation';
import { useTelemetry } from '../../hooks/useTelemetry';
import type { Vec2 } from '../../physics/vector';
import { DEG_TO_RAD, RAD_TO_DEG } from '../../physics/constants';
import {
  DEFAULT_PROJECTILE_PARAMS,
  createInitialState,
  generateAnalyticalTrajectory,
  getAnalyticalSolution,
  stepProjectile,
} from '../../physics/mechanics/projectile';
import type { ProjectileParams, ProjectileState } from '../../physics/mechanics/projectile';

const CANVAS_HEIGHT = 420;
/** Screen pixels drawn per m/s for the launch-vector handle (screen space, independent of the world scale). */
const AIM_PX_PER_MS = 2.2;
const PAD = { left: 56, right: 24, top: 30, bottom: 42 };

const GRAVITY_PRESETS = [
  { name: 'Moon', g: 1.62 },
  { name: 'Mars', g: 3.71 },
  { name: 'Earth', g: 9.81 },
  { name: 'Jupiter', g: 24.79 },
];

interface Layout {
  plotW: number;
  plotH: number;
  scale: number;
  xVisible: number;
  yVisible: number;
  toX: (x: number) => number;
  toY: (y: number) => number;
}

/**
 * One uniform scale for both axes (metres → pixels), so a 45° launch really is
 * drawn at 45°. The world extents come from the drag-free theory, which is an
 * upper bound for any trajectory in this lab.
 */
function makeLayout(width: number, height: number, range: number, maxHeight: number): Layout {
  const plotW = Math.max(40, width - PAD.left - PAD.right);
  const plotH = Math.max(40, height - PAD.top - PAD.bottom);
  const xMax = Math.max(range * 1.1, 24);
  const yMax = Math.max(maxHeight * 1.2, 12);
  const scale = Math.min(plotW / xMax, plotH / yMax);
  const base = PAD.top + plotH;
  return {
    plotW,
    plotH,
    scale,
    xVisible: plotW / scale,
    yVisible: plotH / scale,
    toX: (x) => PAD.left + x * scale,
    toY: (y) => base - y * scale,
  };
}

export const ProjectileMotionPage: React.FC = () => {
  const [params, setParams] = useState<ProjectileParams>(DEFAULT_PROJECTILE_PARAMS);
  const paramsRef = useRef(params);

  const stateRef = useRef<ProjectileState>(createInitialState(params));
  const [live, setLive] = useState<ProjectileState>(stateRef.current);
  const trailRef = useRef<Vec2[]>([{ ...stateRef.current.position }]);
  const maxYRef = useRef(params.height);
  const apexRef = useRef<Vec2>({ ...stateRef.current.position });
  const landedAtRef = useRef(0);
  const dragOriginRef = useRef<Vec2 | null>(null);

  const telemetry = useTelemetry(1500, 4);

  const analytical = useMemo(() => getAnalyticalSolution(params), [params]);
  const idealPath = useMemo(() => generateAnalyticalTrajectory(params, 120), [params]);
  const impactSpeedTheory = Math.sqrt(
    params.velocity * params.velocity + 2 * params.gravity * params.height
  );

  const { state: simState, play, pause, reset, step, setSpeed, finish } = useSimulation({
    dt: 1 / 120,
    onStep: () => {
      const p = paramsRef.current;
      if (stateRef.current.hasLanded) return;
      const next = stepProjectile(stateRef.current, p, 1 / 120);
      stateRef.current = next;
      trailRef.current.push({ ...next.position });
      if (next.position.y > maxYRef.current) {
        maxYRef.current = next.position.y;
        apexRef.current = { ...next.position };
      }

      const speed = Math.hypot(next.velocity.x, next.velocity.y);
      const ke = 0.5 * p.mass * speed * speed;
      const pe = p.mass * p.gravity * next.position.y;
      telemetry.push(
        {
          time: next.time,
          x: next.position.x,
          y: next.position.y,
          vx: next.velocity.x,
          vy: next.velocity.y,
          speed,
          ke,
          pe,
          total: ke + pe,
        },
        next.hasLanded
      );
      setLive(next);

      if (next.hasLanded) {
        landedAtRef.current = performance.now() / 1000;
        finish();
      }
    },
    onReset: () => {
      const init = createInitialState(paramsRef.current);
      stateRef.current = init;
      trailRef.current = [{ ...init.position }];
      maxYRef.current = init.position.y;
      apexRef.current = { ...init.position };
      telemetry.clear();
      setLive(init);
    },
  });

  /** Any parameter change restarts the run, so the picture never mixes two experiments. */
  const update = useCallback(
    (patch: Partial<ProjectileParams>) => {
      const next = { ...paramsRef.current, ...patch };
      paramsRef.current = next;
      setParams(next);
      reset();
    },
    [reset]
  );

  const idle = simState.status === 'idle';

  // ---- Click / drag on the canvas to aim the launcher -------------------------------------
  const aimFrom = useCallback(
    (p: CanvasPointer, origin: Vec2) => {
      const dx = p.x - origin.x;
      const dy = origin.y - p.y;
      const angle = clamp(Math.round(Math.atan2(dy, Math.max(dx, 0.001)) * RAD_TO_DEG), 0, 90);
      const velocity = clamp(Math.round(Math.hypot(dx, dy) / AIM_PX_PER_MS), 5, 80);
      if (angle !== paramsRef.current.angle || velocity !== paramsRef.current.velocity) {
        update({ angle, velocity });
      }
    },
    [update]
  );

  const launcherPoint = (width: number): Vec2 => {
    const lay = makeLayout(width, CANVAS_HEIGHT, analytical.range, analytical.maxHeight);
    return { x: lay.toX(0), y: lay.toY(paramsRef.current.height) };
  };

  const onPointerDown = (p: CanvasPointer) => {
    if (!idle) return;
    p.event.currentTarget.setPointerCapture(p.event.pointerId);
    // Freeze the launcher position for the whole drag so re-scaling can't make the aim jump.
    const width = p.event.currentTarget.clientWidth;
    dragOriginRef.current = launcherPoint(width);
    aimFrom(p, dragOriginRef.current);
  };
  const onPointerMove = (p: CanvasPointer) => {
    if (dragOriginRef.current && idle) aimFrom(p, dragOriginRef.current);
  };
  const onPointerUp = () => {
    dragOriginRef.current = null;
  };

  // ---- Scene -----------------------------------------------------------------------------------
  const draw: DrawFn = (ctx, width, height, time) => {
    const p = params;
    const lay = makeLayout(width, height, analytical.range, analytical.maxHeight);
    const { toX, toY, scale } = lay;
    const baseY = toY(0);
    const right = PAD.left + lay.plotW;

    // Night sky + ground
    fillGradient(ctx, width, height, '#0a1124', CANVAS_COLORS.bgDeep);
    drawStars(ctx, width, baseY, 60, 0, 11);
    const ground = ctx.createLinearGradient(0, baseY, 0, height);
    ground.addColorStop(0, '#12202f');
    ground.addColorStop(1, '#0a121c');
    ctx.fillStyle = ground;
    ctx.fillRect(0, baseY, width, height - baseY);

    // Grid with sensible ticks
    ctx.font = MONO;
    const xStep = niceStep(lay.xVisible, 6);
    const yStep = niceStep(lay.yVisible, 5);
    ctx.lineWidth = 1;
    for (let gx = 0; gx <= lay.xVisible + 1e-9; gx += xStep) {
      const cx = toX(gx);
      ctx.strokeStyle = gx === 0 ? CANVAS_COLORS.gridStrong : CANVAS_COLORS.grid;
      ctx.beginPath();
      ctx.moveTo(cx, PAD.top);
      ctx.lineTo(cx, baseY);
      ctx.stroke();
      ctx.fillStyle = CANVAS_COLORS.text;
      ctx.textAlign = 'center';
      ctx.fillText(formatTickValue(gx, xStep), cx, baseY + 17);
    }
    for (let gy = yStep; gy <= lay.yVisible + 1e-9; gy += yStep) {
      const cy = toY(gy);
      ctx.strokeStyle = CANVAS_COLORS.grid;
      ctx.beginPath();
      ctx.moveTo(PAD.left, cy);
      ctx.lineTo(right, cy);
      ctx.stroke();
      ctx.fillStyle = CANVAS_COLORS.text;
      ctx.textAlign = 'right';
      ctx.fillText(formatTickValue(gy, yStep), PAD.left - 8, cy + 4);
    }
    ctx.fillStyle = CANVAS_COLORS.axis;
    ctx.textAlign = 'right';
    ctx.fillText('x (m)', right, baseY + 33);
    ctx.textAlign = 'left';
    ctx.fillText('y (m)', 8, PAD.top - 12);

    // Ground line with a soft glow
    ctx.save();
    ctx.strokeStyle = '#38bdf8';
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 10;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(PAD.left - 22, baseY);
    ctx.lineTo(right + 14, baseY);
    ctx.stroke();
    ctx.restore();

    // Launch tower when starting above the ground
    const launchX = toX(0);
    const launchY = toY(p.height);
    if (p.height > 0) {
      ctx.fillStyle = '#1a2538';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.rect(launchX - 9, launchY + 4, 18, baseY - launchY - 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#334155';
      ctx.fillRect(launchX - 14, launchY + 2, 28, 4);
    }

    // Drag-free theory (dashed)
    if (idealPath.length > 1) {
      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      idealPath.forEach((pt, i) => {
        const px = toX(pt.x);
        const py = toY(pt.y);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
      ctx.restore();
    }

    // Live trail: glow under, crisp line on top
    const trail = trailRef.current;
    if (trail.length > 1) {
      ctx.save();
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      const path = () => {
        ctx.beginPath();
        trail.forEach((pt, i) => {
          const px = toX(pt.x);
          const py = toY(pt.y);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
      };
      ctx.strokeStyle = 'rgba(236, 72, 153, 0.22)';
      ctx.lineWidth = 8;
      path();
      ctx.stroke();
      ctx.strokeStyle = '#ec4899';
      ctx.lineWidth = 2.5;
      path();
      ctx.stroke();
      ctx.restore();
    }

    const pos = live.position;
    const bx = toX(pos.x);
    const by = toY(pos.y);
    const speed = Math.hypot(live.velocity.x, live.velocity.y);
    const launched = !idle;

    // Apex marker once we are past the top of the arc
    const pastApex = launched && (live.velocity.y <= 0 || live.hasLanded) && maxYRef.current > p.height + 0.05;
    if (pastApex) {
      const ax = toX(apexRef.current.x);
      const ay = toY(apexRef.current.y);
      ctx.save();
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax, baseY);
      ctx.stroke();
      ctx.restore();
      glowDot(ctx, ax, ay, 3.5, '#fbbf24', 6);
      drawTag(ctx, `apex ${apexRef.current.y.toFixed(1)} m`, ax, ay - 14, {
        color: '#fbbf24',
        align: 'center',
      });
    }

    // Shadow under the ball
    const shadowR = 9 * (1 - 0.55 * clamp(pos.y / Math.max(lay.yVisible, 1), 0, 1));
    ctx.save();
    ctx.fillStyle = `rgba(0, 0, 0, ${(0.35 * (1 - clamp(pos.y / Math.max(lay.yVisible, 1), 0, 1))).toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(bx, baseY + 2, shadowR, shadowR * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Launcher: barrel rotated to the launch angle
    const rad = p.angle * DEG_TO_RAD;
    ctx.save();
    ctx.translate(launchX, launchY);
    ctx.rotate(-rad);
    ctx.fillStyle = '#475569';
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(0, -4.5, 28, 9, 3);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.arc(launchX, launchY, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#94a3b8';
    ctx.stroke();

    if (idle) {
      // Aim handle: launch velocity vector, angle arc and readout
      const len = p.velocity * AIM_PX_PER_MS;
      const hx = launchX + Math.cos(rad) * len;
      const hy = launchY - Math.sin(rad) * len;
      drawArrow(ctx, launchX, launchY, hx, hy, '#fbbf24', { width: 2.5, head: 10, dash: [7, 5] });

      const arcR = Math.min(46, len * 0.6);
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(launchX, launchY, arcR, -rad, 0);
      ctx.stroke();
      drawTag(ctx, `${p.angle}°`, launchX + arcR + 10, launchY - 6, { color: '#fbbf24' });
      drawTag(ctx, `v₀ = ${p.velocity} m/s`, hx + 8, hy - 4, { color: '#fbbf24' });
      glowDot(ctx, hx, hy, 4, '#fbbf24', 8);

      drawTag(ctx, 'drag to aim  ·  Space to launch', width - PAD.right, PAD.top - 8, {
        color: CANVAS_COLORS.text,
        align: 'right',
        baseline: 'middle',
        font: '11px Inter, system-ui, sans-serif',
      });
    }

    // Velocity components on the ball
    if (launched && !live.hasLanded && speed > 0.01) {
      const k = Math.min(2.2, 84 / speed);
      const vx = live.velocity.x * k;
      const vy = -live.velocity.y * k;
      drawArrow(ctx, bx, by, bx + vx, by, '#22c55e', { width: 2, head: 7, alpha: 0.9 });
      drawArrow(ctx, bx, by, bx, by + vy, '#38bdf8', { width: 2, head: 7, alpha: 0.9 });
      drawArrow(ctx, bx, by, bx + vx, by + vy, '#eab308', { width: 2.5, head: 9 });
      if (Math.hypot(vx, vy) > 28) {
        drawTag(ctx, `${speed.toFixed(1)} m/s`, bx + vx + 6, by + vy - 10, { color: '#eab308' });
      }
    }

    // The projectile
    glowDot(ctx, bx, by, 6.5, '#f43f5e', 10);

    // Landing: range flag + expanding ripple
    if (live.hasLanded) {
      const lx = toX(pos.x);
      ctx.save();
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(lx, baseY);
      ctx.lineTo(lx, baseY - 22);
      ctx.stroke();
      ctx.fillStyle = '#34d399';
      ctx.beginPath();
      ctx.moveTo(lx, baseY - 22);
      ctx.lineTo(lx + 12, baseY - 18);
      ctx.lineTo(lx, baseY - 14);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      drawTag(ctx, `range ${pos.x.toFixed(1)} m`, lx, baseY - 32, { color: '#34d399', align: 'center' });

      const age = time - landedAtRef.current;
      if (age >= 0 && age < 1.2) {
        const t = age / 1.2;
        ctx.save();
        ctx.strokeStyle = `rgba(52, 211, 153, ${(0.7 * (1 - t)).toFixed(3)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(lx, baseY + 1, 8 + t * 46, (8 + t * 46) * 0.22, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Scale reminder
    drawTag(ctx, `1 m = ${scale.toFixed(1)} px`, right - 4, baseY - 8, {
      color: CANVAS_COLORS.axis,
      bg: 'rgba(7, 11, 20, 0.5)',
      align: 'right',
      baseline: 'bottom',
    });
  };

  // ---- Measured vs theory ------------------------------------------------------------------
  const landed = live.hasLanded;
  const measured = {
    maxHeight: maxYRef.current,
    range: landed ? live.position.x : null,
    time: landed ? live.time : null,
    impact: landed ? Math.hypot(live.velocity.x, live.velocity.y) : null,
  };
  const relErr = (m: number | null, t: number) => (m === null || t === 0 ? null : ((m - t) / t) * 100);
  const matchesTheory =
    landed &&
    !params.dragEnabled &&
    Math.abs(relErr(measured.range, analytical.range) ?? 0) < 0.1 &&
    Math.abs(relErr(measured.time, analytical.flightTime) ?? 0) < 0.1;

  const rows: { label: string; unit: string; theory: number; value: number | null }[] = [
    { label: 'Max height', unit: 'm', theory: analytical.maxHeight, value: launched(simState) ? measured.maxHeight : null },
    { label: 'Range', unit: 'm', theory: analytical.range, value: measured.range },
    { label: 'Flight time', unit: 's', theory: analytical.flightTime, value: measured.time },
    { label: 'Impact speed', unit: 'm/s', theory: impactSpeedTheory, value: measured.impact },
  ];

  return (
    <LabLayout title="Projectile Motion Laboratory" category="Mechanics & Kinematics">
      <div className="space-y-6">
        <SimulationControls
          state={simState}
          onPlay={() => {
            if (simState.status === 'finished') reset();
            play();
          }}
          onPause={pause}
          onReset={reset}
          onStep={step}
          onSpeedChange={setSpeed}
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Panel
              title="Trajectory view"
              icon={Target}
              accent="sky"
              flush
              right={
                <div className="hidden items-center gap-2 sm:flex">
                  <Badge accent="sky">Theory</Badge>
                  <Badge accent="pink">Simulated</Badge>
                  <Badge accent="amber">v vector</Badge>
                </div>
              }
              footer={
                <ReadoutBar
                  items={[
                    { label: 'x', value: `${live.position.x.toFixed(2)} m` },
                    { label: 'y', value: `${live.position.y.toFixed(2)} m` },
                    { label: 'vₓ', value: `${live.velocity.x.toFixed(2)} m/s`, accent: 'emerald' },
                    { label: 'vᵧ', value: `${live.velocity.y.toFixed(2)} m/s`, accent: 'sky' },
                  ]}
                />
              }
            >
              <SimCanvas
                height={CANVAS_HEIGHT}
                draw={draw}
                animate={landed}
                cursor={idle ? 'crosshair' : 'default'}
                ariaLabel="Projectile trajectory"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
              />
            </Panel>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <PhysicsChart
                data={telemetry.data}
                title="Trajectory (y vs x)"
                xKey="x"
                xLabel="Horizontal distance x (m)"
                series={[{ key: 'y', name: 'Height y', color: '#ec4899', unit: 'm' }]}
                exportFilename="projectile-trajectory.csv"
              />
              <PhysicsChart
                data={telemetry.data}
                title="Velocity profile"
                xLabel="Time (s)"
                series={[
                  { key: 'speed', name: 'Speed |v|', color: '#eab308', unit: 'm/s' },
                  { key: 'vy', name: 'vᵧ', color: '#38bdf8', unit: 'm/s' },
                  { key: 'vx', name: 'vₓ', color: '#22c55e', unit: 'm/s' },
                ]}
                referenceY={0}
                exportFilename="projectile-velocities.csv"
              />
            </div>
            <PhysicsChart
              data={telemetry.data}
              title={`Energy (mass ${params.mass} kg)${params.dragEnabled ? ' — drag drains it' : ' — conserved without drag'}`}
              xLabel="Time (s)"
              series={[
                { key: 'ke', name: 'Kinetic', color: '#38bdf8', unit: 'J' },
                { key: 'pe', name: 'Potential', color: '#c084fc', unit: 'J' },
                { key: 'total', name: 'Total', color: '#34d399', unit: 'J' },
              ]}
              exportFilename="projectile-energy.csv"
            />
          </div>

          <div className="space-y-5">
            <Panel title="Parameters" icon={Sliders} accent="sky">
              <Slider label="Launch velocity (v₀)" value={params.velocity} min={5} max={80} unit="m/s" accent="sky" onChange={(v) => update({ velocity: v })} />
              <Slider label="Launch angle (θ)" value={params.angle} min={0} max={90} unit="°" accent="sky" onChange={(v) => update({ angle: v })} />
              <Slider
                label="Gravity (g)"
                value={params.gravity}
                min={1.6}
                max={25}
                step={0.1}
                unit="m/s²"
                accent="emerald"
                onChange={(v) => update({ gravity: v })}
                hint={
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {GRAVITY_PRESETS.map((g) => (
                      <button
                        key={g.name}
                        onClick={() => update({ gravity: g.g })}
                        className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                          Math.abs(params.gravity - g.g) < 0.05
                            ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-300'
                            : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                        }`}
                      >
                        {g.name} {g.g}
                      </button>
                    ))}
                  </div>
                }
              />
              <Slider label="Initial height (y₀)" value={params.height} min={0} max={50} unit="m" accent="purple" onChange={(v) => update({ height: v })} />

              <div className="space-y-3 border-t border-slate-800/80 pt-3">
                <label className="flex cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={params.dragEnabled}
                    onChange={(e) => update({ dragEnabled: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-800 accent-rose-500"
                  />
                  <span className="text-xs font-medium text-slate-300">Air resistance (quadratic drag)</span>
                </label>
                {params.dragEnabled && (
                  <Slider
                    label="Drag coefficient (k)"
                    value={params.dragCoefficient}
                    min={0.001}
                    max={0.05}
                    step={0.001}
                    unit="kg/m"
                    accent="rose"
                    onChange={(v) => update({ dragCoefficient: v })}
                  />
                )}
              </div>
              <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <MousePointerClick className="h-3.5 w-3.5" /> You can also drag on the canvas to aim.
              </p>
            </Panel>

            <Panel
              title="Measured vs theory"
              icon={CheckCircle2}
              accent="emerald"
              right={matchesTheory ? <Badge accent="emerald">matches theory</Badge> : undefined}
            >
              <div className="overflow-hidden rounded-lg border border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-[10px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">Quantity</th>
                      <th className="px-3 py-2 text-right font-medium">Theory*</th>
                      <th className="px-3 py-2 text-right font-medium">Measured</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 font-mono">
                    {rows.map((r) => (
                      <tr key={r.label}>
                        <td className="px-3 py-2 font-sans text-slate-400">{r.label}</td>
                        <td className="px-3 py-2 text-right text-sky-300">
                          {r.theory.toFixed(2)} <span className="text-slate-500">{r.unit}</span>
                        </td>
                        <td className="px-3 py-2 text-right text-emerald-300">
                          {r.value === null ? <span className="text-slate-600">—</span> : <>{r.value.toFixed(2)} <span className="text-slate-500">{r.unit}</span></>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500">
                *Ideal case, no air resistance.{' '}
                {params.dragEnabled
                  ? 'With drag on, the measured values fall short of theory — that gap is the effect of air resistance.'
                  : 'Without drag, the numerical RK4 result should agree with theory to < 0.1 %.'}
              </p>
            </Panel>

            <Panel title="Governing equations" icon={Info} accent="indigo">
              <FormulaList
                formulas={[
                  'x(t) = v_0 \\cos(\\theta)\\, t',
                  'y(t) = y_0 + v_0 \\sin(\\theta)\\, t - \\tfrac{1}{2} g t^2',
                  'R = \\frac{v_0^2 \\sin(2\\theta)}{g} \\quad (y_0 = 0)',
                  '\\vec{a} = -g\\,\\hat{y} - \\tfrac{k}{m}\\,|\\vec{v}|\\,\\vec{v} \\quad (\\text{with drag})',
                ]}
              />
            </Panel>
          </div>
        </div>
      </div>
    </LabLayout>
  );
};

/** True once the run has started (anything but "idle"). */
function launched(s: { status: string }): boolean {
  return s.status !== 'idle';
}
