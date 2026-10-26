import React, { useCallback, useRef, useState } from 'react';
import { Sliders, Gauge, Info } from 'lucide-react';
import { LabLayout } from '../../components/layout/LabLayout';
import { SimulationControls } from '../../components/controls/SimulationControls';
import { PhysicsChart } from '../../components/charts/PhysicsChart';
import { SimCanvas } from '../../components/canvas/SimCanvas';
import type { DrawFn } from '../../components/canvas/SimCanvas';
import { drawArrow, drawTag, fillGradient, glowDot, niceTicks } from '../../components/canvas/draw';
import { FormulaList, Panel, ReadoutBar } from '../../components/ui/Panel';
import { Slider } from '../../components/ui/Slider';
import { CANVAS_COLORS } from '../../components/ui/theme';
import { useSimulation } from '../../hooks/useSimulation';
import { useTelemetry } from '../../hooks/useTelemetry';
import {
  getUniformLinearState,
  DEFAULT_UNIFORM_LINEAR_PARAMS,
  type UniformLinearParams,
} from '../../physics/mechanics/uniform-linear-motion';

const CANVAS_HEIGHT = 400;
const PX_PER_M = 30;
const DT = 1 / 60;

export const UniformLinearMotionPage: React.FC = () => {
  const [params, setParams] = useState<UniformLinearParams>(DEFAULT_UNIFORM_LINEAR_PARAMS);
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const [liveTime, setLiveTime] = useState(0);

  const telemetry = useTelemetry(1500, 4);

  const { state: simState, play, pause, reset, step, setSpeed } = useSimulation({
    dt: DT,
    onStep: (dt) => {
      const t = liveTime + dt;
      setLiveTime(t);

      const state = getUniformLinearState(t, paramsRef.current);

      telemetry.push({
        time: t,
        x: state.position.x,
        y: state.position.y,
        distance: state.distanceTraveled,
      });
    },
    onReset: () => {
      setLiveTime(0);
      telemetry.clear();
    },
  });

  const updateParam = useCallback((patch: Partial<UniformLinearParams>) => {
    setParams((prev) => {
      const next = { ...prev, ...patch };
      paramsRef.current = next;
      return next;
    });
    reset();
  }, [reset]);

  const currentState = getUniformLinearState(liveTime, params);

  const draw: DrawFn = (ctx, width, height) => {
    const originX = width / 2;
    const originY = height / 2;

    fillGradient(ctx, width, height, '#070b14', CANVAS_COLORS.bgDeep);

    // Grid
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    const xTicks = niceTicks(-width / (2 * PX_PER_M), width / (2 * PX_PER_M), 10);
    const yTicks = niceTicks(-height / (2 * PX_PER_M), height / (2 * PX_PER_M), 8);

    xTicks.forEach((x) => {
      const sx = originX + x * PX_PER_M;
      ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, height); ctx.stroke();
    });
    yTicks.forEach((y) => {
      const sy = originY - y * PX_PER_M;
      ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(width, sy); ctx.stroke();
    });

    // Axes
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, originY); ctx.lineTo(width, originY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(originX, 0); ctx.lineTo(originX, height); ctx.stroke();

    // Trajectory Path (Straight line prediction)
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    for (let t = 0; t <= 10; t += 0.5) {
      const p = getUniformLinearState(t, params).position;
      const sx = originX + p.x * PX_PER_M;
      const sy = originY - p.y * PX_PER_M;
      if (t === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Initial Position Marker
    const startX = originX + params.initialPosition.x * PX_PER_M;
    const startY = originY - params.initialPosition.y * PX_PER_M;
    glowDot(ctx, startX, startY, 4, '#a855f7', 6);

    // Displacement Vector
    const currX = originX + currentState.position.x * PX_PER_M;
    const currY = originY - currentState.position.y * PX_PER_M;

    if (liveTime > 0) {
      drawArrow(ctx, startX, startY, currX, currY, 'rgba(251, 191, 36, 0.4)', { width: 2, head: 8 });
    }

    // Velocity Vector
    const vScale = 0.5; // Scale velocity for visual clarity
    const vEndX = currX + currentState.velocity.x * PX_PER_M * vScale;
    const vEndY = currY - currentState.velocity.y * PX_PER_M * vScale;
    if (currentState.velocity.x !== 0 || currentState.velocity.y !== 0) {
      drawArrow(ctx, currX, currY, vEndX, vEndY, '#10b981', { width: 3, head: 10 });
    }

    // Moving Object
    glowDot(ctx, currX, currY, 8, '#38bdf8', 12);
    drawTag(
      ctx,
      `x: ${currentState.position.x.toFixed(1)}m, y: ${currentState.position.y.toFixed(1)}m`,
      currX + 12,
      currY - 12,
      { color: '#38bdf8' }
    );
  };

  return (
    <LabLayout title="Uniform Linear Motion" category="Classical Mechanics">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <Panel title="Motion Visualization" icon={Gauge}>
            <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
              <SimCanvas height={CANVAS_HEIGHT} draw={draw} ariaLabel="Uniform linear motion canvas" />
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
              { label: 'Position (x, y)', value: `(${currentState.position.x.toFixed(2)}, ${currentState.position.y.toFixed(2)}) m`, accent: 'sky' },
              { label: 'Velocity (vx, vy)', value: `(${currentState.velocity.x.toFixed(2)}, ${currentState.velocity.y.toFixed(2)}) m/s`, accent: 'emerald' },
              { label: 'Displacement', value: `(${currentState.displacement.x.toFixed(2)}, ${currentState.displacement.y.toFixed(2)}) m`, accent: 'amber' },
              { label: 'Distance', value: `${currentState.distanceTraveled.toFixed(2)} m` },
            ]}
          />

          <PhysicsChart
            data={telemetry.data}
            title="Position and Distance over Time"
            series={[
              { key: 'x', name: 'Position X', color: '#38bdf8', unit: 'm' },
              { key: 'y', name: 'Position Y', color: '#a855f7', unit: 'm' },
              { key: 'distance', name: 'Distance', color: '#10b981', unit: 'm', dashed: true },
            ]}
            xLabel="Time (s)"
            yLabel="m"
          />
        </div>

        <div className="lg:col-span-4 space-y-6">
          <Panel title="Motion Parameters" icon={Sliders}>
            <div className="space-y-5">
              <Slider
                label="Initial Position X (x₀)"
                value={params.initialPosition.x}
                min={-5}
                max={5}
                step={0.5}
                unit="m"
                onChange={(v) => updateParam({ initialPosition: { ...params.initialPosition, x: v } })}
                accent="sky"
              />
              <Slider
                label="Initial Position Y (y₀)"
                value={params.initialPosition.y}
                min={-3}
                max={3}
                step={0.5}
                unit="m"
                onChange={(v) => updateParam({ initialPosition: { ...params.initialPosition, y: v } })}
                accent="sky"
              />
              <Slider
                label="Velocity X (vₓ)"
                value={params.velocity.x}
                min={-10}
                max={10}
                step={0.5}
                unit="m/s"
                onChange={(v) => updateParam({ velocity: { ...params.velocity, x: v } })}
                accent="emerald"
              />
              <Slider
                label="Velocity Y (v_y)"
                value={params.velocity.y}
                min={-10}
                max={10}
                step={0.5}
                unit="m/s"
                onChange={(v) => updateParam({ velocity: { ...params.velocity, y: v } })}
                accent="emerald"
              />
            </div>
          </Panel>

          <Panel title="Equations & Physics" icon={Info}>
            <FormulaList
              formulas={[
                '\\vec{r}(t) = \\vec{r}_0 + \\vec{v} t',
                '\\vec{v}(t) = \\vec{v} = \\text{const}',
                '\\vec{a}(t) = 0',
                '\\Delta \\vec{r} = \\vec{v} \\Delta t',
              ]}
            />
            <div className="mt-4 text-xs text-slate-400 space-y-3">
              <p>
                <strong className="text-emerald-400">Uniform Linear Motion</strong> describes an object moving in a straight line at constant speed with zero acceleration ($a = 0$).
              </p>
              <p>
                According to Newton's First Law, an object remains in uniform motion unless acted upon by a net external force.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </LabLayout>
  );
};

export default UniformLinearMotionPage;
