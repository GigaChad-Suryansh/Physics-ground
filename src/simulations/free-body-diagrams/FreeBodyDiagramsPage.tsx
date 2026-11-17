import React, { useCallback, useRef, useState } from 'react';
import { Sliders, Info, Move } from 'lucide-react';
import { LabLayout } from '../../components/layout/LabLayout';
import { SimulationControls } from '../../components/controls/SimulationControls';
import { PhysicsChart } from '../../components/charts/PhysicsChart';
import { SimCanvas } from '../../components/canvas/SimCanvas';
import type { DrawFn } from '../../components/canvas/SimCanvas';
import { drawArrow, drawTag, fillGradient } from '../../components/canvas/draw';
import { FormulaList, Panel, ReadoutBar } from '../../components/ui/Panel';
import { Slider } from '../../components/ui/Slider';
import { CANVAS_COLORS } from '../../components/ui/theme';
import { useSimulation } from '../../hooks/useSimulation';
import { useTelemetry } from '../../hooks/useTelemetry';
import {
  calculateFBDState,
  stepFBDMotion,
  DEFAULT_FBD_PARAMS,
  type FBDParams,
} from '../../physics/mechanics/free-body-diagrams';

const CANVAS_HEIGHT = 400;
const PX_PER_M = 40;
const DT = 1 / 60;

