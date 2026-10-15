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
import { magnitude } from '../../physics/vector';
import {
  getAccelerationState,
  DEFAULT_ACCELERATION_PARAMS,
  type AccelerationParams,
  type AccelerationMode,
} from '../../physics/mechanics/acceleration';

const CANVAS_HEIGHT = 400;
const PX_PER_M = 35;
const DT = 1 / 60;

export const AccelerationPage: React.FC = () => {
  const [params, setParams] = useState<AccelerationParams>(DEFAULT_ACCELERATION_PARAMS);
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const [liveTime, setLiveTime] = useState(0);
  const telemetry = useTelemetry(1500, 4);

  const { state: simState, play, pause, reset, step, setSpeed } = useSimulation({
    dt: DT,
    onStep: (dt) => {
      const t = liveTime + dt;
      setLiveTime(t);

      const state = getAccelerationState(t, paramsRef.current);
      telemetry.push({
        time: t,
        speed: state.speed,
        ax: state.acceleration.x,
        ay: state.acceleration.y,
        vx: state.velocity.x,
        vy: state.velocity.y,
      });
    },
    onReset: () => {
      setLiveTime(0);
      telemetry.clear();
    },
  });

  const updateParam = useCallback((patch: Partial<AccelerationParams>) => {
    setParams((prev) => {
      const next = { ...prev, ...patch };
      paramsRef.current = next;
      return next;
    });
    reset();
  }, [reset]);

  const currentState = getAccelerationState(liveTime, params);
  const accelMag = magnitude(currentState.acceleration);

  const draw: DrawFn = (ctx, width, height) => {
    const originX = width / 2;
    const originY = height / 2;

    fillGradient(ctx, width, height, '#070b14', CANVAS_COLORS.bgDeep);

    // Grid
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    const xTicks = niceTicks(-width / (2 * PX_PER_M), width / (2 * PX_PER_M), 10);
    const yTicks = niceTicks(-height / (2 * PX_PER_M), height / (2 * PX_PER_M), 8);

    xTicks.forEach(x => {
      const sx = originX + x * PX_PER_M;
      ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, height); ctx.stroke();
    });
    yTicks.forEach(y => {
      const sy = originY - y * PX_PER_M;
      ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(width, sy); ctx.stroke();
    });

    // Axes
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, originY); ctx.lineTo(width, originY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(originX, 0); ctx.lineTo(originX, height); ctx.stroke();

    // Trajectory Path (Ghost)
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    const tMax = params.mode === 'circular' ? 10 : 8;
    for (let t = 0; t <= tMax; t += 0.05) {
      const p = getAccelerationState(t, params).position;
      const sx = originX + p.x * PX_PER_M;
      const sy = originY - p.y * PX_PER_M;
      if (t === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Object position on canvas
    const currX = originX + currentState.position.x * PX_PER_M;
    const currY = originY - currentState.position.y * PX_PER_M;

    // Velocity Vector (Green)
    const vScale = 0.4;
    const vEndX = currX + currentState.velocity.x * PX_PER_M * vScale;
    const vEndY = currY - currentState.velocity.y * PX_PER_M * vScale;
    drawArrow(ctx, currX, currY, vEndX, vEndY, '#10b981', { width: 2.5, head: 10 });

    // Acceleration Vector (Rose/Red)
    const aScale = params.mode === 'circular' ? 0.8 : 0.4;
    const aEndX = currX + currentState.acceleration.x * PX_PER_M * aScale;
    const aEndY = currY - currentState.acceleration.y * PX_PER_M * aScale;
    drawArrow(ctx, currX, currY, aEndX, aEndY, '#f43f5e', { width: 3, head: 12 });

    // Object dot
    glowDot(ctx, currX, currY, 8, '#38bdf8', 12);
    drawTag(ctx, `a = ${accelMag.toFixed(2)} m/s²`, currX + 12, currY - 12, { color: '#f43f5e' });
  };

  return (
    <LabLayout title="Acceleration Lab" category="Classical Mechanics">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <Panel title="Acceleration & Kinematics Visualization" icon={Gauge}>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {(['linear', 'freefall', 'circular'] as AccelerationMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => updateParam({ mode: m })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                    params.mode === m
                      ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/25'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {m === 'freefall' ? 'Free Fall' : m}
                </button>
              ))}
            </div>

            <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
              <SimCanvas height={CANVAS_HEIGHT} draw={draw} ariaLabel="Acceleration simulation canvas" />
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
              { label: 'Inst. Acceleration', value: `${accelMag.toFixed(2)} m/s²`, accent: 'rose' },
              { label: 'Inst. Speed', value: `${currentState.speed.toFixed(2)} m/s`, accent: 'emerald' },
              { label: 'Position', value: `(${currentState.position.x.toFixed(2)}, ${currentState.position.y.toFixed(2)}) m`, accent: 'sky' },
              { label: 'Time', value: `${liveTime.toFixed(2)} s` },
            ]}
          />

          <PhysicsChart
            data={telemetry.data}
            title="Acceleration and Velocity over Time"
            series={[
              { key: 'speed', name: 'Speed (v)', color: '#10b981', unit: 'm/s' },
              { key: 'ax', name: 'Acceleration (a_x)', color: '#f43f5e', unit: 'm/s²' },
              { key: 'ay', name: 'Acceleration (a_y)', color: '#f43f5e', unit: 'm/s²', dashed: true },
            ]}
            xLabel="Time (s)"
            yLabel="m/s or m/s²"
          />
        </div>

        <div className="lg:col-span-4 space-y-6">
          <Panel title="Kinematics Parameters" icon={Sliders}>
            <div className="space-y-5">
              {params.mode === 'linear' && (
                <>
                  <Slider
                    label="Initial Velocity (v₀)"
                    value={params.initialVelocity}
                    min={-3}
                    max={5}
                    step={0.5}
                    unit="m/s"
                    onChange={(v) => updateParam({ initialVelocity: v })}
                    accent="sky"
                  />
                  <Slider
                    label="Acceleration (a)"
                    value={params.acceleration}
                    min={-5}
                    max={5}
                    step={0.25}
                    unit="m/s²"
                    onChange={(v) => updateParam({ acceleration: v })}
                    accent="rose"
                  />
                </>
              )}

              {params.mode === 'freefall' && (
                <>
                  <Slider
                    label="Initial Vertical Velocity"
                    value={params.initialVelocity}
                    min={-5}
                    max={15}
                    step={0.5}
                    unit="m/s"
                    onChange={(v) => updateParam({ initialVelocity: v })}
                    accent="sky"
                  />
                  <Slider
                    label="Gravitational Acceleration (g)"
                    value={params.gravity}
                    min={1}
                    max={25}
                    step={0.1}
                    unit="m/s²"
                    onChange={(v) => updateParam({ gravity: v })}
                    accent="rose"
                  />
                </>
              )}

              {params.mode === 'circular' && (
                <>
                  <Slider
                    label="Radius (Amplitude)"
                    value={params.amplitude}
                    min={1}
                    max={5}
                    step={0.25}
                    unit="m"
                    onChange={(v) => updateParam({ amplitude: v })}
                    accent="sky"
                  />
                  <Slider
                    label="Frequency"
                    value={params.frequency}
                    min={0.05}
                    max={1}
                    step={0.05}
                    unit="Hz"
                    onChange={(v) => updateParam({ frequency: v })}
                    accent="emerald"
                  />
                </>
              )}
            </div>
          </Panel>

          <Panel title="Key Equations" icon={Info}>
            <FormulaList
              formulas={[
                '\\vec{a} = \\frac{d\\vec{v}}{dt} = \\frac{d^2\\vec{r}}{dt^2}',
                'v(t) = v_0 + at \\quad \\text{(Linear)}',
                'x(t) = x_0 + v_0 t + \\frac{1}{2}at^2',
                'a_c = \\frac{v^2}{R} = \\omega^2 R \\quad \\text{(Circular)}',
              ]}
            />
          </Panel>
        </div>
      </div>
    </LabLayout>
  );
};

export default AccelerationPage;
