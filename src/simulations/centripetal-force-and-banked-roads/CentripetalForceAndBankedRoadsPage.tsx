import React, { useCallback, useMemo, useState } from 'react';
import { Sliders, Gauge, Info } from 'lucide-react';
import { LabLayout } from '../../components/layout/LabLayout';
import { SimulationControls } from '../../components/controls/SimulationControls';
import { PhysicsChart } from '../../components/charts/PhysicsChart';
import { SimCanvas } from '../../components/canvas/SimCanvas';
import type { DrawFn } from '../../components/canvas/SimCanvas';
import { drawArrow, drawTag, fillGradient, glowDot } from '../../components/canvas/draw';
import { FormulaList, Panel, ReadoutBar, Badge } from '../../components/ui/Panel';
import { Slider } from '../../components/ui/Slider';
import { CANVAS_COLORS } from '../../components/ui/theme';
import { useSimulation } from '../../hooks/useSimulation';
import { useTelemetry } from '../../hooks/useTelemetry';
import {
  calculateBankedRoadState,
  DEFAULT_BANKED_ROAD_PARAMS,
  type BankedRoadParams,
} from '../../physics/mechanics/centripetal-force-and-banked-roads';

const CANVAS_HEIGHT = 400;

export const CentripetalForceAndBankedRoadsPage: React.FC = () => {
  const [params, setParams] = useState<BankedRoadParams>(DEFAULT_BANKED_ROAD_PARAMS);
  const telemetry = useTelemetry(1500, 4);

  const { state: simState, play, pause, reset, step, setSpeed } = useSimulation({
    dt: 1 / 60,
    onStep: (dt, totalTime) => {
      const physics = calculateBankedRoadState(params);
      telemetry.push({
        time: totalTime,
        requiredFriction: physics.requiredFrictionForce,
        maxFriction: physics.maxFrictionForce,
        isSliding: physics.isSliding ? 1 : 0,
      });
    },
    onReset: () => {
      telemetry.clear();
    },
  });

  const physics = useMemo(() => calculateBankedRoadState(params), [params]);

  const updateParam = useCallback((patch: Partial<BankedRoadParams>) => {
    setParams((prev) => ({ ...prev, ...patch }));
  }, []);

  const draw: DrawFn = (ctx, width, height) => {
    const originX = width / 2;
    const originY = height * 0.7;

    fillGradient(ctx, width, height, '#070b14', CANVAS_COLORS.bgDeep);

    const angleRad = physics.bankAngleRad;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);

    // Draw Ground/Base
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, originY);
    ctx.lineTo(width, originY);
    ctx.stroke();

    // Draw Banked Road Surface
    const roadLength = 300;
    const rx0 = originX - (roadLength / 2) * cos;
    const ry0 = originY + (roadLength / 2) * sin;
    const rx1 = originX + (roadLength / 2) * cos;
    const ry1 = originY - (roadLength / 2) * sin;

    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(rx0, ry0);
    ctx.lineTo(rx1, ry1);
    ctx.stroke();

    // Vehicle position (center of road cross-section)
    const vx = originX;
    const vy = originY;

    // Draw Force Arrows
    const forceScale = 0.05; // 1N = 0.05px

    // Gravity (using 9.81 for visual consistency with physics module g_EARTH)
    const gForce = params.mass * 9.81;
    drawArrow(ctx, vx, vy, vx, vy + gForce * forceScale, '#f43f5e', { width: 3, head: 10 });
    drawTag(ctx, 'mg', vx, vy + gForce * forceScale + 15, { color: '#f43f5e', align: 'center' });

    // Normal Force
    const nx = vx - physics.normalForce * sin * forceScale;
    const ny = vy - physics.normalForce * cos * forceScale;
    drawArrow(ctx, vx, vy, nx, ny, '#38bdf8', { width: 3, head: 10 });
    drawTag(ctx, 'N', nx, ny - 15, { color: '#38bdf8', align: 'center' });

    // Friction Force
    const frictionMag = physics.requiredFrictionForce;
    const slopeParallelDiff = params.mass * physics.centripetalAccel * cos - params.mass * 9.81 * sin;
    
    // If slopeParallelDiff > 0, it wants to slide OUTWARD (up slope), so friction is DOWN slope.
    // Down slope = towards (rx0, ry0) which is left-down.
    const frictionDir = slopeParallelDiff > 0 ? -1 : 1; 
    const fx = vx + frictionMag * cos * frictionDir * forceScale;
    const fy = vy - frictionMag * sin * frictionDir * forceScale;
    
    if (frictionMag > 5) { // Only draw if significant
      drawArrow(ctx, vx, vy, fx, fy, '#fbbf24', { width: 3, head: 10 });
      drawTag(ctx, 'f_s', fx, fy - 15, { color: '#fbbf24', align: frictionDir > 0 ? 'left' : 'right' });
    }

    // Centripetal force requirement (visualized as a horizontal dashed arrow)
    const fcx = vx - physics.centripetalForce * forceScale;
    drawArrow(ctx, vx, vy, fcx, vy, '#10b981', { width: 2, head: 8, dash: [4, 4] });
    drawTag(ctx, 'F_c', fcx - 10, vy, { color: '#10b981', align: 'right' });

    // Vehicle
    glowDot(ctx, vx, vy, 12, physics.isSliding ? '#f43f5e' : '#6366f1', 20);
    
    if (physics.isSliding) {
        drawTag(ctx, `SLIDING ${physics.slideDirection.toUpperCase()}!`, vx, vy - 40, { color: '#f43f5e', bg: 'rgba(0,0,0,0.8)' });
    }
  };

  return (
    <LabLayout title="Centripetal Force & Banked Roads" category="Classical Mechanics">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <Panel title="Force Analysis (Cross-section)" icon={Gauge}>
            <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
              <SimCanvas height={CANVAS_HEIGHT} draw={draw} ariaLabel="Banked road cross-section simulation" />
            </div>

            <div className="mt-4">
              <SimulationControls
                state={simState}
                onPlay={play}
                onPause={pause}
                onReset={reset}
                onStep={step}
                onSpeedChange={setSpeed}
                extra={
                  physics.isSliding ? (
                    <Badge accent="rose">Sliding: {physics.slideDirection}</Badge>
                  ) : (
                    <Badge accent="emerald">Stable</Badge>
                  )
                }
              />
            </div>
          </Panel>

          <ReadoutBar
            items={[
              { label: 'Ideal Speed', value: `${physics.idealSpeed.toFixed(1)} m/s`, accent: 'sky' },
              { label: 'Min/Max Speed', value: `${physics.minSpeed.toFixed(1)} - ${physics.maxSpeed === Infinity ? '∞' : physics.maxSpeed.toFixed(1)} m/s`, accent: 'amber' },
              { label: 'Friction Needed', value: `${physics.requiredFrictionForce.toFixed(0)} N`, accent: physics.isSliding ? 'rose' : 'emerald' },
              { label: 'Normal Force', value: `${physics.normalForce.toFixed(0)} N` },
            ]}
          />

          <PhysicsChart
            data={telemetry.data}
            title="Friction Forces"
            series={[
              { key: 'requiredFriction', name: 'Required Friction', color: '#fbbf24', unit: 'N' },
              { key: 'maxFriction', name: 'Max Static Friction', color: '#38bdf8', unit: 'N', dashed: true },
            ]}
            xLabel="Time (s)"
            yLabel="Force (N)"
          />
        </div>

        <div className="lg:col-span-4 space-y-6">
          <Panel title="Simulation Parameters" icon={Sliders}>
            <div className="space-y-5">
              <Slider
                label="Vehicle Speed"
                value={params.speed}
                min={0}
                max={60}
                step={1}
                unit="m/s"
                onChange={(v) => updateParam({ speed: v })}
                accent="emerald"
              />
              <Slider
                label="Bank Angle"
                value={params.bankAngleDeg}
                min={0}
                max={45}
                step={1}
                unit="°"
                onChange={(v) => updateParam({ bankAngleDeg: v })}
                accent="sky"
              />
              <Slider
                label="Curve Radius"
                value={params.radius}
                min={10}
                max={500}
                step={10}
                unit="m"
                onChange={(v) => updateParam({ radius: v })}
                accent="purple"
              />
              <Slider
                label="Friction Coeff (μs)"
                value={params.frictionCoeff}
                min={0}
                max={1.0}
                step={0.05}
                onChange={(v) => updateParam({ frictionCoeff: v })}
                accent="amber"
              />
              <Slider
                label="Vehicle Mass"
                value={params.mass}
                min={500}
                max={3000}
                step={100}
                unit="kg"
                onChange={(v) => updateParam({ mass: v })}
                accent="indigo"
              />
            </div>
          </Panel>

          <Panel title="Physics Principles" icon={Info}>
            <FormulaList
              formulas={[
                'F_c = \\frac{m v^2}{R}',
                'v_{ideal} = \\sqrt{g R \\tan(\\theta)}',
                'N = mg \\cos\\theta + F_c \\sin\\theta',
                'f_s = |F_c \\cos\\theta - mg \\sin\\theta|',
                'f_{max} = \\mu_s N',
              ]}
            />
            <div className="mt-4 text-xs text-slate-400 space-y-3">
              <p>
                A <strong className="text-emerald-400">banked road</strong> uses the normal force to provide part of the necessary centripetal force.
              </p>
              <p>
                At the <strong className="text-sky-400">ideal speed</strong>, the horizontal component of the normal force exactly equals the required centripetal force, and no friction is needed.
              </p>
              <p className="p-2 bg-slate-900/50 rounded border border-slate-800">
                If the vehicle goes faster than the ideal speed, it tends to slide <em className="text-amber-400">outward</em> (up the slope). If it goes slower, it tends to slide <em className="text-amber-400">inward</em> (down the slope).
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </LabLayout>
  );
};

export default CentripetalForceAndBankedRoadsPage;
