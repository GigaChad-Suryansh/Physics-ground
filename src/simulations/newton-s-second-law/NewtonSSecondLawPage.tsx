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
  calculateAcceleration,
  stepSimulation,
  DEFAULT_NEWTONS_SECOND_LAW_PARAMS,
  type NewtonsSecondLawParams,
  type NewtonsSecondLawState,
} from '../../physics/mechanics/newton-s-second-law';

const CANVAS_HEIGHT = 380;
const PX_PER_M = 30;
const DT = 1 / 60;

function getInitialState(params: NewtonsSecondLawParams): NewtonsSecondLawState {
  const { acceleration, netForce, frictionForce, normalForce } = calculateAcceleration(params, { x: 0, y: 0 });
  return {
    position: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    acceleration,
    netForce,
    frictionForce,
    normalForce,
  };
}

export const NewtonSSecondLawPage: React.FC = () => {
  const [params, setParams] = useState<NewtonsSecondLawParams>(DEFAULT_NEWTONS_SECOND_LAW_PARAMS);
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const [simState, setSimState] = useState<NewtonsSecondLawState>(() => getInitialState(DEFAULT_NEWTONS_SECOND_LAW_PARAMS));
  const stateRef = useRef(simState);
  stateRef.current = simState;

  const [liveTime, setLiveTime] = useState(0);
  const telemetry = useTelemetry(1500, 4);

  const { state: controlsState, play, pause, reset, step, setSpeed } = useSimulation({
    dt: DT,
    onStep: (dt) => {
      const nextTime = liveTime + dt;
      setLiveTime(nextTime);

      const nextState = stepSimulation(stateRef.current, paramsRef.current, dt);
      setSimState(nextState);

      telemetry.push({
        time: nextTime,
        acceleration: nextState.acceleration.x,
        velocity: nextState.velocity.x,
        netForce: nextState.netForce.x,
        position: nextState.position.x,
      });
    },
    onReset: () => {
      setLiveTime(0);
      const init = getInitialState(paramsRef.current);
      setSimState(init);
      telemetry.clear();
    },
  });

  const updateParam = useCallback((patch: Partial<NewtonsSecondLawParams>) => {
    setParams((prev) => {
      const next = { ...prev, ...patch };
      paramsRef.current = next;
      return next;
    });
    reset();
  }, [reset]);

  const draw: DrawFn = (ctx, width, height) => {
    const groundY = height - 80;
    const originX = 60;

    fillGradient(ctx, width, height, '#070b14', CANVAS_COLORS.bgDeep);

    // Grid ticks on floor
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    const xTicks = niceTicks(0, width / PX_PER_M, 10);
    xTicks.forEach((x) => {
      const sx = originX + x * PX_PER_M;
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, groundY);
      ctx.stroke();
    });

    // Ground line
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(width, groundY);
    ctx.stroke();

    // Ground hatch lines
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 15) {
      ctx.beginPath();
      ctx.moveTo(x, groundY);
      ctx.lineTo(x - 10, groundY + 12);
      ctx.stroke();
    }

    const currentState = stateRef.current;
    const currentParams = paramsRef.current;

    // Block dimensions based on mass
    const blockWidth = 50 + Math.min(30, currentParams.mass * 3);
    const blockHeight = 40 + Math.min(20, currentParams.mass * 2);

    // Loop position around canvas if it moves beyond width
    const viewPortWidth = width - 120;
    const renderPosX = (currentState.position.x * PX_PER_M) % Math.max(100, viewPortWidth);
    const blockCenterX = originX + renderPosX + blockWidth / 2;
    const blockCenterY = groundY - blockHeight / 2;

    // Draw Block
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(
      blockCenterX - blockWidth / 2,
      blockCenterY - blockHeight / 2,
      blockWidth,
      blockHeight,
      6
    );
    ctx.fill();
    ctx.stroke();

    // Mass Label inside block
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${currentParams.mass.toFixed(1)} kg`, blockCenterX, blockCenterY);

    // Vector Force Scale
    const forceScale = 2.5;

    // Applied Force Vector (Green)
    if (Math.abs(currentParams.appliedForce.x) > 0.01) {
      const fxEnd = blockCenterX + currentParams.appliedForce.x * forceScale;
      drawArrow(ctx, blockCenterX, blockCenterY, fxEnd, blockCenterY, '#10b981', { width: 3, head: 10 });
      drawTag(ctx, `F_app = ${currentParams.appliedForce.x.toFixed(1)} N`, fxEnd + (currentParams.appliedForce.x >= 0 ? 10 : -70), blockCenterY - 15, { color: '#10b981' });
    }

    // Friction Force Vector (Amber)
    if (Math.abs(currentState.frictionForce.x) > 0.01) {
      const fffEnd = blockCenterX + currentState.frictionForce.x * forceScale;
      drawArrow(ctx, blockCenterX, blockCenterY + 12, fffEnd, blockCenterY + 12, '#f59e0b', { width: 3, head: 8 });
      drawTag(ctx, `F_f = ${Math.abs(currentState.frictionForce.x).toFixed(1)} N`, fffEnd - 60, blockCenterY + 25, { color: '#f59e0b' });
    }

    // Velocity Tag
    glowDot(ctx, blockCenterX, blockCenterY, 4, '#38bdf8', 8);
    drawTag(
      ctx,
      `v = ${currentState.velocity.x.toFixed(2)} m/s | a = ${currentState.acceleration.x.toFixed(2)} m/s²`,
      blockCenterX - 70,
      blockCenterY - blockHeight / 2 - 25,
      { color: '#38bdf8' }
    );
  };

  return (
    <LabLayout title="Newton's Second Law" category="Mechanics & Kinematics">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <Panel title="Force & Acceleration Dynamics" icon={Gauge}>
            <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
              <SimCanvas height={CANVAS_HEIGHT} draw={draw} ariaLabel="Newton's second law simulation" />
            </div>

            <div className="mt-4">
              <SimulationControls
                state={controlsState}
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
              { label: 'Applied Force', value: `${params.appliedForce.x.toFixed(1)} N`, accent: 'emerald' },
              { label: 'Net Force', value: `${simState.netForce.x.toFixed(2)} N`, accent: 'sky' },
              { label: 'Acceleration', value: `${simState.acceleration.x.toFixed(2)} m/s²`, accent: 'amber' },
              { label: 'Velocity', value: `${simState.velocity.x.toFixed(2)} m/s`, accent: 'purple' },
              { label: 'Position', value: `${simState.position.x.toFixed(2)} m` },
            ]}
          />

          <PhysicsChart
            data={telemetry.data}
            title="Kinematics & Dynamics vs Time"
            series={[
              { key: 'acceleration', name: 'Acceleration', color: '#f59e0b', unit: 'm/s²' },
              { key: 'velocity', name: 'Velocity', color: '#38bdf8', unit: 'm/s' },
              { key: 'netForce', name: 'Net Force', color: '#10b981', unit: 'N', dashed: true },
            ]}
            xLabel="Time (s)"
            yLabel="Value"
          />
        </div>

        <div className="lg:col-span-4 space-y-6">
          <Panel title="Simulation Parameters" icon={Sliders}>
            <div className="space-y-5">
              <Slider
                label="Applied Horizontal Force (F_app)"
                value={params.appliedForce.x}
                min={0}
                max={50}
                step={1}
                unit="N"
                onChange={(v) => updateParam({ appliedForce: { x: v, y: params.appliedForce.y } })}
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
                accent="sky"
              />
              <Slider
                label="Friction Coefficient (μ)"
                value={params.frictionCoefficient}
                min={0}
                max={0.8}
                step={0.05}
                onChange={(v) => updateParam({ frictionCoefficient: v })}
                accent="amber"
              />
              <Slider
                label="Gravity (g)"
                value={params.gravity}
                min={0}
                max={20}
                step={0.5}
                unit="m/s²"
                onChange={(v) => updateParam({ gravity: v })}
                accent="purple"
              />
            </div>
          </Panel>

          <Panel title="Newton's 2nd Law (F = ma)" icon={Info}>
            <FormulaList
              formulas={[
                '\\vec{F}_{net} = m \\vec{a}',
                '\\vec{a} = \\frac{\\vec{F}_{net}}{m}',
                'F_f = \\mu N = \\mu (m g - F_{app,y})',
                'F_{net,x} = F_{app,x} - F_f',
              ]}
            />
            <div className="mt-4 text-xs text-slate-400 space-y-3">
              <p>
                <strong className="text-emerald-400">Direct Proportionality:</strong> Acceleration is directly proportional to the net force applied. Doubling net force doubles acceleration.
              </p>
              <p>
                <strong className="text-sky-400">Inverse Proportionality:</strong> Acceleration is inversely proportional to mass. Increasing mass decreases acceleration for a given net force.
              </p>
              <p className="p-2 bg-slate-900/50 rounded border border-slate-800">
                <em className="text-amber-400">Friction threshold:</em> If applied force is less than maximum static friction ($F_f = \mu N$), the net force is zero and the block remains static.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </LabLayout>
  );
};

export default NewtonSSecondLawPage;
