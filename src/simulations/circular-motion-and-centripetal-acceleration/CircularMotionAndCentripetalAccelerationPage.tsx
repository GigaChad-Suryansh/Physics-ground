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
  DEFAULT_CIRCULAR_MOTION_PARAMS,
  getCircularMotionState,
  type CircularMotionParams,
} from '../../physics/mechanics/circular-motion-and-centripetal-acceleration';

const CANVAS_HEIGHT = 400;
const PX_PER_M = 30;
const DT = 1 / 60;

export const CircularMotionAndCentripetalAccelerationPage: React.FC = () => {
  const [params, setParams] = useState<CircularMotionParams>(DEFAULT_CIRCULAR_MOTION_PARAMS);
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const [liveTime, setLiveTime] = useState(0);
  const telemetry = useTelemetry(1500, 4);

  const { state: simState, play, pause, reset, step, setSpeed } = useSimulation({
    dt: DT,
    onStep: (dt) => {
      const t = liveTime + dt;
      setLiveTime(t);

      const state = getCircularMotionState(t, paramsRef.current);
      telemetry.push({
        time: t,
        speed: state.speed,
        ac: state.centripetalAccelMag,
        Fc: state.centripetalForceMag,
        vx: state.velocity.x,
        vy: state.velocity.y,
      });
    },
    onReset: () => {
      setLiveTime(0);
      telemetry.clear();
    },
  });

  const updateParam = useCallback((patch: Partial<CircularMotionParams>) => {
    setParams((prev) => {
      const next = { ...prev, ...patch };
      paramsRef.current = next;
      return next;
    });
    reset();
  }, [reset]);

  const currentState = getCircularMotionState(liveTime, params);

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

    // Circular Orbit Path
    const rPx = params.radius * PX_PER_M;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.arc(originX, originY, rPx, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.setLineDash([]);

    // Position of object
    const currX = originX + currentState.position.x * PX_PER_M;
    const currY = originY - currentState.position.y * PX_PER_M;

    // Radius vector (Origin -> Object)
    drawArrow(ctx, originX, originY, currX, currY, 'rgba(251, 191, 36, 0.5)', { width: 2, head: 8 });

    // Velocity Vector (tangential, green)
    const vScale = 0.5;
    const vEndX = currX + currentState.velocity.x * PX_PER_M * vScale;
    const vEndY = currY - currentState.velocity.y * PX_PER_M * vScale;
    drawArrow(ctx, currX, currY, vEndX, vEndY, '#10b981', { width: 3, head: 10 });

    // Centripetal Acceleration Vector (pointing inward, rose/red)
    const aScale = 0.3;
    const aEndX = currX + currentState.acceleration.x * PX_PER_M * aScale;
    const aEndY = currY - currentState.acceleration.y * PX_PER_M * aScale;
    drawArrow(ctx, currX, currY, aEndX, aEndY, '#f43f5e', { width: 3, head: 10 });

    // Center pivot point
    glowDot(ctx, originX, originY, 4, '#fbbf24', 8);

    // Object dot
    glowDot(ctx, currX, currY, 8, '#38bdf8', 14);

    // Tags
    drawTag(ctx, `v = ${currentState.speed.toFixed(2)} m/s`, currX + 12, currY - 20, { color: '#10b981' });
    drawTag(ctx, `a_c = ${currentState.centripetalAccelMag.toFixed(2)} m/s²`, currX + 12, currY + 10, { color: '#f43f5e' });
  };

  return (
    <LabLayout title="Circular Motion & Centripetal Acceleration" category="Classical Mechanics">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <Panel title="Interactive Circular Orbit" icon={Gauge}>
            <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
              <SimCanvas height={CANVAS_HEIGHT} draw={draw} ariaLabel="Circular motion simulation" />
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
              { label: 'Speed (v)', value: `${currentState.speed.toFixed(2)} m/s`, accent: 'emerald' },
              { label: 'Centripetal Accel (a_c)', value: `${currentState.centripetalAccelMag.toFixed(2)} m/s²`, accent: 'rose' },
              { label: 'Centripetal Force (F_c)', value: `${currentState.centripetalForceMag.toFixed(2)} N`, accent: 'amber' },
              { label: 'Period (T)', value: `${isFinite(currentState.period) ? currentState.period.toFixed(2) + ' s' : '∞'}`, accent: 'sky' },
            ]}
          />

          <PhysicsChart
            data={telemetry.data}
            title="Centripetal Acceleration and Force Telemetry"
            series={[
              { key: 'ac', name: 'a_c (m/s²)', color: '#f43f5e', unit: 'm/s²' },
              { key: 'Fc', name: 'F_c (N)', color: '#fbbf24', unit: 'N' },
              { key: 'speed', name: 'Speed (m/s)', color: '#10b981', unit: 'm/s', dashed: true },
            ]}
            xLabel="Time (s)"
          />
        </div>

        <div className="lg:col-span-4 space-y-6">
          <Panel title="Orbit Parameters" icon={Sliders}>
            <div className="space-y-5">
              <Slider
                label="Radius (r)"
                value={params.radius}
                min={1}
                max={8}
                step={0.5}
                unit="m"
                onChange={(v) => updateParam({ radius: v })}
                accent="sky"
              />
              <Slider
                label="Angular Velocity (ω)"
                value={params.angularVelocity}
                min={-5}
                max={5}
                step={0.2}
                unit="rad/s"
                onChange={(v) => updateParam({ angularVelocity: v })}
                accent="emerald"
              />
              <Slider
                label="Mass (m)"
                value={params.mass}
                min={0.5}
                max={10}
                step={0.5}
                unit="kg"
                onChange={(v) => updateParam({ mass: v })}
                accent="amber"
              />
            </div>
          </Panel>

          <Panel title="Governing Physics" icon={Info}>
            <FormulaList
              formulas={[
                '\\omega = \\frac{d\\theta}{dt} = \\frac{v}{r} = \\frac{2\\pi}{T}',
                'v = r |\\omega|',
                'a_c = \\frac{v^2}{r} = r \\omega^2',
                'F_c = m a_c = m r \\omega^2',
                '\\vec{a}_c(t) = -\\omega^2 \\vec{r}(t)',
              ]}
            />
            <div className="mt-4 text-xs text-slate-400 space-y-3">
              <p>
                In <strong className="text-emerald-400">uniform circular motion</strong>, speed $v$ remains constant while the velocity vector direction changes continuously.
              </p>
              <p>
                The acceleration vector continuous magnitude points toward the center of curvature (<strong className="text-rose-400">centripetal acceleration</strong>).
              </p>
              <p className="p-2 bg-slate-900/50 rounded border border-slate-800">
                Notice: Centripetal force $F_c = m r \omega^2$ increases quadratically with angular velocity $\omega$ and linearly with radius $r$.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </LabLayout>
  );
};

export default CircularMotionAndCentripetalAccelerationPage;
