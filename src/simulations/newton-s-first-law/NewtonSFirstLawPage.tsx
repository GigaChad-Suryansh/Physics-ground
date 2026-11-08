import React, { useCallback, useRef, useState } from 'react';
import { Sliders, Gauge, Info } from 'lucide-react';
import { LabLayout } from '../../components/layout/LabLayout';
import { SimulationControls } from '../../components/controls/SimulationControls';
import { PhysicsChart } from '../../components/charts/PhysicsChart';
import { SimCanvas } from '../../components/canvas/SimCanvas';
import type { DrawFn } from '../../components/canvas/SimCanvas';
import { drawArrow, drawTag, fillGradient, glowDot, niceTicks } from '../../components/canvas/draw';
import { FormulaList, Panel, ReadoutBar, Badge } from '../../components/ui/Panel';
import { Slider } from '../../components/ui/Slider';
import { CANVAS_COLORS } from '../../components/ui/theme';
import { useSimulation } from '../../hooks/useSimulation';
import { useTelemetry } from '../../hooks/useTelemetry';
import { magnitude } from '../../physics/vector';
import {
  DEFAULT_NEWTONS_FIRST_LAW_PARAMS,
  stepSimulation,
  getFrictionalStoppingInfo,
  type NewtonsFirstLawParams,
  type NewtonsFirstLawState,
} from '../../physics/mechanics/newton-s-first-law';

const CANVAS_HEIGHT = 400;
const PX_PER_M = 25;
const DT = 1 / 60;

