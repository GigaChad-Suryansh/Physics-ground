import React, { useCallback, useRef, useState } from 'react';
import { Sliders, Gauge, Info } from 'lucide-react';
import { LabLayout } from '../../components/layout/LabLayout';
import { SimulationControls } from '../../components/controls/SimulationControls';
import { PhysicsChart } from '../../components/charts/PhysicsChart';
import { SimCanvas } from '../../components/canvas/SimCanvas';
import type { DrawFn } from '../../components/canvas/SimCanvas';
import { drawArrow, drawTag, fillGradient, glowDot } from '../../components/canvas/draw';
import { FormulaList, Panel, ReadoutBar } from '../../components/ui/Panel';
import { Slider } from '../../components/ui/Slider';
import { CANVAS_COLORS } from '../../components/ui/theme';
import { useSimulation } from '../../hooks/useSimulation';
import { useTelemetry } from '../../hooks/useTelemetry';
import { g_EARTH } from '../../physics/constants';
import {
  DEFAULT_INCLINED_PLANE_PARAMS,
  calculateInclinedPlanePhysics,
  stepInclinedPlane,
  type InclinedPlaneParams,
  type InclinedPlaneState,
} from '../../physics/mechanics/friction-and-inclined-planes';

const CANVAS_HEIGHT = 400;
const PX_PER_M = 40;
const DT = 1 / 60;

const INITIAL_STATE: InclinedPlaneState = {
  displacement: 0,
  velocity: 0,
  acceleration: 0,
  speed: 0,
  isSliding: false,
};

