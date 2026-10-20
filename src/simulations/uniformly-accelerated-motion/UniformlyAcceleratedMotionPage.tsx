import React, { useCallback, useRef, useState } from 'react';
import { Sliders, Gauge, Info, Ruler } from 'lucide-react';
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
  getUAMState,
  DEFAULT_UAM_PARAMS,
  type UAMParams,
  type MotionScenario,
} from '../../physics/mechanics/uniformly-accelerated-motion';

const CANVAS_HEIGHT = 400;
const PX_PER_M = 30;
const DT = 1 / 60;

export const UniformlyAcceleratedMotionPage: React.FC = () => {
  const [params, setParams] = useState<UAMParams>(DEFAULT_UAM_PARAMS);
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const [liveTime, setLiveTime] = useState(0);
  const telemetry = useTelemetry(1500, 4);

  const { state: simState, play, pause, reset, step, setSpeed } = useSimulation({
    dt: DT,
    onStep: (dt) => {
      const t = liveTime + dt;
      setLiveTime(t);

      const state = getUAMState(t, paramsRef.current);
      telemetry.push({
        time: t,
        speed: state.speed,
        disp: state.displacement,
        accel: state.effectiveAccel,
        vx: state.velocity.x,
        vy: state.velocity.y,
        ax: state.acceleration.x,
        ay: state.acceleration.y,
      });
    },
    onReset: () => {
      setLiveTime(0);
      telemetry.clear();
    },
  });

  const updateParam = useCallback((patch: Partial<UAMParams>) => {
    setParams((prev) => {
      const next = { ...prev, ...patch };
      paramsRef.current = next;
      return next;
    });
    reset();
  }, [reset]);

  const currentState = getUAMState(liveTime, params);

  const draw: DrawFn = (ctx, width, height) => {
    const originX = params.scenario === 'horizontal' ? 50 : width / 2;
    const originY = params.scenario === 'freefall' ? 50 : (params.scenario === 'ramp' ? height - 50 : height / 2);

    fillGradient(ctx, width, height, '#070b14', CANVAS_COLORS.bgDeep);

    // Draw Scenario Specific Background
    if (params.scenario === 'ramp') {
      const rad = (params.rampAngle * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      ctx.lineTo(originX + 1000 * Math.cos(rad), originY - 1000 * Math.sin(rad));
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 4;
      ctx.stroke();
      
      // Draw ground
      ctx.beginPath();
      ctx.moveTo(0, originY);
      ctx.lineTo(width, originY);
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (params.scenario === 'horizontal') {
      ctx.beginPath();
      ctx.moveTo(0, originY + 15);
      ctx.lineTo(width, originY + 15);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 4;
      ctx.stroke();
    }

    // Grid (light)
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.5)';
    ctx.lineWidth = 1;
    const xTicks = niceTicks(0, width / PX_PER_M, 10);
    xTicks.forEach(x => {
      const sx = originX + x * PX_PER_M;
      ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, height); ctx.stroke();
    });

    // Object position
    const currX = originX + currentState.position.x * PX_PER_M;
    const currY = originY - currentState.position.y * PX_PER_M;

    // Ghost path
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    for (let t = 0; t <= 10; t += 0.2) {
      const p = getUAMState(t, params).position;
      const tx = originX + p.x * PX_PER_M;
      const ty = originY - p.y * PX_PER_M;
      if (t === 0) ctx.moveTo(tx, ty); else ctx.lineTo(tx, ty);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Velocity Vector (Green)
    const vScale = 0.5;
    drawArrow(ctx, currX, currY, currX + currentState.velocity.x * PX_PER_M * vScale, currY - currentState.velocity.y * PX_PER_M * vScale, '#10b981', { width: 2, head: 8 });

    // Acceleration Vector (Rose)
    const aScale = 0.5;
    drawArrow(ctx, currX, currY, currX + currentState.acceleration.x * PX_PER_M * aScale, currY - currentState.acceleration.y * PX_PER_M * aScale, '#f43f5e', { width: 2.5, head: 10 });

    // Object
    glowDot(ctx, currX, currY, 8, '#38bdf8', 12);
    
    // Tag
    drawTag(ctx, `s = ${currentState.displacement.toFixed(1)} m`, currX + 12, currY - 12, { color: '#e2e8f0' });
  };

  return (
    <LabLayout title="Uniformly Accelerated Motion" category="Classical Mechanics">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <Panel title="Kinematics Visualization" icon={Gauge}>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {(['horizontal', 'freefall', 'ramp'] as MotionScenario[]).map((m) => (
                <button
                  key={m}
                  onClick={() => updateParam({ scenario: m })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                    params.scenario === m
                      ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/25'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
              <SimCanvas height={CANVAS_HEIGHT} draw={draw} ariaLabel="UAM simulation canvas" />
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
              { label: 'Displacement', value: `${currentState.displacement.toFixed(2)} m`, accent: 'sky' },
              { label: 'Velocity', value: `${currentState.speed.toFixed(2)} m/s`, accent: 'emerald' },
              { label: 'Acceleration', value: `${currentState.effectiveAccel.toFixed(2)} m/s²`, accent: 'rose' },
              { label: 'v² Diff', value: currentState.vSquaredDiff.toExponential(2), accent: 'amber' },
            ]}
          />

          <PhysicsChart
            data={telemetry.data}
            title="UAM Kinematics"
            series={[
              { key: 'disp', name: 'Displacement (s)', color: '#38bdf8', unit: 'm' },
              { key: 'speed', name: 'Velocity (v)', color: '#10b981', unit: 'm/s' },
              { key: 'accel', name: 'Acceleration (a)', color: '#f43f5e', unit: 'm/s²', axis: 'right' },
            ]}
            xLabel="Time (s)"
          />
        </div>

        <div className="lg:col-span-4 space-y-6">
          <Panel title="Simulation Parameters" icon={Sliders}>
            <div className="space-y-5">
              <Slider
                label="Initial Position"
                value={params.initialPosition}
                min={0}
                max={10}
                step={0.5}
                unit="m"
                onChange={(v) => updateParam({ initialPosition: v })}
                accent="sky"
              />
              <Slider
                label="Initial Velocity"
                value={params.initialVelocity}
                min={-10}
                max={10}
                step={0.5}
                unit="m/s"
                onChange={(v) => updateParam({ initialVelocity: v })}
                accent="emerald"
              />
              
              {params.scenario === 'horizontal' && (
                <Slider
                  label="Acceleration"
                  value={params.acceleration}
                  min={-5}
                  max={5}
                  step={0.1}
                  unit="m/s²"
                  onChange={(v) => updateParam({ acceleration: v })}
                  accent="rose"
                />
              )}

              {(params.scenario === 'freefall' || params.scenario === 'ramp') && (
                <Slider
                  label="Gravity (g)"
                  value={params.gravity}
                  min={0}
                  max={20}
                  step={0.1}
                  unit="m/s²"
                  onChange={(v) => updateParam({ gravity: v })}
                  accent="rose"
                />
              )}

              {params.scenario === 'ramp' && (
                <>
                  <Slider
                    label="Ramp Angle"
                    value={params.rampAngle}
                    min={0}
                    max={90}
                    step={1}
                    unit="°"
                    onChange={(v) => updateParam({ rampAngle: v })}
                    accent="amber"
                  />
                  <Slider
                    label="Friction Coeff (μ)"
                    value={params.frictionCoeff}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(v) => updateParam({ frictionCoeff: v })}
                    accent="amber"
                  />
                </>
              )}
            </div>
          </Panel>

          <Panel title="SUVAT Equations" icon={Info}>
            <FormulaList
              formulas={[
                'v = v_0 + at',
                's = v_0t + \\frac{1}{2}at^2',
                'v^2 = v_0^2 + 2as',
                's = \\frac{v_0 + v}{2}t',
              ]}
            />
          </Panel>
          
          <Panel title="Ramp Acceleration" icon={Ruler}>
             <FormulaList
              formulas={[
                'a_{ramp} = g(\\sin\\theta - \\mu\\cos\\theta)',
              ]}
            />
          </Panel>
        </div>
      </div>
    </LabLayout>
  );
};

export default UniformlyAcceleratedMotionPage;
