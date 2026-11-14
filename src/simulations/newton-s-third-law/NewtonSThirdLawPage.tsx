import React, { useCallback, useRef, useState } from 'react';
import { Sliders, Gauge, Info } from 'lucide-react';
import { LabLayout } from '../../components/layout/LabLayout';
import { SimulationControls } from '../../components/controls/SimulationControls';
import { PhysicsChart } from '../../components/charts/PhysicsChart';
import { SimCanvas } from '../../components/canvas/SimCanvas';
import type { DrawFn } from '../../components/canvas/SimCanvas';
import { drawArrow, drawTag, fillGradient, niceTicks } from '../../components/canvas/draw';
import { FormulaList, Panel, ReadoutBar } from '../../components/ui/Panel';
import { Slider } from '../../components/ui/Slider';
import { CANVAS_COLORS } from '../../components/ui/theme';
import { useSimulation } from '../../hooks/useSimulation';
import { useTelemetry } from '../../hooks/useTelemetry';
import {
  type NewtonThirdLawParams,
  type NewtonThirdLawState,
  calculateContactSystem1D,
  stepThirdLawSystem,
} from '../../physics/mechanics/newton-s-third-law';

const CANVAS_HEIGHT = 400;
const PX_PER_M = 30;
const DT = 1 / 60;

const INITIAL_STATE: NewtonThirdLawState = {
  position1: { x: -2, y: 0 },
  velocity1: { x: 0, y: 0 },
  position2: { x: 2, y: 0 },
  velocity2: { x: 0, y: 0 },
  force12: { x: 0, y: 0 },
  force21: { x: 0, y: 0 },
  time: 0,
};