export const FrictionAndInclinedPlanesPage: React.FC = () => {
  const [params, setParams] = useState<InclinedPlaneParams>(DEFAULT_INCLINED_PLANE_PARAMS);
  const [liveState, setLiveState] = useState<InclinedPlaneState>(INITIAL_STATE);
  const [liveTime, setLiveTime] = useState(0);
  const liveStateRef = useRef(liveState);
  liveStateRef.current = liveState;

  const telemetry = useTelemetry(1500, 4);

  const { state: simState, play, pause, reset, step, setSpeed } = useSimulation({
    dt: DT,
    onStep: (dt) => {
      const t = liveTime + dt;
      setLiveTime(t);
      const nextState = stepInclinedPlane(dt, params, liveStateRef.current);
      setLiveState(nextState);

      telemetry.push({
        time: t,
        displacement: nextState.displacement,
        velocity: nextState.velocity,
        acceleration: nextState.acceleration,
      });
    },
    onReset: () => {
      setLiveTime(0);
      setLiveState(INITIAL_STATE);
      telemetry.clear();
    },
  });

  const updateParam = useCallback((patch: Partial<InclinedPlaneParams>) => {
    setParams((prev) => ({ ...prev, ...patch }));
    reset();
  }, [reset]);

  const draw: DrawFn = (ctx, width, height) => {
    const originX = 100;
    const originY = height - 100;
    const planeLength = 600;

    fillGradient(ctx, width, height, '#070b14', CANVAS_COLORS.bgDeep);

    const angle = params.theta;
    const endX = originX + planeLength * Math.cos(angle);
    const endY = originY - planeLength * Math.sin(angle);

    // Draw Ground
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, originY);
    ctx.lineTo(width, originY);
    ctx.stroke();

    // Draw Plane
    ctx.strokeStyle = CANVAS_COLORS.axis;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    // Draw Angle Arc
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(originX, originY, 40, 0, -angle, true);
    ctx.stroke();
    ctx.fillStyle = '#64748b';
    ctx.font = '12px Inter';
    ctx.fillText(`${(angle * 180 / Math.PI).toFixed(0)}°`, originX + 45, originY - 15);

    // Draw Block
    const blockWidth = 60;
    const blockHeight = 30;
    const d = liveState.displacement * PX_PER_M;
    
    // Position of block center
    const bx = originX + d * Math.cos(angle) + (blockHeight/2) * Math.sin(angle);
    const by = originY - d * Math.sin(angle) - (blockHeight/2) * Math.cos(angle);

    // Don't draw if off plane (too far)
    if (d > planeLength + blockWidth) return;

    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(-angle);
    
    // Block body
    ctx.fillStyle = '#38bdf8';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#38bdf8';
    ctx.fillRect(-blockWidth / 2, -blockHeight / 2, blockWidth, blockHeight);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.strokeRect(-blockWidth / 2, -blockHeight / 2, blockWidth, blockHeight);

    // Normal Force Fn (Upwards perpendicular to plane)
    const forceScale = 2;
    const fn = params.mass * g_EARTH * Math.cos(angle);
    drawArrow(ctx, 0, 0, 0, -fn * forceScale, '#f43f5e', { width: 2, head: 8 });
    drawTag(ctx, 'F_n', 0, -fn * forceScale - 5, { color: '#f43f5e', align: 'center' });

    ctx.restore();

    // Gravity Force Fg (Straight down)
    const fg = params.mass * g_EARTH;
    drawArrow(ctx, bx, by, bx, by + fg * forceScale, '#fbbf24', { width: 2, head: 8 });
    drawTag(ctx, 'F_g', bx, by + fg * forceScale + 15, { color: '#fbbf24', align: 'center' });

    // Friction Force Ff (Along the plane)
    const fgParallel = params.mass * g_EARTH * Math.sin(angle);
    const ffValue = liveState.acceleration * params.mass - fgParallel;
    const fx = -ffValue * forceScale * Math.cos(angle);
    const fy = ffValue * forceScale * Math.sin(angle);
    
    if (Math.abs(ffValue) > 0.01) {
      drawArrow(ctx, bx, by, bx + fx, by + fy, '#10b981', { width: 2, head: 8 });
      drawTag(ctx, 'F_f', bx + fx, by + fy - 10, { color: '#10b981', align: 'center' });
    }

    glowDot(ctx, bx, by, 4, '#ffffff', 8);
  };

  return (
    <LabLayout title="Friction and Inclined Planes" category="Classical Mechanics">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <Panel title="Simulation" icon={Gauge}>
            <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
              <SimCanvas height={CANVAS_HEIGHT} draw={draw} ariaLabel="Friction and inclined planes simulation" />
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
              { label: 'Acceleration', value: `${liveState.acceleration.toFixed(2)} m/s²`, accent: 'emerald' },
              { label: 'Velocity', value: `${liveState.velocity.toFixed(2)} m/s`, accent: 'sky' },
              { label: 'Displacement', value: `${liveState.displacement.toFixed(2)} m`, accent: 'amber' },
              { label: 'Status', value: liveState.isSliding ? 'Sliding' : 'Static', accent: liveState.isSliding ? 'rose' : 'emerald' },
            ]}
          />

          <PhysicsChart
            data={telemetry.data}
            title="Kinematics over Time"
            series={[
              { key: 'acceleration', name: 'Accel', color: '#10b981', unit: 'm/s²' },
              { key: 'velocity', name: 'Velocity', color: '#38bdf8', unit: 'm/s' },
              { key: 'displacement', name: 'Pos', color: '#fbbf24', unit: 'm' },
            ]}
            xLabel="Time (s)"
          />
        </div>

        <div className="lg:col-span-4 space-y-6">
          <Panel title="Parameters" icon={Sliders}>
            <div className="space-y-5">
              <Slider
                label="Angle (θ)"
                value={params.theta * 180 / Math.PI}
                min={0}
                max={80}
                step={1}
                unit="°"
                onChange={(v) => updateParam({ theta: v * Math.PI / 180 })}
                accent="sky"
              />
              <Slider
                label="Mass"
                value={params.mass}
                min={0.1}
                max={5}
                step={0.1}
                unit="kg"
                onChange={(v) => updateParam({ mass: v })}
                accent="amber"
              />
              <Slider
                label="Static Friction (μs)"
                value={params.muStatic}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => updateParam({ muStatic: v })}
                accent="rose"
              />
              <Slider
                label="Kinetic Friction (μk)"
                value={params.muKinetic}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => updateParam({ muKinetic: v })}
                accent="emerald"
                hint={params.muKinetic > params.muStatic ? "Usually μk < μs" : undefined}
              />
            </div>
          </Panel>

          <Panel title="Mathematical Model" icon={Info}>
            <FormulaList
              formulas={[
                'F_{g, \\parallel} = m g \\sin\\theta',
                'F_n = m g \\cos\\theta',
                'F_{s, max} = \\mu_s F_n',
                'F_k = \\mu_k F_n',
                'a = \\frac{\\Sigma F}{m}',
              ]}
            />
            <div className="mt-4 text-xs text-slate-400 space-y-3">
              <p>
                An object on an inclined plane experiences gravity, a normal force, and friction.
              </p>
              <p>
                <strong className="text-sky-400">Static friction</strong> prevents motion until the component of gravity along the plane exceeds its maximum value.
              </p>
              <p>
                Once in motion, <strong className="text-emerald-400">kinetic friction</strong> opposes the velocity.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </LabLayout>
  );
};

export default FrictionAndInclinedPlanesPage;
