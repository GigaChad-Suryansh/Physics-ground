import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Sliders, Gauge, Info } from 'lucide-react';
import { LabLayout } from '../../components/layout/LabLayout';
import { SimulationControls } from '../../components/controls/SimulationControls';
import { PhysicsChart } from '../../components/charts/PhysicsChart';
import { SimCanvas } from '../../components/canvas/SimCanvas';
import type { DrawFn } from '../../components/canvas/SimCanvas';
import { MONO, drawArrow, drawTag, fillGradient, glowDot, niceTicks } from '../../components/canvas/draw';
import { FormulaList, Panel, ReadoutBar } from '../../components/ui/Panel';
import { Slider } from '../../components/ui/Slider';
import { CANVAS_COLORS } from '../../components/ui/theme';
import { useSimulation } from '../../hooks/useSimulation';
import { useTelemetry } from '../../hooks/useTelemetry';
import { sub, magnitude } from '../../physics/vector';
import {
  getMotionState,
  calculateAverages,
  type MotionParams,
  type TrajectoryType,
} from '../../physics/mechanics/speed-velocity';

const CANVAS_HEIGHT = 400;
const PX_PER_M = 40;
const DT = 1 / 60;

const DEFAULT_PARAMS: MotionParams = {
  type: 'circular',
  amplitude: 3,
  frequency: 0.2,
  speed: 2,
};

export const SpeedVelocityPage: React.FC = () => {
  const [params, setParams] = useState<MotionParams>(DEFAULT_PARAMS);
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const [liveTime, setLiveTime] = useState(0);
  const [totalDistance, setTotalDistance] = useState(0);
  const lastPosRef = useRef(getMotionState(0, params).position);

  const telemetry = useTelemetry(1500, 4);

  const initialPosition = useMemo(() => getMotionState(0, params).position, [params.type, params.amplitude, params.frequency, params.speed]);

  const { state: simState, play, pause, reset, step, setSpeed } = useSimulation({
    dt: DT,
    onStep: (dt) => {
      const t = liveTime + dt;
      setLiveTime(t);

      const state = getMotionState(t, paramsRef.current);
      const stepDist = magnitude(sub(state.position, lastPosRef.current));
      setTotalDistance((d) => d + stepDist);
      lastPosRef.current = state.position;

      telemetry.push({
        time: t,
        speed: state.speed,
        vx: state.velocity.x,
        vy: state.velocity.y,
      });
    },
    onReset: () => {
      setLiveTime(0);
      setTotalDistance(0);
      lastPosRef.current = getMotionState(0, paramsRef.current).position;
      telemetry.clear();
    },
  });

  const updateParam = useCallback((patch: Partial<MotionParams>) => {
    setParams((prev) => {
      const next = { ...prev, ...patch };
      paramsRef.current = next;
      return next;
    });
    reset();
  }, [reset]);

  const currentState = getMotionState(liveTime, params);
  const displacement = sub(currentState.position, initialPosition);
  const averages = calculateAverages(totalDistance, displacement, liveTime);

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
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    for (let t = 0; t < 10; t += 0.1) {
      const p = getMotionState(t, params).position;
      const sx = originX + p.x * PX_PER_M;
      const sy = originY - p.y * PX_PER_M;
      if (t === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Displacement Vector
    const startX = originX + initialPosition.x * PX_PER_M;
    const startY = originY - initialPosition.y * PX_PER_M;
    const currX = originX + currentState.position.x * PX_PER_M;
    const currY = originY - currentState.position.y * PX_PER_M;
    
    drawArrow(ctx, startX, startY, currX, currY, 'rgba(251, 191, 36, 0.4)', { width: 2, head: 10 });

    // Velocity Vector
    const vScale = 0.5; // Scale velocity for visualization
    const vEndX = currX + currentState.velocity.x * PX_PER_M * vScale;
    const vEndY = currY - currentState.velocity.y * PX_PER_M * vScale;
    drawArrow(ctx, currX, currY, vEndX, vEndY, '#10b981', { width: 3, head: 12 });

    // Object
    glowDot(ctx, currX, currY, 8, '#38bdf8', 12);
    drawTag(ctx, `v = ${currentState.speed.toFixed(2)} m/s`, currX + 12, currY - 12, { color: '#10b981' });
  };

  return (
    <LabLayout title="Speed and Velocity" category="Mechanics & Kinematics">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <Panel title="Motion Visualization" icon={Gauge}>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {(['linear', 'circular', 'sinusoidal'] as TrajectoryType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => updateParam({ type: t })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                    params.type === t
                      ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
              <SimCanvas height={CANVAS_HEIGHT} draw={draw} ariaLabel="Speed and velocity simulation" />
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
              { label: 'Inst. Speed', value: `${currentState.speed.toFixed(2)} m/s`, accent: 'emerald' },
              { label: 'Avg. Speed', value: `${averages.averageSpeed.toFixed(2)} m/s`, accent: 'sky' },
              { label: 'Avg. Velocity', value: `(${averages.averageVelocity.x.toFixed(2)}, ${averages.averageVelocity.y.toFixed(2)}) m/s`, accent: 'amber' },
              { label: 'Distance', value: `${totalDistance.toFixed(2)} m` },
            ]}
          />

          <PhysicsChart
            data={telemetry.data}
            title="Velocity Components and Speed"
            series={[
              { key: 'speed', name: 'Speed', color: '#10b981', unit: 'm/s' },
              { key: 'vx', name: 'v_x', color: '#38bdf8', unit: 'm/s', dashed: true },
              { key: 'vy', name: 'v_y', color: '#f43f5e', unit: 'm/s', dashed: true },
            ]}
            xLabel="Time (s)"
            yLabel="m/s"
          />
        </div>

        <div className="lg:col-span-4 space-y-6">
          <Panel title="Motion Parameters" icon={Sliders}>
            <div className="space-y-5">
              {params.type === 'linear' ? (
                <Slider
                  label="Constant Speed"
                  value={params.speed}
                  min={0.5}
                  max={5}
                  step={0.1}
                  unit="m/s"
                  onChange={(v) => updateParam({ speed: v })}
                  accent="emerald"
                />
              ) : (
                <>
                  <Slider
                    label="Amplitude (Radius)"
                    value={params.amplitude}
                    min={1}
                    max={4}
                    step={0.1}
                    unit="m"
                    onChange={(v) => updateParam({ amplitude: v })}
                    accent="emerald"
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

          <Panel title="Definitions" icon={Info}>
            <FormulaList
              formulas={[
                'v = \\frac{d\\vec{r}}{dt} \\quad \\text{(Instantaneous)}',
                's = |v| \\quad \\text{(Speed)}',
                '\\vec{v}_{avg} = \\frac{\\Delta\\vec{r}}{\\Delta t}',
                's_{avg} = \\frac{d}{\\Delta t}',
              ]}
            />
            <div className="mt-4 text-xs text-slate-400 space-y-3">
              <p>
                <strong className="text-emerald-400">Velocity</strong> is a vector quantity that refers to "the rate at which an object changes its position."
              </p>
              <p>
                <strong className="text-emerald-400">Speed</strong> is a scalar quantity that refers to "how fast an object is moving."
              </p>
              <p className="p-2 bg-slate-900/50 rounded border border-slate-800">
                Notice: In circular motion at constant speed, the <em className="text-amber-400">average velocity</em> over one full lap is exactly zero, because the displacement is zero!
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </LabLayout>
  );
};

export default SpeedVelocityPage;
