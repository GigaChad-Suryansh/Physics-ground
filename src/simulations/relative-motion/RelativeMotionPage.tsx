import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Sliders, Gauge, Info, Eye } from 'lucide-react';
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
  stepRelativeMotion,
  DEFAULT_RELATIVE_MOTION_PARAMS,
  type RelativeMotionParams,
} from '../../physics/mechanics/relative-motion';

const CANVAS_HEIGHT = 400;
const PX_PER_M = 20;
const DT = 1 / 60;

type FrameOfReference = 'ground' | 'objectB';

export const RelativeMotionPage: React.FC = () => {
  const [params, setParams] = useState<RelativeMotionParams>(DEFAULT_RELATIVE_MOTION_PARAMS);
  const [frame, setFrame] = useState<FrameOfReference>('ground');
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const [liveTime, setLiveTime] = useState(0);

  const telemetry = useTelemetry(1500, 4);

  const { state: simState, play, pause, reset, step, setSpeed } = useSimulation({
    dt: DT,
    onStep: (dt) => {
      setLiveTime((prev) => {
        const t = prev + dt;
        const current = stepRelativeMotion(paramsRef.current, t);
        telemetry.push({
          time: t,
          relDistance: current.relativeResult.relativeDistance,
          relSpeed: current.relativeResult.relativeSpeed,
          relVx: current.relativeResult.relativeVelocity.x,
          relVy: current.relativeResult.relativeVelocity.y,
        });
        return t;
      });
    },
    onReset: () => {
      setLiveTime(0);
      telemetry.clear();
    },
  });

  const updateObjectA = useCallback(
    (patch: Partial<RelativeMotionParams['objectA']>) => {
      setParams((prev) => {
        const next = {
          ...prev,
          objectA: {
            position: { ...prev.objectA.position, ...(patch.position || {}) },
            velocity: { ...prev.objectA.velocity, ...(patch.velocity || {}) },
          },
        };
        paramsRef.current = next;
        return next;
      });
      reset();
    },
    [reset]
  );

  const updateObjectB = useCallback(
    (patch: Partial<RelativeMotionParams['objectB']>) => {
      setParams((prev) => {
        const next = {
          ...prev,
          objectB: {
            position: { ...prev.objectB.position, ...(patch.position || {}) },
            velocity: { ...prev.objectB.velocity, ...(patch.velocity || {}) },
          },
        };
        paramsRef.current = next;
        return next;
      });
      reset();
    },
    [reset]
  );

  const currentStep = useMemo(() => {
    return stepRelativeMotion(params, liveTime);
  }, [params, liveTime]);

  const { objectA, objectB, relativeResult } = currentStep;

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
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, height);
      ctx.stroke();
    });
    yTicks.forEach((y) => {
      const sy = originY - y * PX_PER_M;
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(width, sy);
      ctx.stroke();
    });

    // Axes
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, originY);
    ctx.lineTo(width, originY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(originX, 0);
    ctx.lineTo(originX, height);
    ctx.stroke();

    const vScale = 1.0;

    if (frame === 'ground') {
      // Trajectories in Ground Frame
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      for (let t = 0; t <= 10; t += 0.5) {
        const stA = stepRelativeMotion(params, t).objectA;
        const sx = originX + stA.position.x * PX_PER_M;
        const sy = originY - stA.position.y * PX_PER_M;
        if (t === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();

      ctx.strokeStyle = 'rgba(245, 158, 11, 0.2)';
      ctx.beginPath();
      for (let t = 0; t <= 10; t += 0.5) {
        const stB = stepRelativeMotion(params, t).objectB;
        const sx = originX + stB.position.x * PX_PER_M;
        const sy = originY - stB.position.y * PX_PER_M;
        if (t === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Object A coordinates
      const ax = originX + objectA.position.x * PX_PER_M;
      const ay = originY - objectA.position.y * PX_PER_M;

      // Object B coordinates
      const bx = originX + objectB.position.x * PX_PER_M;
      const by = originY - objectB.position.y * PX_PER_M;

      // Vector r_AB (B to A)
      drawArrow(ctx, bx, by, ax, ay, 'rgba(168, 85, 247, 0.5)', { width: 2, dash: [4, 4] });

      // Velocity A
      const vAxEnd = ax + objectA.velocity.x * PX_PER_M * vScale;
      const vAyEnd = ay - objectA.velocity.y * PX_PER_M * vScale;
      drawArrow(ctx, ax, ay, vAxEnd, vAyEnd, '#38bdf8', { width: 2, head: 10 });

      // Velocity B
      const vBxEnd = bx + objectB.velocity.x * PX_PER_M * vScale;
      const vByEnd = by - objectB.velocity.y * PX_PER_M * vScale;
      drawArrow(ctx, bx, by, vBxEnd, vByEnd, '#f59e0b', { width: 2, head: 10 });

      // Draw Objects
      glowDot(ctx, ax, ay, 7, '#38bdf8', 10);
      drawTag(ctx, 'Object A', ax + 10, ay - 10, { color: '#38bdf8' });

      glowDot(ctx, bx, by, 7, '#f59e0b', 10);
      drawTag(ctx, 'Object B', bx + 10, by - 10, { color: '#f59e0b' });
    } else {
      // Frame of Reference: Object B (Object B is at origin)
      const bx = originX;
      const by = originY;

      const relPos = relativeResult.relativePosition;
      const ax = originX + relPos.x * PX_PER_M;
      const ay = originY - relPos.y * PX_PER_M;

      // Relative Trajectory Path of A relative to B
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.3)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      for (let t = 0; t <= 10; t += 0.5) {
        const st = stepRelativeMotion(params, t).relativeResult;
        const sx = originX + st.relativePosition.x * PX_PER_M;
        const sy = originY - st.relativePosition.y * PX_PER_M;
        if (t === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Relative position vector r_AB
      drawArrow(ctx, bx, by, ax, ay, '#a855f7', { width: 2 });

      // Relative velocity vector v_AB
      const vRelXEnd = ax + relativeResult.relativeVelocity.x * PX_PER_M * vScale;
      const vRelYEnd = ay - relativeResult.relativeVelocity.y * PX_PER_M * vScale;
      drawArrow(ctx, ax, ay, vRelXEnd, vRelYEnd, '#ec4899', { width: 3, head: 10 });

      // Objects
      glowDot(ctx, bx, by, 9, '#f59e0b', 12);
      drawTag(ctx, 'Object B (Observer)', bx + 12, by - 12, { color: '#f59e0b' });

      glowDot(ctx, ax, ay, 7, '#38bdf8', 10);
      drawTag(ctx, `A rel to B (v_rel = ${relativeResult.relativeSpeed.toFixed(1)} m/s)`, ax + 10, ay - 10, {
        color: '#ec4899',
      });
    }
  };

  return (
    <LabLayout title="Relative Motion" category="Classical Mechanics">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <Panel title="Simulation View" icon={Gauge}>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="text-xs font-semibold text-slate-400 mr-2 flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" /> Frame of Reference:
              </span>
              {(['ground', 'objectB'] as FrameOfReference[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFrame(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    frame === f
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/25'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {f === 'ground' ? 'Ground Frame (Lab)' : "Object B's Frame"}
                </button>
              ))}
            </div>

            <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
              <SimCanvas height={CANVAS_HEIGHT} draw={draw} ariaLabel="Relative motion simulation canvas" />
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
              { label: 'Relative Dist r_AB', value: `${relativeResult.relativeDistance.toFixed(2)} m`, accent: 'purple' },
              { label: 'Relative Speed v_AB', value: `${relativeResult.relativeSpeed.toFixed(2)} m/s`, accent: 'pink' },
              { label: 'Closest Distance', value: `${relativeResult.minDistance.toFixed(2)} m`, accent: 'sky' },
              { label: 'Time to Closest Appr.', value: `${relativeResult.closestApproachTime.toFixed(2)} s`, accent: 'amber' },
            ]}
          />

          <PhysicsChart
            data={telemetry.data}
            title="Relative Motion Dynamics"
            series={[
              { key: 'relDistance', name: 'Rel. Distance (m)', color: '#a855f7', unit: 'm' },
              { key: 'relSpeed', name: 'Rel. Speed (m/s)', color: '#ec4899', unit: 'm/s' },
              { key: 'relVx', name: 'v_rel,x (m/s)', color: '#38bdf8', unit: 'm/s', dashed: true },
              { key: 'relVy', name: 'v_rel,y (m/s)', color: '#f59e0b', unit: 'm/s', dashed: true },
            ]}
            xLabel="Time (s)"
            yLabel="Value"
          />
        </div>

        <div className="lg:col-span-4 space-y-6">
          <Panel title="Object A Parameters" icon={Sliders}>
            <div className="space-y-4">
              <Slider
                label="Velocity X (v_Ax)"
                value={params.objectA.velocity.x}
                min={-15}
                max={15}
                step={0.5}
                unit="m/s"
                onChange={(vx) => updateObjectA({ velocity: { ...params.objectA.velocity, x: vx } })}
                accent="sky"
              />
              <Slider
                label="Velocity Y (v_Ay)"
                value={params.objectA.velocity.y}
                min={-15}
                max={15}
                step={0.5}
                unit="m/s"
                onChange={(vy) => updateObjectA({ velocity: { ...params.objectA.velocity, y: vy } })}
                accent="sky"
              />
            </div>
          </Panel>

          <Panel title="Object B Parameters" icon={Sliders}>
            <div className="space-y-4">
              <Slider
                label="Velocity X (v_Bx)"
                value={params.objectB.velocity.x}
                min={-15}
                max={15}
                step={0.5}
                unit="m/s"
                onChange={(vx) => updateObjectB({ velocity: { ...params.objectB.velocity, x: vx } })}
                accent="amber"
              />
              <Slider
                label="Velocity Y (v_By)"
                value={params.objectB.velocity.y}
                min={-15}
                max={15}
                step={0.5}
                unit="m/s"
                onChange={(vy) => updateObjectB({ velocity: { ...params.objectB.velocity, y: vy } })}
                accent="amber"
              />
            </div>
          </Panel>

          <Panel title="Galilean Relativity" icon={Info}>
            <FormulaList
              formulas={[
                '\\vec{r}_{A/B} = \\vec{r}_A - \\vec{r}_B',
                '\\vec{v}_{A/B} = \\vec{v}_A - \\vec{v}_B',
                't_{min} = -\\frac{\\vec{r}_{AB} \\cdot \\vec{v}_{AB}}{|\\vec{v}_{AB}|^2}',
              ]}
            />
            <div className="mt-4 text-xs text-slate-400 space-y-3">
              <p>
                <strong className="text-purple-400">Relative Position & Velocity:</strong> The motion of object A as observed from object B depends on their relative position and velocity vectors.
              </p>
              <p>
                <strong className="text-pink-400">Galilean Transformation:</strong> Under classical mechanics, velocities simply subtract component-wise: v_rel = v_A - v_B.
              </p>
              <p className="p-2 bg-slate-900/50 rounded border border-slate-800 text-amber-300">
                Switch between the <em>Ground Frame</em> and <em>Object B's Frame</em> to observe how motion appears stationary or moving depending on the observer's frame!
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </LabLayout>
  );
};

export default RelativeMotionPage;
