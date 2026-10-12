import React, { useCallback, useRef, useState } from 'react';
import { Sliders, Scale, Info, Gauge } from 'lucide-react';
import { LabLayout } from '../../components/layout/LabLayout';
import { SimulationControls } from '../../components/controls/SimulationControls';
import { PhysicsChart } from '../../components/charts/PhysicsChart';
import { SimCanvas } from '../../components/canvas/SimCanvas';
import type { DrawFn } from '../../components/canvas/SimCanvas';
import { MONO, clamp, drawArrow, drawStars, drawTag, fillGradient } from '../../components/canvas/draw';
import { Badge, FormulaList, Panel, ReadoutBar } from '../../components/ui/Panel';
import { Slider } from '../../components/ui/Slider';
import { CANVAS_COLORS } from '../../components/ui/theme';
import { useSimulation } from '../../hooks/useSimulation';
import { useTelemetry } from '../../hooks/useTelemetry';
import { DEG_TO_RAD } from '../../physics/constants';
import {
  DEFAULT_FORCES_PARAMS,
  calculateForces,
  createInitialForcesState,
  stepForces,
} from '../../physics/mechanics/forces';
import type { ForcesParams, ForcesState } from '../../physics/mechanics/forces';

const CANVAS_HEIGHT = 380;
/** World scale of the moving ground: pixels per metre. */
const PX_PER_M = 46;

