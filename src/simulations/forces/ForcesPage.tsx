import React, { useRef, useEffect, useState, useCallback } from 'react';
import { LabLayout } from '../../components/layout/LabLayout';
import { SimulationControls } from '../../components/controls/SimulationControls';
import { PhysicsChart, DataPoint } from '../../components/charts/PhysicsChart';
import { MathFormula } from '../../components/ui/MathFormula';
import { useSimulation } from '../../hooks/useSimulation';
import {
  ForcesParams,
  ForcesState,
  DEFAULT_FORCES_PARAMS,
  createInitialForcesState,
  calculateForces,
  stepForces,
} from '../../physics/mechanics/forces';
import { Sliders, Activity, Info, ArrowRight } from 'lucide-react';

export const ForcesPage: React.FC = () => {
  const [params, setParams] = useState<ForcesParams>(DEFAULT_FORCES_PARAMS);
  const stateRef = useRef<ForcesState>(createInitialForcesState(DEFAULT_FORCES_PARAMS));
  const [liveState, setLiveState] = useState<ForcesState>(stateRef.current);
  const [chartData, setChartData] = useState<DataPoint[]>([]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Derived force breakdown
  const forces = calculateForces(params, liveState.velocity);

  const { state: simState, play, pause, reset, step, setSpeed } = useSimulation({
    dt: 1 / 120,
    onStep: (dt) => {
      const nextState = stepForces(stateRef.current, params, dt);
      stateRef.current = nextState;
      setLiveState({ ...nextState });

      setChartData((prev) => [
        ...prev,
        {
          time: nextState.time,
          position: nextState.position,
          velocity: nextState.velocity,
          acceleration: nextState.acceleration,
        },
      ]);
    },
    onReset: () => {
      const init = createInitialForcesState(params);
      stateRef.current = init;
      setLiveState(init);
      setChartData([]);
    },
  });

  const handleParamChange = (newParams: Partial<ForcesParams>) => {
    setParams((prev) => {
      const updated = { ...prev, ...newParams };
      if (simState.status !== 'running') {
        const init = createInitialForcesState(updated);
        stateRef.current = init;
        setLiveState(init);
        setChartData([]);
      }
      return updated;
    });
  };

  // Canvas visual rendering
  const drawForces = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, width, height);

    // Ground level
    const groundY = height * 0.72;
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(width, groundY);
    ctx.stroke();

    // Floor surface hatching to indicate friction
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, groundY);
      ctx.lineTo(x - 8, groundY + 12);
      ctx.stroke();
    }

    // Block dimensions & position (wrap horizontally for continuous lab view)
    const blockWidth = 70;
    const blockHeight = 50;
    const blockX = ((width * 0.5 + liveState.position * 15) % (width - 140)) + 70;
    const blockY = groundY - blockHeight;

    // Draw Block
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(blockX - blockWidth / 2, blockY, blockWidth, blockHeight, 6);
    ctx.fill();
    ctx.stroke();

    // Block label
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`m = ${params.mass} kg`, blockX, blockY + blockHeight / 2 + 4);

    // Vector drawing helper
    const drawVector = (
      startX: number,
      startY: number,
      dx: number,
      dy: number,
      color: string,
      label: string
    ) => {
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      const endX = startX + dx;
      const endY = startY + dy;

      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 2.5;

      // Line
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      // Arrow head
      const angle = Math.atan2(dy, dx);
      const headLen = 8;
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(
        endX - headLen * Math.cos(angle - Math.PI / 6),
        endY - headLen * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        endX - headLen * Math.cos(angle + Math.PI / 6),
        endY - headLen * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fill();

      // Label
      ctx.font = '11px JetBrains Mono, monospace';
      ctx.fillText(label, endX + 8 * Math.cos(angle), endY + 8 * Math.sin(angle));
    };

    const cx = blockX;
    const cy = blockY + blockHeight / 2;
    const fScale = 1.6;

    // 1. Applied Force vector (Emerald)
    const fAngleRad = (params.appliedAngle * Math.PI) / 180;
    const Fx = params.appliedForce * Math.cos(fAngleRad) * fScale;
    const Fy = -params.appliedForce * Math.sin(fAngleRad) * fScale;
    drawVector(cx, cy, Fx, Fy, '#10b981', `F_app (${params.appliedForce.toFixed(0)}N)`);

    // 2. Friction vector (Rose)
    const fFric = forces.friction * fScale;
    drawVector(cx, groundY, fFric, 0, '#f43f5e', `f_k/s (${Math.abs(forces.friction).toFixed(1)}N)`);

    // 3. Normal force (Sky Blue)
    const fNorm = -forces.normal * 0.6;
    drawVector(cx, cy, 0, fNorm, '#38bdf8', `N (${forces.normal.toFixed(1)}N)`);

    // 4. Gravity / Weight (Violet)
    const fGrav = forces.gravity * 0.6;
    drawVector(cx, cy, 0, fGrav, '#a855f7', `W=mg (${forces.gravity.toFixed(1)}N)`);
  }, [forces, liveState, params]);

  useEffect(() => {
    drawForces();
  }, [drawForces]);

  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = canvas.parentElement?.clientWidth || 800;
        canvas.height = 340;
        drawForces();
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawForces]);

  return (
    <LabLayout title="Newton's Laws & Friction Laboratory" category="Classical Mechanics">
      <div className="space-y-6">
        <SimulationControls
          state={simState}
          onPlay={play}
          onPause={pause}
          onReset={reset}
          onStep={step}
          onSpeedChange={setSpeed}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {/* Visual Canvas */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl relative">
              <div className="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
                <span className="text-xs font-mono font-medium text-slate-400">
                  Free-Body Diagram & Motion View
                </span>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-sky-400 border border-slate-700">
                  Friction Mode: {forces.frictionType.toUpperCase()}
                </span>
              </div>
              <div className="w-full relative">
                <canvas ref={canvasRef} className="w-full block" />
              </div>
              <div className="p-3 bg-slate-950/80 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                <div>
                  <span className="text-slate-500">Net Force: </span>
                  <span className="text-emerald-400 font-bold">{forces.net.x.toFixed(2)} N</span>
                </div>
                <div>
                  <span className="text-slate-500">Acc (a): </span>
                  <span className="text-sky-400 font-bold">{liveState.acceleration.toFixed(2)} m/s²</span>
                </div>
                <div>
                  <span className="text-slate-500">Velocity (v): </span>
                  <span className="text-amber-400">{liveState.velocity.toFixed(2)} m/s</span>
                </div>
                <div>
                  <span className="text-slate-500">Position (x): </span>
                  <span className="text-slate-300">{liveState.position.toFixed(2)} m</span>
                </div>
              </div>
            </div>

            {/* Live Charting */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <PhysicsChart
                data={chartData}
                title="Kinematic Response (v & a vs t)"
                xLabel="Time (s)"
                series={[
                  { key: 'velocity', name: 'Velocity (v)', color: '#eab308', unit: 'm/s' },
                  { key: 'acceleration', name: 'Acceleration (a)', color: '#38bdf8', unit: 'm/s²' },
                ]}
                exportFilename="forces-kinematics.csv"
              />
              <PhysicsChart
                data={chartData}
                title="Displacement (x vs t)"
                xLabel="Time (s)"
                series={[
                  { key: 'position', name: 'Displacement (x)', color: '#10b981', unit: 'm' },
                ]}
                exportFilename="forces-displacement.csv"
              />
            </div>
          </div>

          {/* Controls & Parameters */}
          <div className="space-y-5">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <Sliders className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                  Dynamics Parameters
                </h3>
              </div>

              {/* Mass */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Block Mass (m)</span>
                  <span className="font-mono text-emerald-400 font-semibold">{params.mass} kg</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="50"
                  step="0.5"
                  value={params.mass}
                  onChange={(e) => handleParamChange({ mass: Number(e.target.value) })}
                  className="w-full accent-emerald-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Applied Force */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Applied Force (F_app)</span>
                  <span className="font-mono text-sky-400 font-semibold">{params.appliedForce} N</span>
                </div>
                <input
                  type="range"
                  min="-60"
                  max="100"
                  step="1"
                  value={params.appliedForce}
                  onChange={(e) => handleParamChange({ appliedForce: Number(e.target.value) })}
                  className="w-full accent-sky-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Static Friction Coeff */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Static Friction (μ_s)</span>
                  <span className="font-mono text-rose-400 font-semibold">{params.frictionCoeffStatic}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={params.frictionCoeffStatic}
                  onChange={(e) => handleParamChange({ frictionCoeffStatic: Number(e.target.value) })}
                  className="w-full accent-rose-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Kinetic Friction Coeff */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Kinetic Friction (μ_k)</span>
                  <span className="font-mono text-amber-400 font-semibold">{params.frictionCoeffKinetic}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="0.8"
                  step="0.05"
                  value={params.frictionCoeffKinetic}
                  onChange={(e) => handleParamChange({ frictionCoeffKinetic: Number(e.target.value) })}
                  className="w-full accent-amber-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>

            {/* Free Body Math Breakdown */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                <Info className="w-4 h-4 text-sky-400" />
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Force Balance Equations
                </h3>
              </div>
              <div className="space-y-2 text-xs text-slate-300">
                <div className="p-2 rounded bg-slate-950/80 border border-slate-800/80 overflow-x-auto">
                  <MathFormula formula="F_{\text{net}} = F_{\text{app}} - f_{\text{friction}} = m a" />
                </div>
                <div className="p-2 rounded bg-slate-950/80 border border-slate-800/80 overflow-x-auto">
                  <MathFormula formula="f_s \le \mu_s N, \quad f_k = \mu_k N" />
                </div>
                <div className="p-2 rounded bg-slate-950/80 border border-slate-800/80 overflow-x-auto">
                  <MathFormula formula="N = m g - F_{\text{app}}\sin(\theta)" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </LabLayout>
  );
};