export const FreeBodyDiagramsPage: React.FC = () => {
  const [params, setParams] = useState<FBDParams>(DEFAULT_FBD_PARAMS);
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const [position, setPosition] = useState(0);
  const [velocity, setVelocity] = useState(0);
  const [time, setTime] = useState(0);

  const telemetry = useTelemetry(1500, 4);

  const { state: simState, play, pause, reset, step, setSpeed } = useSimulation({
    dt: DT,
    onStep: (dt) => {
      const result = stepFBDMotion(position, velocity, paramsRef.current, dt);
      setPosition(result.position);
      setVelocity(result.velocity);
      setTime((t) => t + dt);

      telemetry.push({
        time: time + dt,
        velocity: result.velocity,
        acceleration: result.state.acceleration.x,
        friction: result.state.frictionForce,
      });
    },
    onReset: () => {
      setPosition(0);
      setVelocity(0);
      setTime(0);
      telemetry.clear();
    },
  });

  const updateParam = useCallback((patch: Partial<FBDParams>) => {
    setParams((prev) => {
      const next = { ...prev, ...patch };
      paramsRef.current = next;
      return next;
    });
  }, []);

  const fbdState = calculateFBDState(params, velocity);

  const draw: DrawFn = (ctx, width, height) => {
    const originX = width / 2;
    const originY = height * 0.7;

    fillGradient(ctx, width, height, '#070b14', CANVAS_COLORS.bgDeep);

    const angle = params.inclineAngle;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    // Draw Incline
    ctx.strokeStyle = CANVAS_COLORS.gridStrong;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(originX - 400 * cos, originY + 400 * sin);
    ctx.lineTo(originX + 400 * cos, originY - 400 * sin);
    ctx.stroke();

    // Draw Block
    const blockX = originX + position * PX_PER_M * cos;
    const blockY = originY - position * PX_PER_M * sin;
    
    ctx.save();
    ctx.translate(blockX, blockY);
    ctx.rotate(-angle);

    const bW = 60;
    const bH = 40;
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    ctx.fillRect(-bW / 2, -bH, bW, bH);
    ctx.strokeRect(-bW / 2, -bH, bW, bH);

    // Forces
    const forceScale = 1.5;
    fbdState.forces.forEach(f => {
      const startX = 0;
      const startY = -bH / 2;
      const endX = f.vector.x * forceScale;
      const endY = startY - f.vector.y * forceScale;

      let color = '#94a3b8';
      if (f.id === 'gravity') color = '#f43f5e';
      if (f.id === 'normal') color = '#38bdf8';
      if (f.id === 'applied') color = '#fbbf24';
      if (f.id === 'friction') color = '#c084fc';

      drawArrow(ctx, startX, startY, endX, endY, color, { width: 3, head: 10 });
    });

    ctx.restore();

    drawTag(ctx, `a = ${fbdState.accelerationMagnitude.toFixed(2)} m/s²`, 20, 30, { color: '#10b981' });
    drawTag(ctx, `v = ${velocity.toFixed(2)} m/s`, 20, 60, { color: '#38bdf8' });
  };

  return (
    <LabLayout title="Free-Body Diagrams" category="Classical Mechanics">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <Panel title="Force Visualization" icon={Move}>
            <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
              <SimCanvas height={CANVAS_HEIGHT} draw={draw} ariaLabel="Free-body diagram simulation" />
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
              { label: 'Net Force', value: `${fbdState.netForceMagnitude.toFixed(2)} N`, accent: 'emerald' },
              { label: 'Normal Force', value: `${fbdState.normalForce.toFixed(2)} N`, accent: 'sky' },
              { label: 'Friction', value: `${fbdState.frictionForce.toFixed(2)} N`, accent: 'purple' },
              { label: 'Equilibrium', value: fbdState.isEquilibrium ? 'Yes' : 'No', accent: fbdState.isEquilibrium ? 'emerald' : 'rose' },
            ]}
          />

          <PhysicsChart
            data={telemetry.data}
            title="Motion and Forces Over Time"
            series={[
              { key: 'velocity', name: 'Velocity (m/s)', color: '#38bdf8', unit: 'm/s' },
              { key: 'acceleration', name: 'Accel (m/s²)', color: '#10b981', unit: 'm/s²' },
              { key: 'friction', name: 'Friction (N)', color: '#c084fc', unit: 'N', axis: 'right' },
            ]}
            xLabel="Time (s)"
          />
        </div>

        <div className="lg:col-span-4 space-y-6">
          <Panel title="Simulation Parameters" icon={Sliders}>
            <div className="space-y-5">
              <Slider
                label="Mass"
                value={params.mass}
                min={0.5}
                max={20}
                step={0.5}
                unit="kg"
                onChange={(v) => updateParam({ mass: v })}
                accent="sky"
              />
              <Slider
                label="Incline Angle"
                value={params.inclineAngle * (180 / Math.PI)}
                min={0}
                max={90}
                step={1}
                unit="°"
                onChange={(v) => updateParam({ inclineAngle: v * (Math.PI / 180) })}
                accent="amber"
              />
              <Slider
                label="Applied Force"
                value={params.appliedForce}
                min={-100}
                max={100}
                step={1}
                unit="N"
                onChange={(v) => updateParam({ appliedForce: v })}
                accent="emerald"
              />
              <Slider
                label="Static Friction (μs)"
                value={params.muS}
                min={0}
                max={1}
                step={0.05}
                onChange={(v) => updateParam({ muS: v, muK: Math.min(v, params.muK) })}
                accent="purple"
              />
            </div>
          </Panel>

          <Panel title="Mathematical Model" icon={Info}>
            <FormulaList
              formulas={[
                '\\sum \\vec{F} = m\\vec{a}',
                'F_g = mg(\\sin\\theta \\hat{i} - \\cos\\theta \\hat{j})',
                'F_n = \\max(0, -F_{g,y} - F_{app,y})',
                'F_f \\le \\mu_s F_n',
              ]}
            />
            <div className="mt-4 text-xs text-slate-400 space-y-3">
              <p>
                A <strong className="text-emerald-400">Free-Body Diagram</strong> isolates an object and shows all external forces acting upon it.
              </p>
              <p>
                The coordinate system used here is aligned with the incline: <strong className="text-sky-400">+x</strong> points up the slope, and <strong className="text-sky-400">+y</strong> is perpendicular to the surface.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </LabLayout>
  );
};

export default FreeBodyDiagramsPage;