export const NewtonSThirdLawPage: React.FC = () => {
  const [params, setParams] = useState<NewtonThirdLawParams>({
    m1: 2,
    m2: 4,
    externalForce1: { x: 12, y: 0 },
    externalForce2: { x: 0, y: 0 },
    interactionForceMagnitude: 10,
  });

  const [simState, setSimState] = useState<NewtonThirdLawState>(INITIAL_STATE);
  const stateRef = useRef<NewtonThirdLawState>(simState);
  stateRef.current = simState;

  const paramsRef = useRef<NewtonThirdLawParams>(params);
  paramsRef.current = params;

  const telemetry = useTelemetry(1500, 4);

  const { state: controlsState, play, pause, reset, step, setSpeed } = useSimulation({
    dt: DT,
    onStep: (dt) => {
      const nextState = stepThirdLawSystem(stateRef.current, paramsRef.current, dt);
      setSimState(nextState);
      telemetry.push({
        time: nextState.time,
        f12_x: nextState.force12.x,
        f21_x: nextState.force21.x,
        v1_x: nextState.velocity1.x,
        v2_x: nextState.velocity2.x,
      });
    },
    onReset: () => {
      setSimState(INITIAL_STATE);
      telemetry.clear();
    },
  });

  const updateParam = useCallback((patch: Partial<NewtonThirdLawParams>) => {
    setParams((prev) => {
      const next = { ...prev, ...patch };
      paramsRef.current = next;
      return next;
    });
    reset();
  }, [reset]);

  const contactInfo = calculateContactSystem1D(params.m1, params.m2, params.externalForce1.x);

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

    // Axis / Floor
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, originY + 40);
    ctx.lineTo(width, originY + 40);
    ctx.stroke();

    const curr = stateRef.current;
    const p1X = originX + curr.position1.x * PX_PER_M;
    const p1Y = originY - curr.position1.y * PX_PER_M + 10;
    const p2X = originX + curr.position2.x * PX_PER_M;
    const p2Y = originY - curr.position2.y * PX_PER_M + 10;

    const r1 = Math.max(16, Math.min(36, 12 + params.m1 * 4));
    const r2 = Math.max(16, Math.min(36, 12 + params.m2 * 4));

    // Draw Mass 1 Block/Circle
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(p1X, p1Y, r1, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`m1 (${params.m1}kg)`, p1X, p1Y);

    // Draw Mass 2 Block/Circle
    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.arc(p2X, p2Y, r2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e11d48';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.fillText(`m2 (${params.m2}kg)`, p2X, p2Y);

    // Draw Force Vectors
    // External Force 1
    if (Math.abs(params.externalForce1.x) > 0.1) {
      const fScale = 4;
      drawArrow(ctx, p1X - r1 - params.externalForce1.x * fScale, p1Y, p1X - r1, p1Y, '#38bdf8', {
        width: 3,
        head: 10,
      });
      drawTag(ctx, `F_ext1 = ${params.externalForce1.x.toFixed(1)} N`, p1X - r1 - 10, p1Y - 25, {
        color: '#38bdf8',
      });
    }

    // Interaction Forces F12 and F21
    const f12x = curr.force12.x;
    const f21x = curr.force21.x;
    const arrowScale = 4;

    if (Math.abs(f12x) > 0.01) {
      // Force by 1 on 2 (acting on 2)
      drawArrow(ctx, p2X, p2Y, p2X + f12x * arrowScale, p2Y, '#fbbf24', { width: 3, head: 10 });
      drawTag(ctx, `F_12 = ${f12x.toFixed(1)} N`, p2X + 10, p2Y - r2 - 15, { color: '#fbbf24' });

      // Force by 2 on 1 (acting on 1)
      drawArrow(ctx, p1X, p1Y, p1X + f21x * arrowScale, p1Y, '#a855f7', { width: 3, head: 10 });
      drawTag(ctx, `F_21 = ${f21x.toFixed(1)} N`, p1X - 10, p1Y - r1 - 15, { color: '#a855f7' });
    }
  };

  return (
    <LabLayout title="Newton's Third Law" category="Classical Mechanics">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <Panel title="Action & Reaction Force Simulation" icon={Gauge}>
            <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
              <SimCanvas height={CANVAS_HEIGHT} draw={draw} ariaLabel="Newton's third law simulation" />
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
              { label: 'Force F12 (on m2)', value: `${simState.force12.x.toFixed(2)} N`, accent: 'amber' },
              { label: 'Force F21 (on m1)', value: `${simState.force21.x.toFixed(2)} N`, accent: 'purple' },
              { label: 'Contact a (1D)', value: `${contactInfo.acceleration.toFixed(2)} m/s²`, accent: 'sky' },
              { label: 'Contact F12', value: `${contactInfo.force12.toFixed(2)} N`, accent: 'emerald' },
            ]}
          />

          <PhysicsChart
            data={telemetry.data}
            title="Action and Reaction Forces Over Time"
            series={[
              { key: 'f12_x', name: 'F_12 (1 on 2)', color: '#fbbf24', unit: 'N' },
              { key: 'f21_x', name: 'F_21 (2 on 1)', color: '#a855f7', unit: 'N', dashed: true },
              { key: 'v1_x', name: 'v_1', color: '#38bdf8', unit: 'm/s' },
              { key: 'v2_x', name: 'v_2', color: '#f43f5e', unit: 'm/s' },
            ]}
            xLabel="Time (s)"
            yLabel="Value"
          />
        </div>

        <div className="lg:col-span-4 space-y-6">
          <Panel title="System Parameters" icon={Sliders}>
            <div className="space-y-5">
              <Slider
                label="Mass 1 (m1)"
                value={params.m1}
                min={0.5}
                max={10}
                step={0.5}
                unit="kg"
                onChange={(v) => updateParam({ m1: v })}
                accent="sky"
              />
              <Slider
                label="Mass 2 (m2)"
                value={params.m2}
                min={0.5}
                max={10}
                step={0.5}
                unit="kg"
                onChange={(v) => updateParam({ m2: v })}
                accent="rose"
              />
              <Slider
                label="External Force on m1 (F_ext1)"
                value={params.externalForce1.x}
                min={0}
                max={30}
                step={1}
                unit="N"
                onChange={(v) => updateParam({ externalForce1: { x: v, y: 0 } })}
                accent="emerald"
              />
              <Slider
                label="Mutual Interaction Force Magnitude"
                value={params.interactionForceMagnitude}
                min={-20}
                max={20}
                step={1}
                unit="N"
                onChange={(v) => updateParam({ interactionForceMagnitude: v })}
                accent="amber"
              />
            </div>
          </Panel>

          <Panel title="Newton's Third Law Principles" icon={Info}>
            <FormulaList
              formulas={[
                '\\vec{F}_{A \\to B} = -\\vec{F}_{B \\to A}',
                'a_{sys} = \\frac{F_{ext}}{m_1 + m_2}',
                'F_{contact} = m_2 \\cdot a_{sys}',
              ]}
            />
            <div className="mt-4 text-xs text-slate-400 space-y-3">
              <p>
                <strong className="text-amber-400">Action and Reaction:</strong> Whenever one body exerts a force on a second body, the second body simultaneously exerts a force equal in magnitude and opposite in direction on the first body.
              </p>
              <p>
                <strong className="text-purple-400">Force Pairs:</strong> Note that action-reaction force pairs act on <em>different</em> objects, so they never cancel each other out on a single object.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </LabLayout>
  );
};

export default NewtonSThirdLawPage;