export const ForcesPage: React.FC = () => {
  const [params, setParams] = useState<ForcesParams>(DEFAULT_FORCES_PARAMS);
  const paramsRef = useRef(params);
  const stateRef = useRef<ForcesState>(createInitialForcesState(params));
  const [live, setLive] = useState<ForcesState>(stateRef.current);
  const telemetry = useTelemetry(1500, 4);

  const forces = calculateForces(params, live.velocity);

  const { state: simState, play, pause, reset, step, setSpeed } = useSimulation({
    dt: 1 / 120,
    onStep: () => {
      const p = paramsRef.current;
      const next = stepForces(stateRef.current, p, 1 / 120);
      stateRef.current = next;
      const f = calculateForces(p, next.velocity);
      telemetry.push({
        time: next.time,
        position: next.position,
        velocity: next.velocity,
        acceleration: next.acceleration,
        applied: f.applied.x,
        friction: f.friction,
        net: f.net.x,
      });
      setLive(next);
    },
    onReset: () => {
      const init = createInitialForcesState(paramsRef.current);
      stateRef.current = init;
      telemetry.clear();
      setLive(init);
    },
  });

  /** Any parameter change restarts the run so the picture never mixes two experiments. */
  const update = useCallback(
    (patch: Partial<ForcesParams>) => {
      const next = { ...paramsRef.current, ...patch };
      paramsRef.current = next;
      setParams(next);
      reset();
    },
    [reset]
  );

  const maxStatic = params.frictionCoeffStatic * forces.normal;
  const pull = Math.abs(forces.applied.x);
  const breakaway = maxStatic > 0 ? pull / maxStatic : pull > 0 ? Infinity : 0;

  const draw: DrawFn = (ctx, width, height) => {
    const groundY = Math.round(height * 0.66);
    const bw = 84;
    const bh = 58;
    // The block stays put on screen and the world scrolls underneath it.
    const cx = Math.round(width * 0.42);
    const blockTop = groundY - bh;
    const cy = blockTop + bh / 2;
    const pos = live.position;

    fillGradient(ctx, width, height, '#0a1124', CANVAS_COLORS.bgDeep);
    drawStars(ctx, width, groundY, 50, 0, 3);

    // Ground with a ruler that scrolls with the block's position
    const floor = ctx.createLinearGradient(0, groundY, 0, height);
    floor.addColorStop(0, '#16222f');
    floor.addColorStop(1, '#0b121b');
    ctx.fillStyle = floor;
    ctx.fillRect(0, groundY, width, height - groundY);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(width, groundY);
    ctx.stroke();

    ctx.font = MONO;
    ctx.textAlign = 'center';
    const firstM = Math.floor(pos - cx / PX_PER_M) - 1;
    const lastM = Math.ceil(pos + (width - cx) / PX_PER_M) + 1;
    for (let m = firstM; m <= lastM; m++) {
      const x = cx + (m - pos) * PX_PER_M;
      const major = m % 5 === 0;
      ctx.strokeStyle = major ? '#64748b' : '#334155';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, groundY);
      ctx.lineTo(x, groundY + (major ? 14 : 7));
      ctx.stroke();
      if (major) {
        ctx.fillStyle = CANVAS_COLORS.text;
        ctx.fillText(`${m} m`, x, groundY + 28);
      }
    }
    // Start marker
    const startX = cx - pos * PX_PER_M;
    if (startX > -20 && startX < width + 20) {
      ctx.strokeStyle = 'rgba(52, 211, 153, 0.6)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(startX, groundY - 34);
      ctx.lineTo(startX, groundY);
      ctx.stroke();
      ctx.setLineDash([]);
      drawTag(ctx, 'start', startX, groundY - 34, { color: '#34d399', align: 'center', baseline: 'bottom' });
    }

    // Surface texture proportional to friction (rougher = denser hatch)
    const rough = clamp(params.frictionCoeffKinetic, 0, 0.8);
    ctx.strokeStyle = `rgba(148, 163, 184, ${(0.1 + rough * 0.3).toFixed(2)})`;
    ctx.lineWidth = 1;
    const hatch = 26 - rough * 18;
    const shift = ((-pos * PX_PER_M) % hatch + hatch) % hatch;
    for (let x = -hatch + shift; x < width; x += hatch) {
      ctx.beginPath();
      ctx.moveTo(x, groundY + 40);
      ctx.lineTo(x - 8, groundY + 54);
      ctx.stroke();
    }

    // Block (squashes slightly under heavy load, shows motion with a lean)
    const lean = clamp(live.acceleration * 0.6, -6, 6);
    ctx.save();
    ctx.translate(cx, groundY);
    ctx.transform(1, 0, -lean * 0.01, 1, 0, 0);
    ctx.translate(-cx, -groundY);
    const body = ctx.createLinearGradient(0, blockTop, 0, groundY);
    body.addColorStop(0, '#26364d');
    body.addColorStop(1, '#162133');
    ctx.fillStyle = body;
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.roundRect(cx - bw / 2, blockTop, bw, bh, 7);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '600 13px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${params.mass} kg`, cx, cy);

    // Motion lines behind a moving block
    const speed = Math.abs(live.velocity);
    if (speed > 0.2) {
      const dir = Math.sign(live.velocity);
      ctx.strokeStyle = `rgba(148, 163, 184, ${clamp(speed / 10, 0.1, 0.5).toFixed(2)})`;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const y = blockTop + 12 + i * 17;
        const len = clamp(speed * 5, 8, 46) * (1 - i * 0.15);
        ctx.beginPath();
        ctx.moveTo(cx - dir * (bw / 2 + 8), y);
        ctx.lineTo(cx - dir * (bw / 2 + 8 + len), y);
        ctx.stroke();
      }
    }

    // ----- Force vectors, all on one scale so lengths can be compared honestly -----
    const biggest = Math.max(Math.abs(params.appliedForce), forces.gravity, forces.normal, 1);
    const k = Math.min(1.1, 100 / biggest);
    const rad = params.appliedAngle * DEG_TO_RAD;
    const fx = forces.applied.x * k;
    const fy = -forces.applied.y * k;

    // Applied force (from the block's side so it never hides the label)
    const side = fx >= 0 ? 1 : -1;
    const ax = cx + side * (bw / 2);
    drawArrow(ctx, ax, cy, ax + fx, cy + fy, '#10b981', { width: 3.5, head: 11 });
    if (Math.hypot(fx, fy) > 2) {
      const tipRight = fx >= 0;
      drawTag(ctx, `F = ${params.appliedForce} N`, ax + fx + (tipRight ? 8 : -8), cy + fy - (fy < -4 ? 8 : 0), {
        color: '#34d399',
        align: tipRight ? 'left' : 'right',
      });
      if (params.appliedAngle !== 0) {
        ctx.strokeStyle = 'rgba(52, 211, 153, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        const s = Math.sign(params.appliedForce) || 1;
        ctx.arc(ax, cy, 30, s > 0 ? -rad : Math.PI, s > 0 ? 0 : Math.PI + rad);
        ctx.stroke();
      }
    }

    // Normal force (up, from the top face)
    const nLen = forces.normal * k;
    drawArrow(ctx, cx - 18, blockTop, cx - 18, blockTop - nLen, '#38bdf8', { width: 3, head: 10 });
    drawTag(ctx, `N = ${forces.normal.toFixed(1)} N`, cx - 26, blockTop - nLen / 2, {
      color: '#38bdf8',
      align: 'right',
    });

    // Weight (down, from the centre of mass)
    const wLen = forces.gravity * k;
    drawArrow(ctx, cx + 18, cy, cx + 18, cy + wLen, '#a855f7', { width: 3, head: 10 });
    drawTag(ctx, `W = mg = ${forces.gravity.toFixed(1)} N`, cx + 26, cy + wLen - 4, {
      color: '#c084fc',
      align: 'left',
    });

    // Friction (at the contact patch, just above the ground line)
    const frLen = forces.friction * k;
    if (Math.abs(frLen) > 1) {
      const fyPos = groundY - 7;
      drawArrow(ctx, cx, fyPos, cx + frLen, fyPos, '#f43f5e', { width: 3.5, head: 11 });
      const kind = forces.frictionType === 'static' ? 'fₛ' : 'f_k';
      drawTag(ctx, `${kind} = ${Math.abs(forces.friction).toFixed(1)} N`, cx + frLen / 2, groundY + 50, {
        color: '#fb7185',
        align: 'center',
      });
    }

    // Net force / velocity indicator above the scene
    if (Math.abs(forces.net.x) > 1e-6) {
      const nx = forces.net.x * k;
      drawArrow(ctx, cx, blockTop - nLen - 26, cx + nx, blockTop - nLen - 26, '#fbbf24', { width: 3, head: 10 });
      drawTag(ctx, `F_net = ${forces.net.x.toFixed(2)} N`, cx + (nx >= 0 ? 8 : -8) + nx, blockTop - nLen - 26, {
        color: '#fbbf24',
        align: nx >= 0 ? 'left' : 'right',
      });
    }

    drawTag(ctx, `v = ${live.velocity.toFixed(2)} m/s`, width - 12, 16, {
      color: '#fbbf24',
      align: 'right',
      baseline: 'top',
    });
  };

  const frictionAccent = forces.frictionType === 'static' ? 'emerald' : forces.frictionType === 'kinetic' ? 'rose' : 'sky';
  const frictionLabel =
    forces.frictionType === 'static' ? 'Static — block holds' : forces.frictionType === 'kinetic' ? 'Kinetic — sliding' : 'No friction';

  return (
    <LabLayout title="Newton's Laws & Friction Laboratory" category="Classical Mechanics">
      <div className="space-y-6">
        <SimulationControls
          state={simState}
          onPlay={play}
          onPause={pause}
          onReset={reset}
          onStep={step}
          onSpeedChange={setSpeed}
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Panel
              title="Free-body diagram & motion"
              icon={Scale}
              accent="emerald"
              flush
              right={<Badge accent={frictionAccent}>{frictionLabel}</Badge>}
              footer={
                <ReadoutBar
                  items={[
                    { label: 'Net force', value: `${forces.net.x.toFixed(2)} N`, accent: 'amber' },
                    { label: 'Acceleration', value: `${live.acceleration.toFixed(2)} m/s²`, accent: 'sky' },
                    { label: 'Velocity', value: `${live.velocity.toFixed(2)} m/s`, accent: 'amber' },
                    { label: 'Position', value: `${live.position.toFixed(2)} m` },
                  ]}
                />
              }
            >
              <SimCanvas height={CANVAS_HEIGHT} draw={draw} ariaLabel="Block on a rough surface with force vectors" />
            </Panel>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <PhysicsChart
                data={telemetry.data}
                title="Kinematics (v and a vs t)"
                xLabel="Time (s)"
                series={[
                  { key: 'velocity', name: 'Velocity', color: '#eab308', unit: 'm/s' },
                  { key: 'acceleration', name: 'Acceleration', color: '#38bdf8', unit: 'm/s²' },
                ]}
                referenceY={0}
                exportFilename="forces-kinematics.csv"
              />
              <PhysicsChart
                data={telemetry.data}
                title="Displacement (x vs t)"
                xLabel="Time (s)"
                series={[{ key: 'position', name: 'Position', color: '#10b981', unit: 'm' }]}
                exportFilename="forces-displacement.csv"
              />
            </div>
            <PhysicsChart
              data={telemetry.data}
              title="Horizontal forces vs time"
              xLabel="Time (s)"
              series={[
                { key: 'applied', name: 'Applied Fₓ', color: '#10b981', unit: 'N' },
                { key: 'friction', name: 'Friction', color: '#f43f5e', unit: 'N' },
                { key: 'net', name: 'Net', color: '#fbbf24', unit: 'N', dashed: true },
              ]}
              referenceY={0}
              exportFilename="forces-horizontal.csv"
            />
          </div>

          <div className="space-y-5">
            <Panel title="Dynamics parameters" icon={Sliders} accent="emerald">
              <Slider label="Block mass (m)" value={params.mass} min={1} max={50} step={0.5} unit="kg" accent="emerald" onChange={(v) => update({ mass: v })} />
              <Slider label="Applied force (F)" value={params.appliedForce} min={-60} max={100} unit="N" accent="sky" onChange={(v) => update({ appliedForce: v })} />
              <Slider
                label="Push angle (θ above horizontal)"
                value={params.appliedAngle}
                min={0}
                max={60}
                unit="°"
                accent="cyan"
                onChange={(v) => update({ appliedAngle: v })}
                hint="Angling the push upward lifts the block and reduces N."
              />
              <Slider label="Static friction (μₛ)" value={params.frictionCoeffStatic} min={0} max={1} step={0.05} accent="rose" format={(v) => v.toFixed(2)} onChange={(v) => update({ frictionCoeffStatic: Math.max(v, params.frictionCoeffKinetic) })} />
              <Slider label="Kinetic friction (μₖ)" value={params.frictionCoeffKinetic} min={0} max={0.8} step={0.05} accent="amber" format={(v) => v.toFixed(2)} onChange={(v) => update({ frictionCoeffKinetic: v, frictionCoeffStatic: Math.max(params.frictionCoeffStatic, v) })} />
              <Slider label="Initial velocity (v₀)" value={params.initialVelocity} min={-10} max={10} step={0.5} unit="m/s" accent="purple" onChange={(v) => update({ initialVelocity: v })} />
            </Panel>

            <Panel title="Breakaway meter" icon={Gauge} accent="rose">
              <div className="space-y-2">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-slate-400">|Fₓ| vs max static friction μₛN</span>
                  <span className="font-mono font-semibold text-slate-200">
                    {pull.toFixed(1)} / {maxStatic.toFixed(1)} N
                  </span>
                </div>
                <div className="relative h-3 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className={`h-full rounded-full transition-all duration-150 ${breakaway > 1 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                    style={{ width: `${clamp(breakaway, 0, 1.5) / 1.5 * 100}%` }}
                  />
                  <div className="absolute inset-y-0 w-0.5 bg-white/70" style={{ left: `${(1 / 1.5) * 100}%` }} />
                </div>
                <p className="text-[11px] text-slate-500">
                  {breakaway > 1
                    ? 'The push beats static friction — the block breaks away and kinetic friction takes over.'
                    : 'Below the white mark friction can balance the push exactly, so the block stays put.'}
                </p>
              </div>
            </Panel>

            <Panel title="Force balance equations" icon={Info} accent="sky">
              <FormulaList
                formulas={[
                  '\\sum F_x = F\\cos\\theta - f = m a',
                  'N = m g - F \\sin\\theta',
                  'f_s \\le \\mu_s N, \\qquad f_k = \\mu_k N',
                ]}
              />
            </Panel>
          </div>
        </div>
      </div>
    </LabLayout>
  );
};
