import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Activity, Info, Orbit, Sliders } from 'lucide-react';
import { LabLayout } from '../../components/layout/LabLayout';
import { SimulationControls } from '../../components/controls/SimulationControls';
import { PhysicsChart } from '../../components/charts/PhysicsChart';
import { SimCanvas } from '../../components/canvas/SimCanvas';
import type { DrawFn } from '../../components/canvas/SimCanvas';
import {
  MONO,
  clamp,
  drawArrow,
  drawStars,
  drawTag,
  fillGradient,
  glowDot,
  niceStep,
} from '../../components/canvas/draw';
import { Badge, FormulaList, Panel, ReadoutBar } from '../../components/ui/Panel';
import { Slider } from '../../components/ui/Slider';
import { CANVAS_COLORS } from '../../components/ui/theme';
import { useSimulation } from '../../hooks/useSimulation';
import { useTelemetry } from '../../hooks/useTelemetry';
import type { Vec2 } from '../../physics/vector';
import {
  DEFAULT_ORBITAL_PARAMS,
  circularOrbitSpeed,
  createInitialOrbitalState,
  getOrbitInfo,
  stepOrbital,
} from '../../physics/mechanics/orbital';
import type { OrbitInfo, OrbitalParams, OrbitalState } from '../../physics/mechanics/orbital';

const CANVAS_HEIGHT = 420;
const PAD_X = 22;
const PAD_Y = 38;
/** Orbits larger than this multiple of r₀ are clipped (the view stays readable). */
const BOUND_CAP = 3.5;
const UNBOUND_CAP = 2.4;

// Longer trail than the default so one full revolution stays visible.
const INITIAL_PARAMS: OrbitalParams = { ...DEFAULT_ORBITAL_PARAMS, trailLength: 4000 };

const PRESETS = [
  { name: 'Circular', factor: 1, kind: 'circ' as const },
  { name: 'Elliptical', factor: 0.75, kind: 'circ' as const },
  { name: 'Near-escape', factor: 0.97, kind: 'esc' as const },
  { name: 'Escape', factor: 1.15, kind: 'esc' as const },
];

type OrbitKind = 'Circular' | 'Elliptical' | 'Parabolic' | 'Hyperbolic';

function classify(info: OrbitInfo): OrbitKind {
  if (info.bound) return info.eccentricity < 0.005 ? 'Circular' : 'Elliptical';
  return Math.abs(info.eccentricity - 1) < 0.005 ? 'Parabolic' : 'Hyperbolic';
}

function num(v: number, digits = 1): string {
  if (!Number.isFinite(v)) return '—';
  return Math.abs(v) >= 1e5 ? v.toExponential(2) : v.toFixed(digits);
}

/**
 * Closed-form Kepler curve of body 2 in the centre-of-mass frame. The relative
 * orbit r(θ) = p / (1 + e cos(θ − ω)) is scaled by body 2's share of the
 * separation, which puts the focus exactly at the COM. The starting point is at
 * θ = 0 on +x and moves counter-clockwise: it is periapsis if v ≥ v_circ
 * (ω = 0), apoapsis otherwise (ω = π). Points beyond `cap` (relative
 * separation) are dropped; r grows with |θ − ω| so what remains is contiguous.
 */
function referenceCurve(info: OrbitInfo, params: OrbitalParams, cap: number): Vec2[] {
  const e = info.eccentricity;
  const h = params.initialSeparation * params.body2Speed;
  const p = (h * h) / info.mu;
  const omega = info.startsAtPeriapsis ? 0 : Math.PI;
  const f2 = params.body1Mass / (params.body1Mass + params.body2Mass);
  const uMax = e > 1 ? Math.acos(-1 / e) - 0.02 : Math.PI;
  const pts: Vec2[] = [];
  const n = 360;
  for (let i = 0; i <= n; i++) {
    const u = -uMax + (2 * uMax * i) / n;
    const r = p / (1 + e * Math.cos(u));
    if (!(r > 0) || r > cap) continue;
    const th = omega + u;
    pts.push({ x: f2 * r * Math.cos(th), y: f2 * r * Math.sin(th) });
  }
  return pts;
}

