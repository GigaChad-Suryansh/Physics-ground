import React, { useCallback, useMemo, useRef, useState } from 'react';
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
  DEFAULT_MOTION_GRAPH_PARAMS,
  getMotionGraphState,
  type MotionGraphParams,
  type MotionProfileType,
} from '../../physics/mechanics/motion-graphs';

const CANVAS_HEIGHT = 300;
const PX_PER_M = 25;
const DT = 1 / 60;

export const MotionGraphsPage: React.FC = () => {
  const [params, setParams] = useState<MotionGraphParams>(DEFAULT_MOTION_GRAPH_PARAMS);
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const [liveTime, setLiveTime] = useState(0);

  const telemetry = useTelemetry(1500, 4);

  const { state: simState, play, pause, reset, step, setSpeed } = useSimulation({
    dt: DT,
    onStep: (dt) => {
      const t = liveTime + dt;
      setLiveTime(t);

      const state = getMotionGraphState(t, paramsRef.current);

      telemetry.push({
        time: t,
        position: state.position,
        velocity: state.velocity,
        acceleration: state.acceleration,
      });
    },
    onReset: () => {
      setLiveTime(0);
      telemetry.clear();
    },
  });

  const updateParam = useCallback((patch: Partial<MotionGraphParams>) => {
    setParams((prev) => {
      const next = { ...prev, ...patch };
      paramsRef.current = next;
      return next;
    });
    reset();
  }, [reset]);

  const currentState = useMemo(() => getMotionGraphState(liveTime, params), [liveTime, params]);

  const draw: DrawFn = (ctx, width, height) => {
    const originX = width / 2;
    const originY = height / 2;

    fillGradient(ctx, width, height, '#070b14', CANVAS_COLORS.bgDeep);

    // Grid
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    const xTicks = niceTicks(-width / (2 * PX_PER_M), width / (2 * PX_PER_M), 10);

    xTicks.forEach((x) => {
      const sx = originX + x * PX_PER_M;
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, height);
      ctx.stroke();
    });

    // Main Track Axis (1D horizontal line)
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, originY);
    ctx.lineTo(width, originY);
    ctx.stroke();

    // Origin marker
    ctx.strokeStyle = '#64748b';
    ctx.beginPath();
    ctx.moveTo(originX, originY - 15);
    ctx.lineTo(originX, originY + 15);
    ctx.stroke();

    // Object Position on 1D Track
    const objX = originX + currentState.position * PX_PER_M;
    const objY = originY;

    // Velocity Arrow (Horizontal)
    if (Math.abs(currentState.velocity) > 0.01) {
      const vEndX = objX + currentState.velocity * 10;
      drawArrow(ctx, objX, objY - 20, vEndX, objY - 20, '#10b981', { width: 2, head: 8 });
    }

    // Acceleration Arrow (Horizontal)
    if (Math.abs(currentState.acceleration) > 0.01) {
      const aEndX = objX + currentState.acceleration * 10;
      drawArrow(ctx, objX, objY + 20, aEndX, objY + 20, '#f43f5e', { width: 2, head: 8 });
    }

    // Object Dot
    glowDot(ctx, objX, objY, 10, '#38bdf8', 15);
    drawTag(ctx, `x = ${currentState.position.toFixed(2)} m`, objX, objY - 35, { color: '#38bdf8', align: 'center' });
  };

  return (
    <LabLayout title="Motion Graphs" category="Classical Mechanics">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <Panel title="1D Motion Visualizer" icon={Gauge}>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {(['uniform', 'constant-acceleration', 'harmonic'] as MotionProfileType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => updateParam({ type: t })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                    params.type === t
                      ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {t.replace('-', ' ')}
                </button>
              ))}
            </div>

            <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
              <SimCanvas height={CANVAS_HEIGHT} draw={draw} ariaLabel="Motion graphs 1D visualization" />
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
              { label: 'Time (t)', value: `${currentState.time.toFixed(2)} s` },
              { label: 'Position (x)', value: `${currentState.position.toFixed(2)} m`, accent: 'sky' },
              { label: 'Velocity (v)', value: `${currentState.velocity.toFixed(2)} m/s`, accent: 'emerald' },
              { label: 'Acceleration (a)', value: `${currentState.acceleration.toFixed(2)} m/s²`, accent: 'rose' },
            ]}
          />

          <PhysicsChart
            data={telemetry.data}
            title="Kinematic Motion Graphs (x-t, v-t, a-t)"
            series={[
              { key: 'position', name: 'Position (x)', color: '#38bdf8', unit: 'm' },
              { key: 'velocity', name: 'Velocity (v)', color: '#10b981', unit: 'm/s' },
              { key: 'acceleration', name: 'Acceleration (a)', color: '#f43f5e', unit: 'm/s²' },
            ]}
            xLabel="Time (s)"
          />
        </div>

        <div className="lg:col-span-4 space-y-6">
          <Panel title="Motion Parameters" icon={Sliders}>
            <div className="space-y-5">
              <Slider
                label="Initial Position (x₀)"
                value={params.initialPosition}
                min={-10}
                max={10}
                step={0.5}
                unit="m"
                onChange={(v) => updateParam({ initialPosition: v })}
                accent="sky"
              />

              {params.type !== 'harmonic' && (
                <Slider
                  label="Initial Velocity (v₀)"
                  value={params.initialVelocity}
                  min={-10}
                  max={10}
                  step={0.5}
                  unit="m/s"
                  onChange={(v) => updateParam({ initialVelocity: v })}
                  accent="emerald"
                />
              )}

              {params.type === 'constant-acceleration' && (
                <Slider
                  label="Acceleration (a)"
                  value={params.acceleration}
                  min={-5}
                  max={5}
                  step={0.5}
                  unit="m/s²"
                  onChange={(v) => updateParam({ acceleration: v })}
                  accent="rose"
                />
              )}

              {params.type === 'harmonic' && (
                <>
                  <Slider
                    label="Amplitude (A)"
                    value={params.amplitude}
                    min={1}
                    max={10}
                    step={0.5}
                    unit="m"
                    onChange={(v) => updateParam({ amplitude: v })}
                    accent="sky"
                  />
                  <Slider
                    label="Frequency (f)"
                    value={params.frequency}
                    min={0.1}
                    max={2}
                    step={0.1}
                    unit="Hz"
                    onChange={(v) => updateParam({ frequency: v })}
                    accent="emerald"
                  />
                </>
              )}
            </div>
          </Panel>

          <Panel title="Kinematic Relations" icon={Info}>
            <FormulaList
              formulas={[
                'v(t) = \\frac{dx}{dt} \\quad \\text{(Slope of } x\\text{-}t \\text{ graph)}',
                'a(t) = \\frac{dv}{dt} = \\frac{d^2x}{dt^2} \\quad \\text{(Slope of } v\\text{-}t \\text{ graph)}',
                '\\Delta x = \\int v(t) dt \\quad \\text{(Area under } v\\text{-}t \\text{ graph)}',
                '\\Delta v = \\int a(t) dt \\quad \\text{(Area under } a\\text{-}t \\text{ graph)}',
              ]}
            />
            <div className="mt-4 text-xs text-slate-400 space-y-3">
              <p>
                <strong className="text-sky-400">Position-Time (x-t):</strong> Slope represents instantaneous velocity.
              </p>
              <p>
                <strong className="text-emerald-400">Velocity-Time (v-t):</strong> Slope represents acceleration. Area under the curve gives displacement.
              </p>
              <p>
                <strong className="text-rose-400">Acceleration-Time (a-t):</strong> Area under the curve gives change in velocity.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </LabLayout>
  );
};

export default MotionGraphsPage;