export const NewtonSFirstLawPage: React.FC = () => {
  const [params, setParams] = useState<NewtonsFirstLawParams>(DEFAULT_NEWTONS_FIRST_LAW_PARAMS);
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const [liveTime, setLiveTime] = useState(0);

  const initialSimState: NewtonsFirstLawState = {
    position: { ...params.initialPosition },
    velocity: { ...params.initialVelocity },
    acceleration: { x: 0, y: 0 },
    netForce: { x: 0, y: 0 },
    frictionForce: { x: 0, y: 0 },
    isAtRest: magnitude(params.initialVelocity) < 1e-6,
  };

  const [currentState, setCurrentState] = useState<NewtonsFirstLawState>(initialSimState);
  const stateRef = useRef<NewtonsFirstLawState>(currentState);
  stateRef.current = currentState;

  const telemetry = useTelemetry(1500, 4);

  const { state: simControlsState, play, pause, reset, step, setSpeed } = useSimulation({
    dt: DT,
    onStep: (dt) => {
      const nextTime = liveTime + dt;
      setLiveTime(nextTime);

      const nextState = stepSimulation(stateRef.current, paramsRef.current, dt);
      setCurrentState(nextState);
      stateRef.current = nextState;

      const vMag = magnitude(nextState.velocity);
      const fMag = magnitude(nextState.netForce);
      const aMag = magnitude(nextState.acceleration);

      telemetry.push({
        time: nextTime,
        speed: vMag,
        netForce: fMag,
        acceleration: aMag,
        vx: nextState.velocity.x,
      });
    },
    onReset: () => {
      setLiveTime(0);
      const resetState: NewtonsFirstLawState = {
        position: { ...paramsRef.current.initialPosition },
        velocity: { ...paramsRef.current.initialVelocity },
        acceleration: { x: 0, y: 0 },
        netForce: { x: 0, y: 0 },
        frictionForce: { x: 0, y: 0 },
        isAtRest: magnitude(paramsRef.current.initialVelocity) < 1e-6,
      };
      setCurrentState(resetState);
      stateRef.current = resetState;
      telemetry.clear();
    },
  });

  const updateParam = useCallback((patch: Partial<NewtonsFirstLawParams>) => {
    setParams((prev) => {
      const next = { ...prev, ...patch };
      paramsRef.current = next;
      return next;
    });
    reset();
  }, [reset]);

  const v0Mag = magnitude(params.initialVelocity);
  const stoppingInfo = getFrictionalStoppingInfo(v0Mag, params.frictionCoefficient, params.gravity);

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

    // Floor indicator line (for friction visualization context)
    const floorY = originY + 30;
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, floorY); ctx.lineTo(width, floorY); ctx.stroke();

    // Object position
    const currX = originX + currentState.position.x * PX_PER_M;
    const currY = originY - currentState.position.y * PX_PER_M;

    // Object body (puck / block)
    const boxSize = 24;
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.fillRect(currX - boxSize / 2, currY - boxSize / 2, boxSize, boxSize);
    ctx.strokeRect(currX - boxSize / 2, currY - boxSize / 2, boxSize, boxSize);

    glowDot(ctx, currX, currY, 4, '#38bdf8', 8);

    // Vector Visualization
    // 1. Velocity Vector (Green)
    const vScale = 10;
    if (magnitude(currentState.velocity) > 0.01) {
      const vEndX = currX + currentState.velocity.x * vScale;
      const vEndY = currY - currentState.velocity.y * vScale;
      drawArrow(ctx, currX, currY, vEndX, vEndY, '#10b981', { width: 3, head: 10 });
    }

    // 2. Applied Force Vector (Sky Blue)
    const fScale = 4;
    if (magnitude(params.appliedForce) > 0.01) {
      const fEndX = currX + params.appliedForce.x * fScale;
      const fEndY = currY - params.appliedForce.y * fScale;
      drawArrow(ctx, currX, currY, fEndX, fEndY, '#38bdf8', { width: 2.5, head: 8 });
    }

    // 3. Friction Force Vector (Rose)
    if (magnitude(currentState.frictionForce) > 0.01) {
      const fricEndX = currX + currentState.frictionForce.x * fScale;
      const fricEndY = currY - currentState.frictionForce.y * fScale;
      drawArrow(ctx, currX, currY, fricEndX, fricEndY, '#f43f5e', { width: 2.5, head: 8 });
    }

    // Tag
    const netFMag = magnitude(currentState.netForce);
    const speedMag = magnitude(currentState.velocity);
    const label = `v: ${speedMag.toFixed(2)} m/s, ΣF: ${netFMag.toFixed(2)} N`;
    drawTag(ctx, label, currX + 16, currY - 16, { color: netFMag === 0 ? '#10b981' : '#fbbf24' });
  };

  const netForceMag = magnitude(currentState.netForce);

  return (
    <LabLayout title="Newton's First Law (Law of Inertia)" category="Classical Mechanics">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <Panel
            title="Inertia & Force Interactive Playground"
            icon={Gauge}
            right={
              netForceMag === 0 ? (
                <Badge accent="emerald">Equilibrium (ΣF = 0)</Badge>
              ) : (
                <Badge accent="amber">Accelerating (ΣF ≠ 0)</Badge>
              )
            }
          >
            <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
              <SimCanvas height={CANVAS_HEIGHT} draw={draw} ariaLabel="Newton's first law canvas" />
            </div>

            <div className="mt-4">
              <SimulationControls
                state={simControlsState}
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
              { label: 'Velocity vₓ', value: `${currentState.velocity.x.toFixed(2)} m/s`, accent: 'emerald' },
              { label: 'Net Force ΣFₓ', value: `${currentState.netForce.x.toFixed(2)} N`, accent: 'amber' },
              { label: 'Friction F_fric', value: `${currentState.frictionForce.x.toFixed(2)} N`, accent: 'rose' },
              { label: 'Acceleration aₓ', value: `${currentState.acceleration.x.toFixed(2)} m/s²`, accent: 'sky' },
            ]}
          />

          <PhysicsChart
            data={telemetry.data}
            title="Velocity and Net Force vs Time"
            series={[
              { key: 'speed', name: 'Speed (m/s)', color: '#10b981', unit: 'm/s' },
              { key: 'netForce', name: 'Net Force (N)', color: '#fbbf24', unit: 'N', axis: 'right' },
              { key: 'acceleration', name: 'Acceleration (m/s²)', color: '#38bdf8', unit: 'm/s²', dashed: true },
            ]}
            xLabel="Time (s)"
            yLabel="Speed / Accel"
          />
        </div>

        <div className="lg:col-span-4 space-y-6">
          <Panel title="Controls & Environment" icon={Sliders}>
            <div className="space-y-5">
              <Slider
                label="Mass (m)"
                value={params.mass}
                min={0.5}
                max={10}
                step={0.5}
                unit="kg"
                onChange={(v) => updateParam({ mass: v })}
                accent="purple"
              />
              <Slider
                label="Initial Velocity (vₓ₀)"
                value={params.initialVelocity.x}
                min={-15}
                max={15}
                step={1}
                unit="m/s"
                onChange={(v) => updateParam({ initialVelocity: { x: v, y: 0 } })}
                accent="emerald"
              />
              <Slider
                label="Applied Force (Fₓ)"
                value={params.appliedForce.x}
                min={-20}
                max={20}
                step={1}
                unit="N"
                onChange={(v) => updateParam({ appliedForce: { x: v, y: 0 } })}
                accent="sky"
              />
              <Slider
                label="Friction Coeff. (μ)"
                value={params.frictionCoefficient}
                min={0}
                max={0.8}
                step={0.05}
                unit=""
                onChange={(v) => updateParam({ frictionCoefficient: v })}
                accent="rose"
              />
            </div>

            {params.frictionCoefficient > 0 && params.appliedForce.x === 0 && (
              <div className="mt-4 p-3 bg-slate-900/60 rounded-lg border border-slate-800 text-xs space-y-1">
                <div className="text-slate-300 font-semibold">Theoretical Stopping Values:</div>
                <div className="text-slate-400">
                  Time: <span className="text-sky-400">{isFinite(stoppingInfo.stopTime) ? `${stoppingInfo.stopTime.toFixed(2)} s` : 'N/A'}</span>
                </div>
                <div className="text-slate-400">
                  Distance: <span className="text-emerald-400">{isFinite(stoppingInfo.stopDistance) ? `${stoppingInfo.stopDistance.toFixed(2)} m` : 'N/A'}</span>
                </div>
              </div>
            )}
          </Panel>

          <Panel title="Law of Inertia" icon={Info}>
            <FormulaList
              formulas={[
                '\\sum \\vec{F} = 0 \\implies \\vec{a} = 0 \\implies \\vec{v} = \\text{constant}',
                '\\sum \\vec{F} = \\vec{F}_{app} + \\vec{F}_{fric} = m \\vec{a}',
                'F_{fric} = \\mu m g \\quad (\\text{opposing } \\vec{v})',
              ]}
            />
            <div className="mt-4 text-xs text-slate-400 space-y-3">
              <p>
                <strong className="text-emerald-400">First Law (Law of Inertia):</strong> An object remains at rest, or continues to move at a constant velocity in a straight line, unless acted upon by a net external force (ΣF ≠ 0).
              </p>
              <p>
                When <strong className="text-sky-400">ΣF = 0</strong> (zero applied force and zero friction), notice how the velocity stays strictly constant indefinitely!
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </LabLayout>
  );
};

export default NewtonSFirstLawPage;