interface View {
  scale: number;
  toX: (x: number) => number;
  toY: (y: number) => number;
}

/** Equal x/y scale chosen so the reference curve (and the star) fit with margins. */
function makeView(width: number, height: number, curve: Vec2[]): View {
  let minX = 0;
  let maxX = 0;
  let minY = 0;
  let maxY = 0;
  for (const q of curve) {
    minX = Math.min(minX, q.x);
    maxX = Math.max(maxX, q.x);
    minY = Math.min(minY, q.y);
    maxY = Math.max(maxY, q.y);
  }
  const bw = Math.max(maxX - minX, 1e-6);
  const bh = Math.max(maxY - minY, 1e-6);
  const scale = Math.min((width - 2 * PAD_X) / bw, (height - 2 * PAD_Y) / bh);
  const cx = width / 2 - ((minX + maxX) / 2) * scale;
  const cy = height / 2 + ((minY + maxY) / 2) * scale;
  return { scale, toX: (x) => cx + x * scale, toY: (y) => cy - y * scale };
}

export const OrbitalPage: React.FC = () => {
  const [params, setParams] = useState<OrbitalParams>(INITIAL_PARAMS);
  const paramsRef = useRef(params);

  const stateRef = useRef<OrbitalState>(createInitialOrbitalState(params));
  const [live, setLive] = useState<OrbitalState>(stateRef.current);
  const e0Ref = useRef(stateRef.current.totalEnergy);
  const eScaleRef = useRef(
    stateRef.current.kineticEnergy + Math.abs(stateRef.current.potentialEnergy)
  );
  const collidedAtRef = useRef(0);

  const telemetry = useTelemetry(1500, 4);

  const info = useMemo(() => getOrbitInfo(params), [params]);
  const kind = classify(info);
  const f2 = params.body1Mass / (params.body1Mass + params.body2Mass);
  const clipped = info.bound && info.apoapsis > BOUND_CAP * params.initialSeparation;
  const curve = useMemo(() => {
    const cap = info.bound
      ? Math.min(info.apoapsis, BOUND_CAP * params.initialSeparation)
      : UNBOUND_CAP * params.initialSeparation;
    return referenceCurve(info, params, cap * 1.0001);
  }, [info, params]);

  const { state: simState, play, pause, reset, step, setSpeed, finish } = useSimulation({
    dt: 1 / 120,
    onStep: (dt) => {
      const p = paramsRef.current;
      if (stateRef.current.hasCollided) return;
      const next = stepOrbital(stateRef.current, p, dt);
      stateRef.current = next;

      const vrel = Math.hypot(
        next.body2.velocity.x - next.body1.velocity.x,
        next.body2.velocity.y - next.body1.velocity.y
      );
      const denom = Math.max(Math.abs(e0Ref.current), 0.01 * eScaleRef.current, 1e-12);
      telemetry.push(
        {
          time: next.time,
          separation: next.separation,
          angularMomentum: next.angularMomentum,
          kinetic: next.kineticEnergy,
          potential: next.potentialEnergy,
          total: next.totalEnergy,
          drift: (Math.abs(next.totalEnergy - e0Ref.current) / denom) * 100,
          speed: vrel,
        },
        next.hasCollided
      );
      setLive(next);

      if (next.hasCollided) {
        collidedAtRef.current = performance.now() / 1000;
        finish();
      }
    },
    onReset: () => {
      const init = createInitialOrbitalState(paramsRef.current);
      stateRef.current = init;
      e0Ref.current = init.totalEnergy;
      eScaleRef.current = init.kineticEnergy + Math.abs(init.potentialEnergy);
      telemetry.clear();
      setLive(init);
    },
  });

  /** Any parameter change restarts the run, so the picture never mixes two experiments. */
  const update = useCallback(
    (patch: Partial<OrbitalParams>) => {
      const next = { ...paramsRef.current, ...patch };
      paramsRef.current = next;
      setParams(next);
      reset();
    },
    [reset]
  );

  const circSpeed = circularOrbitSpeed(
    params.body1Mass,
    params.initialSeparation,
    params.gravitationalConstant,
    params.body2Mass
  );
  const presetSpeed = (pr: (typeof PRESETS)[number]) =>
    Math.round((pr.kind === 'circ' ? circSpeed : info.escapeSpeed) * pr.factor * 10) / 10;

  const idle = simState.status === 'idle';

  // ---- Scene -----------------------------------------------------------------------------------
  const draw: DrawFn = (ctx, width, height, time) => {
    const st = stateRef.current;
    const view = makeView(width, height, curve);
    const { toX, toY, scale } = view;
    const ox = toX(0);
    const oy = toY(0);

    fillGradient(ctx, width, height, '#070c1c', CANVAS_COLORS.bgDeep);
    drawStars(ctx, width, height, 90, time, 5);

    // Range rings around the COM, with distances
    ctx.save();
    ctx.font = MONO;
    const reach = Math.hypot(width, height) / scale;
    const ringStep = niceStep(Math.min(reach / 2, params.initialSeparation * 2.4), 4);
    ctx.lineWidth = 1;
    for (let r = ringStep; r * scale < Math.hypot(width, height); r += ringStep) {
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.16)';
      ctx.beginPath();
      ctx.arc(ox, oy, r * scale, 0, Math.PI * 2);
      ctx.stroke();
      const lx = ox + r * scale * Math.SQRT1_2;
      const ly = oy + r * scale * Math.SQRT1_2;
      if (lx < width - 28 && ly < height - 8) {
        ctx.fillStyle = 'rgba(100, 116, 139, 0.7)';
        ctx.textAlign = 'left';
        ctx.fillText(`${r} m`, lx + 3, ly + 3);
      }
    }
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.12)';
    ctx.beginPath();
    ctx.moveTo(0, oy);
    ctx.lineTo(width, oy);
    ctx.moveTo(ox, 0);
    ctx.lineTo(ox, height);
    ctx.stroke();
    ctx.restore();

    // Kepler reference orbit (dashed)
    if (curve.length > 1) {
      ctx.save();
      ctx.strokeStyle = 'rgba(167, 139, 250, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      curve.forEach((q, i) => {
        if (i === 0) ctx.moveTo(toX(q.x), toY(q.y));
        else ctx.lineTo(toX(q.x), toY(q.y));
      });
      ctx.stroke();
      ctx.restore();
    }

    // Periapsis / apoapsis markers
    if (info.bound && info.eccentricity > 0.02) {
      const omega = info.startsAtPeriapsis ? 0 : Math.PI;
      const markers: { label: string; r: number; dir: number; color: string; show: boolean }[] = [
        { label: 'periapsis', r: info.periapsis, dir: omega, color: '#fbbf24', show: true },
        { label: 'apoapsis', r: info.apoapsis, dir: omega + Math.PI, color: '#22d3ee', show: !clipped },
      ];
      ctx.font = MONO;
      for (const m of markers) {
        if (!m.show) continue;
        const mx = toX(f2 * m.r * Math.cos(m.dir));
        const my = toY(f2 * m.r * Math.sin(m.dir));
        glowDot(ctx, mx, my, 3.5, m.color, 6);
        const text = `${m.label} ${m.r.toFixed(0)} m`;
        const w = ctx.measureText(text).width + 12;
        const tx = clamp(mx - w / 2, 4, width - w - 4);
        const above = my > 50;
        drawTag(ctx, text, tx, above ? my - 16 : my + 16, { color: m.color, align: 'left' });
      }
    }

    // Trail with fading alpha
    const trail = st.body2.trail;
    if (trail.length > 1) {
      ctx.save();
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.2;
      const chunks = Math.min(36, trail.length - 1);
      const per = (trail.length - 1) / chunks;
      for (let c = 0; c < chunks; c++) {
        const a = Math.floor(c * per);
        const b = Math.min(trail.length - 1, Math.floor((c + 1) * per) + 1);
        ctx.globalAlpha = 0.06 + 0.94 * ((c + 1) / chunks) ** 1.5;
        ctx.beginPath();
        ctx.moveTo(toX(trail[a].x), toY(trail[a].y));
        for (let i = a + 1; i <= b; i++) ctx.lineTo(toX(trail[i].x), toY(trail[i].y));
        ctx.stroke();
      }
      ctx.restore();
    }

    // Star with pulsing corona
    const sx = toX(st.body1.position.x);
    const sy = toY(st.body1.position.y);
    const starR = clamp(st.body1.radius * scale, 9, 24);
    const pulse = 1 + 0.12 * Math.sin(time * 2.1) + 0.05 * Math.sin(time * 5.3);
    const corona = ctx.createRadialGradient(sx, sy, starR * 0.6, sx, sy, starR * 3.4 * pulse);
    corona.addColorStop(0, 'rgba(251, 191, 36, 0.55)');
    corona.addColorStop(0.35, 'rgba(245, 158, 11, 0.18)');
    corona.addColorStop(1, 'rgba(245, 158, 11, 0)');
    ctx.fillStyle = corona;
    ctx.beginPath();
    ctx.arc(sx, sy, starR * 3.4 * pulse, 0, Math.PI * 2);
    ctx.fill();
    const body = ctx.createRadialGradient(sx - starR * 0.3, sy - starR * 0.3, 1, sx, sy, starR);
    body.addColorStop(0, '#fff7d6');
    body.addColorStop(0.6, '#fbbf24');
    body.addColorStop(1, '#f59e0b');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(sx, sy, starR, 0, Math.PI * 2);
    ctx.fill();

    // Orbiting body with velocity and gravity arrows
    const bx = toX(st.body2.position.x);
    const by = toY(st.body2.position.y);
    const planetR = clamp(st.body2.radius * scale, 4, 8);

    const rp = Math.max(info.periapsis, 1);
    const vref = Math.max((params.initialSeparation * params.body2Speed) / rp, 1e-9);
    const vx = st.body2.velocity.x - st.body1.velocity.x;
    const vy = st.body2.velocity.y - st.body1.velocity.y;
    const vmag = Math.hypot(vx, vy);
    const collided = st.hasCollided;

    if (!collided && vmag > 1e-9) {
      const vLen = 16 + 46 * clamp(vmag / vref, 0, 1);
      const ex = bx + (vx / vmag) * vLen;
      const ey = by - (vy / vmag) * vLen;
      drawArrow(ctx, bx, by, ex, ey, '#fbbf24', { width: 2.2, head: 9 });
      ctx.font = MONO;
      const vTag = drawTag(ctx, 'v', ex + (vx / vmag) * 9 - 5, ey - (vy / vmag) * 9, {
        color: '#fbbf24',
        align: 'left',
        padX: 4,
      });
      void vTag;

      const dx = st.body1.position.x - st.body2.position.x;
      const dy = st.body1.position.y - st.body2.position.y;
      const dm = Math.hypot(dx, dy);
      if (dm > 1e-9) {
        const fLen = 14 + 40 * clamp(rp / dm, 0, 1);
        const gx = bx + (dx / dm) * fLen;
        const gy = by - (dy / dm) * fLen;
        drawArrow(ctx, bx, by, gx, gy, '#fb7185', { width: 2.2, head: 9 });
        drawTag(ctx, 'F', gx + (dx / dm) * 9 - 5, gy - (dy / dm) * 9, {
          color: '#fb7185',
          align: 'left',
          padX: 4,
        });
      }
    }

    if (collided) {
      const age = time - collidedAtRef.current;
      const t = clamp(age / 1.4, 0, 1);
      ctx.save();
      ctx.strokeStyle = `rgba(251, 113, 133, ${(0.8 * (1 - t)).toFixed(3)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(bx, by, 8 + t * 50, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      glowDot(ctx, bx, by, planetR + 2, '#fb7185', 14);
    } else {
      glowDot(ctx, bx, by, planetR, '#38bdf8', 10);
    }

    // Top-left status line
    if (idle) {
      drawTag(ctx, 'press Start  ·  dashed = Kepler orbit', 10, 16, {
        color: CANVAS_COLORS.text,
        font: '11px Inter, system-ui, sans-serif',
      });
    }
    if (!info.bound) {
      drawTag(ctx, 'ESCAPE TRAJECTORY', width - 10, 16, {
        color: '#fb7185',
        border: 'rgba(251, 113, 133, 0.5)',
        align: 'right',
      });
    } else if (clipped) {
      drawTag(ctx, 'wide orbit · view clipped', width - 10, 16, {
        color: '#fbbf24',
        align: 'right',
      });
    }
    drawTag(ctx, `1 m = ${scale.toFixed(2)} px`, width - 10, height - 12, {
      color: CANVAS_COLORS.axis,
      bg: 'rgba(7, 11, 20, 0.5)',
      align: 'right',
    });
  };

  // ---- Derived readouts ------------------------------------------------------------------------
  const vrelLive = Math.hypot(
    live.body2.velocity.x - live.body1.velocity.x,
    live.body2.velocity.y - live.body1.velocity.y
  );
  const denom = Math.max(Math.abs(e0Ref.current), 0.01 * eScaleRef.current, 1e-12);
  const drift = (Math.abs(live.totalEnergy - e0Ref.current) / denom) * 100;
  const elapsed = `${live.time.toFixed(1)} s / ${info.bound ? `${info.period.toFixed(1)} s` : '∞'}`;

  return (
    <LabLayout title="Gravity & Orbital Mechanics" category="Astrophysics">
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
          <div className="min-w-0 space-y-4 lg:col-span-2">
            <Panel
              title="Two-body space"
              icon={Orbit}
              accent="purple"
              flush
              right={
                <div className="hidden items-center gap-2 sm:flex">
                  <Badge accent="purple">Kepler</Badge>
                  <Badge accent="sky">Simulated</Badge>
                  <Badge accent="amber">v</Badge>
                  <Badge accent="rose">F</Badge>
                </div>
              }
              footer={
                <ReadoutBar
                  items={[
                    { label: 'Separation r', value: `${num(live.separation)} m`, accent: 'sky' },
                    { label: 'Speed |v|', value: `${num(vrelLive)} m/s`, accent: 'amber' },
                    { label: 'Kinetic K', value: `${num(live.kineticEnergy)} J`, accent: 'sky' },
                    { label: 'Potential U', value: `${num(live.potentialEnergy)} J`, accent: 'rose' },
                    { label: 'Total E', value: `${num(live.totalEnergy)} J`, accent: 'emerald' },
                    { label: 'Ang. mom. L', value: num(live.angularMomentum, 0), accent: 'purple' },
                    { label: 'Elapsed / period', value: elapsed },
                    {
                      label: 'Energy drift',
                      value: `${drift.toFixed(4)} %`,
                      accent: drift < 0.1 ? 'emerald' : 'amber',
                    },
                  ]}
                />
              }
            >
              <SimCanvas
                height={CANVAS_HEIGHT}
                draw={draw}
                animate
                ariaLabel="Two-body orbit with Kepler reference ellipse"
              />
              <div className="flex flex-wrap items-center gap-2 border-t border-slate-800/80 bg-slate-950/40 px-4 py-2.5">
                {live.hasCollided ? (
                  <Badge accent="rose">Collision at t = {live.time.toFixed(2)} s</Badge>
                ) : (
                  <Badge accent={info.bound ? 'emerald' : 'rose'}>{info.bound ? 'Bound' : 'Unbound'}</Badge>
                )}
                <Badge accent="purple">{kind}</Badge>
                <Badge accent="sky">e = {info.eccentricity.toFixed(3)}</Badge>
                <Badge accent="amber">
                  T = {info.bound ? `${info.period.toFixed(1)} s` : '∞'}
                </Badge>
                <span className="font-mono text-[11px] text-slate-500">
                  v_circ {circSpeed.toFixed(1)} · v_esc {info.escapeSpeed.toFixed(1)} m/s
                </span>
              </div>
            </Panel>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <PhysicsChart
                data={telemetry.data}
                title="Energy (K, U, E vs t)"
                xLabel="Time (s)"
                series={[
                  { key: 'kinetic', name: 'Kinetic K', color: '#38bdf8', unit: 'J' },
                  { key: 'potential', name: 'Potential U', color: '#f43f5e', unit: 'J' },
                  { key: 'total', name: 'Total E', color: '#34d399', unit: 'J' },
                ]}
                referenceY={0}
                exportFilename="orbital-energy.csv"
              />
              <PhysicsChart
                data={telemetry.data}
                title="Distance & angular momentum"
                xLabel="Time (s)"
                series={[
                  { key: 'separation', name: 'Separation r', color: '#a855f7', unit: 'm' },
                  { key: 'angularMomentum', name: 'Ang. mom. L', color: '#eab308', unit: 'kg·m²/s', axis: 'right' },
                ]}
                exportFilename="orbital-momentum.csv"
              />
            </div>
          </div>

          <div className="min-w-0 space-y-5">
            <Panel title="Orbital setup" icon={Sliders} accent="purple">
              <Slider
                label="Central star mass (M)"
                value={params.body1Mass}
                min={2e15}
                max={2e16}
                step={1e15}
                accent="amber"
                format={(v) => `${v.toExponential(1)} kg`}
                onChange={(v) => update({ body1Mass: v })}
              />
              <Slider
                label="Initial radius (r₀)"
                value={params.initialSeparation}
                min={80}
                max={280}
                step={5}
                unit="m"
                accent="sky"
                onChange={(v) => update({ initialSeparation: v })}
              />
              <Slider
                label="Tangential speed (v₀)"
                value={params.body2Speed}
                min={10}
                max={160}
                step={0.1}
                accent="purple"
                format={(v) => `${v.toFixed(1)} m/s`}
                onChange={(v) => update({ body2Speed: v })}
                hint={`Circular ${circSpeed.toFixed(1)} · escape ${info.escapeSpeed.toFixed(1)} m/s at this radius`}
              />

              <div className="space-y-2 border-t border-slate-800/80 pt-3">
                <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Presets</div>
                <div className="flex flex-wrap gap-1.5">
                  {PRESETS.map((pr) => {
                    const v = presetSpeed(pr);
                    const active = Math.abs(params.body2Speed - v) < 0.05;
                    return (
                      <button
                        key={pr.name}
                        onClick={() => update({ body2Speed: clamp(v, 10, 160) })}
                        className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                          active
                            ? 'border-purple-400/50 bg-purple-500/15 text-purple-300'
                            : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                        }`}
                      >
                        {pr.name}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => update({ body2Speed: Math.round(circSpeed * 10) / 10 })}
                  className="w-full rounded-lg border border-sky-500/20 bg-sky-500/10 px-2.5 py-1.5 font-mono text-xs text-sky-300 transition-all hover:bg-sky-500/20"
                >
                  Set circular velocity (v = √(GM/r))
                </button>
              </div>
            </Panel>

            <Panel title="Orbit analysis" icon={Activity} accent="emerald">
              <div className="overflow-hidden rounded-lg border border-slate-800">
                <table className="w-full text-left text-xs">
                  <tbody className="divide-y divide-slate-800/80 font-mono">
                    {[
                      ['Type', kind],
                      ['Eccentricity e', info.eccentricity.toFixed(4)],
                      ['Periapsis', `${info.periapsis.toFixed(1)} m`],
                      ['Apoapsis', info.bound ? `${info.apoapsis.toFixed(1)} m` : '∞'],
                      ['Period T', info.bound ? `${info.period.toFixed(2)} s` : '∞'],
                    ].map(([k, v]) => (
                      <tr key={k}>
                        <td className="px-3 py-2 font-sans text-slate-400">{k}</td>
                        <td className="px-3 py-2 text-right text-emerald-300">{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500">
                The dashed curve is the closed-form Kepler orbit; Velocity Verlet is symplectic, so the
                simulated path stays on it and the energy drift stays tiny.
              </p>
            </Panel>

            <Panel title="Gravitational laws" icon={Info} accent="indigo">
              <FormulaList
                formulas={[
                  'F = G \\frac{M m}{r^2}',
                  'v_{\\text{circ}} = \\sqrt{\\frac{G M}{r}}, \\quad v_{\\text{esc}} = \\sqrt{\\frac{2 G M}{r}}',
                  'E = \\tfrac{1}{2} m v^2 - \\frac{G M m}{r} = \\text{const}',
                  'r(\\theta) = \\frac{p}{1 + e\\cos\\theta}, \\quad T = 2\\pi\\sqrt{\\frac{a^3}{GM}}',
                ]}
              />
            </Panel>
          </div>
        </div>
      </div>
    </LabLayout>
  );
};
