import React, { useCallback, useRef, useState } from 'react';
import { Sliders, Target, Info } from 'lucide-react';
import { LabLayout } from '../../components/layout/LabLayout';
import { SimulationControls } from '../../components/controls/SimulationControls';
import { PhysicsChart } from '../../components/charts/PhysicsChart';
import { SimCanvas, type DrawFn } from '../../components/canvas/SimCanvas';
import { drawArrow, drawTag, fillGradient, glowDot, niceTicks } from '../../components/canvas/draw';
import { FormulaList, Panel, ReadoutBar } from '../../components/ui/Panel';
import { Slider } from '../../components/ui/Slider';
import { CANVAS_COLORS } from '../../components/ui/theme';
import { useSimulation } from '../../hooks/useSimulation';
import { useTelemetry } from '../../hooks/useTelemetry';
import {
  getProjectileState,
  calculateAnalyticalSummary,
  DEFAULT_PROJECTILE_PARAMS,
  type ProjectileParams,
} from '../../physics/mechanics/projectile-motion';

const CANVAS_HEIGHT = 400;
const DT = 1 / 60;

export const ProjectileMotionPage: React.FC = () => {
  const [params, setParams] = useState<ProjectileParams>(DEFAULT_PROJECTILE_PARAMS);
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const [liveTime, setLiveTime] = useState(0);
  const telemetry = useTelemetry(1500, 4);

  const summary = calculateAnalyticalSummary(params);

  const { state: simState, play, pause, reset, step, setSpeed, finish } = useSimulation({
    dt: DT,
    onStep: (dt) => {
      const p = paramsRef.current;
      const sum = calculateAnalyticalSummary(p);
      const nextTime = liveTime + dt;

      if (nextTime >= sum.timeOfFlight && sum.timeOfFlight > 0) {
        const finalT = sum.timeOfFlight;
        setLiveTime(finalT);
        const finalState = getProjectileState(finalT, p);
        telemetry.push({
          time: finalT,
          x: finalState.position.x,
          y: Math.max(0, finalState.position.y),
          speed: finalState.speed,
          vx: finalState.velocity.x,
          vy: finalState.velocity.y,
        });
        finish();
        return;
      }

      setLiveTime(nextTime);
      const state = getProjectileState(nextTime, p);
      telemetry.push({
        time: nextTime,
        x: state.position.x,
        y: Math.max(0, state.position.y),
        speed: state.speed,
        vx: state.velocity.x,
        vy: state.velocity.y,
      });
    },
    onReset: () => {
      setLiveTime(0);
      telemetry.clear();
    },
  });

  const updateParam = useCallback(
    (patch: Partial<ProjectileParams>) => {
      setParams((prev) => {
        const next = { ...prev, ...patch };
        paramsRef.current = next;
        return next;
      });
      reset();
    },
    [reset]
  );

  const updatePosy = useCallback(
    (y0: number) => {
      updateParam({ initialPosition: { x: params.initialPosition.x, y: y0 } });
    },
    [updateParam, params.initialPosition.x]
  );

  const currentState = getProjectileState(liveTime, params);

  const draw: DrawFn = (ctx, width, height) => {
    fillGradient(ctx, width, height, '#070b14', CANVAS_COLORS.bgDeep);

    const marginX = 60;
    const marginY = 50;

    const maxDimX = Math.max(summary.range * 1.1, 15);
    const maxDimY = Math.max(summary.maxHeight * 1.2, 10);

    const scaleX = (width - marginX - 30) / maxDimX;
    const scaleY = (height - marginY - 30) / maxDimY;
    const scale = Math.min(scaleX, scaleY);

    const originX = marginX;
    const originY = height - marginY;

    // Ground line & shading
    ctx.fillStyle = 'rgba(30, 41, 59, 0.4)';
    ctx.fillRect(0, originY, width, height - originY);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, originY);
    ctx.lineTo(width, originY);
    ctx.stroke();

    // Grid / Axes
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;

    const xTicks = niceTicks(0, maxDimX, 6);
    const yTicks = niceTicks(0, maxDimY, 5);

    xTicks.forEach((x) => {
      const sx = originX + x * scale;
      if (sx >= 0 && sx <= width) {
        ctx.beginPath();
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx, originY);
        ctx.stroke();
        ctx.fillStyle = '#64748b';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${x}m`, sx, originY + 16);
      }
    });

    yTicks.forEach((y) => {
      const sy = originY - y * scale;
      if (sy >= 0 && sy <= originY) {
        ctx.beginPath();
        ctx.moveTo(originX, sy);
        ctx.lineTo(width, sy);
        ctx.stroke();
        ctx.fillStyle = '#64748b';
        ctx.font = '10px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`${y}m`, originX - 8, sy + 4);
      }
    });

    // Trajectory Path (Analytical Ghost Parabola)
    if (summary.timeOfFlight > 0 && summary.timeOfFlight !== Infinity) {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      const steps = 80;
      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * summary.timeOfFlight;
        const pt = getProjectileState(t, params).position;
        const sx = originX + pt.x * scale;
        const sy = originY - pt.y * scale;
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Key markers: Max Height & Range
    if (summary.maxHeight > 0 && summary.maxHeight !== Infinity) {
      const angleRad = (params.launchAngleDeg * Math.PI) / 180;
      const v0y = params.initialSpeed * Math.sin(angleRad);
      const tApex = v0y / params.gravity;
      const apexPos = getProjectileState(tApex, params).position;
      const apexX = originX + apexPos.x * scale;
      const apexY = originY - summary.maxHeight * scale;

      ctx.strokeStyle = 'rgba(251, 191, 36, 0.4)';
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(apexX, originY);
      ctx.lineTo(apexX, apexY);
      ctx.stroke();
      ctx.setLineDash([]);

      drawTag(ctx, `h_max = ${summary.maxHeight.toFixed(1)}m`, apexX, apexY - 10, { color: '#fbbf24' });
    }

    if (summary.range > 0 && summary.range !== Infinity) {
      const rX = originX + summary.range * scale;
      glowDot(ctx, rX, originY, 4, '#f43f5e', 6);
      drawTag(ctx, `R = ${summary.range.toFixed(1)}m`, rX, originY + 28, { color: '#f43f5e' });
    }

    // Current Projectile Position & Vectors
    const currX = originX + currentState.position.x * scale;
    const currY = originY + Math.max(0, currentState.position.y) * scale * -1;

    // Velocity Vector
    const vScale = 0.4;
    const vEndX = currX + currentState.velocity.x * scale * vScale;
    const vEndY = currY - currentState.velocity.y * scale * vScale;
    drawArrow(ctx, currX, currY, vEndX, vEndY, '#10b981', { width: 3, head: 10 });

    // Projectile dot
    glowDot(ctx, currX, currY, 7, '#38bdf8', 12);
    drawTag(
      ctx,
      `v = ${currentState.speed.toFixed(1)} m/s`,
      currX + 10,
      currY - 14,
      { color: '#38bdf8' }
    );
  };

  return (
    <LabLayout title="Projectile Motion" category="Classical Mechanics">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <Panel title="2D Trajectory Simulation" icon={Target}>
            <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
              <SimCanvas height={CANVAS_HEIGHT} draw={draw} ariaLabel="Projectile motion simulation" />
            </div>

            <div className="mt-4">
              <SimulationControls
                state={simState}
                onPlay={play}
                onPause={pause}
                onReset={reset}
                onStep={step}
                onSpeedChange={setSpeed}
              />
            </div>
          </Panel>

          <ReadoutBar
            items={[
              { label: 'Time', value: `${liveTime.toFixed(2)} s`, accent: 'sky' },
              {
                label: 'Position (x, y)',
                value: `(${currentState.position.x.toFixed(1)}, ${Math.max(0, currentState.position.y).toFixed(1)}) m`,
                accent: 'emerald',
              },
              {
                label: 'Velocity (vx, vy)',
                value: `(${currentState.velocity.x.toFixed(1)}, ${currentState.velocity.y.toFixed(1)}) m/s`,
                accent: 'amber',
              },
              { label: 'Max Height', value: `${summary.maxHeight.toFixed(2)} m`, accent: 'purple' },
              { label: 'Range', value: `${summary.range.toFixed(2)} m`, accent: 'rose' },
              { label: 'Time of Flight', value: `${summary.timeOfFlight.toFixed(2)} s` },
            ]}
          />

          <PhysicsChart
            data={telemetry.data}
            title="Kinematic Telemetry (Position & Velocity)"
            series={[
              { key: 'x', name: 'x (m)', color: '#38bdf8', unit: 'm' },
              { key: 'y', name: 'y (m)', color: '#10b981', unit: 'm' },
              { key: 'speed', name: 'Speed', color: '#fbbf24', unit: 'm/s', dashed: true },
              { key: 'vy', name: 'v_y', color: '#f43f5e', unit: 'm/s', dashed: true },
            ]}
            xLabel="Time (s)"
          />
        </div>

        <div className="lg:col-span-4 space-y-6">
          <Panel title="Launch Parameters" icon={Sliders}>
            <div className="space-y-5">
              <Slider
                label="Launch Speed (v₀)"
                value={params.initialSpeed}
                min={5}
                max={50}
                step={1}
                unit="m/s"
                onChange={(v) => updateParam({ initialSpeed: v })}
                accent="emerald"
              />
              <Slider
                label="Launch Angle (θ)"
                value={params.launchAngleDeg}
                min={0}
                max={90}
                step={1}
                unit="°"
                onChange={(v) => updateParam({ launchAngleDeg: v })}
                accent="sky"
              />
              <Slider
                label="Initial Height (y₀)"
                value={params.initialPosition.y}
                min={0}
                max={20}
                step={1}
                unit="m"
                onChange={updatePosy}
                accent="purple"
              />
              <Slider
                label="Gravity (g)"
                value={params.gravity}
                min={1}
                max={25}
                step={0.1}
                unit="m/s²"
                onChange={(v) => updateParam({ gravity: v })}
                accent="amber"
              />
            </div>
          </Panel>

          <Panel title="Governing Equations" icon={Info}>
            <FormulaList
              formulas={[
                'v_{0x} = v_0 \\cos\\theta, \\quad v_{0y} = v_0 \\sin\\theta',
                'x(t) = x_0 + v_{0x} t',
                'y(t) = y_0 + v_{0y} t - \\frac{1}{2} g t^2',
                't_{\\text{flight}} = \\frac{v_{0y} + \\sqrt{v_{0y}^2 + 2g y_0}}{g}',
              ]}
            />
            <div className="mt-4 text-xs text-slate-400 space-y-3">
              <p>
                <strong className="text-emerald-400">Horizontal motion</strong> occurs at constant velocity (zero acceleration assuming no drag).
              </p>
              <p>
                <strong className="text-emerald-400">Vertical motion</strong> is subject to constant gravitational acceleration <em className="text-amber-400">g</em> directed downwards.
              </p>
              <p className="p-2 bg-slate-900/50 rounded border border-slate-800">
                Max range for level ground (y₀ = 0) occurs at a launch angle of <span className="text-sky-400 font-mono">45°</span>.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </LabLayout>
  );
};

export default ProjectileMotionPage;
