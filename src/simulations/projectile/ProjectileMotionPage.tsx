import React, { useRef, useEffect, useState, useCallback } from 'react';
import { LabLayout } from '../../components/layout/LabLayout';
import { SimulationControls } from '../../components/controls/SimulationControls';
import { PhysicsChart, DataPoint } from '../../components/charts/PhysicsChart';
import { MathFormula } from '../../components/ui/MathFormula';
import { useSimulation } from '../../hooks/useSimulation';
import {
  ProjectileParams,
  ProjectileState,
  DEFAULT_PROJECTILE_PARAMS,
  createInitialState,
  getAnalyticalSolution,
  stepProjectile,
  generateAnalyticalTrajectory,
} from '../../physics/mechanics/projectile';
import { Sliders, Activity, Info, CheckCircle2, RotateCcw } from 'lucide-react';

export const ProjectileMotionPage: React.FC = () => {
  const [params, setParams] = useState<ProjectileParams>(DEFAULT_PROJECTILE_PARAMS);
  const stateRef = useRef<ProjectileState>(createInitialState(DEFAULT_PROJECTILE_PARAMS));
  const [liveState, setLiveState] = useState<ProjectileState>(stateRef.current);
  
  // Real-time recorded data for graphing
  const [chartData, setChartData] = useState<DataPoint[]>([]);
  const trajectoryHistoryRef = useRef<{ x: number; y: number }[]>([]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Analytical reference values
  const analytical = getAnalyticalSolution(params);
  const idealPath = React.useMemo(() => generateAnalyticalTrajectory(params, 80), [params]);

  // Hook up universal simulation clock
  const { state: simState, play, pause, reset, step, setSpeed } = useSimulation({
    dt: 1 / 120,
    onStep: (dt) => {
      if (stateRef.current.hasLanded) return;
      const nextState = stepProjectile(stateRef.current, params, dt);
      stateRef.current = nextState;
      setLiveState({ ...nextState });

      // Track trajectory point
      trajectoryHistoryRef.current.push({ ...nextState.position });

      // Record chart telemetry
      setChartData((prev) => {
        const vx = nextState.velocity.x;
        const vy = nextState.velocity.y;
        const speed = Math.sqrt(vx * vx + vy * vy);
        return [
          ...prev,
          {
            time: nextState.time,
            x: nextState.position.x,
            y: nextState.position.y,
            speed: speed,
            vy: vy,
          },
        ];
      });
    },
    onReset: () => {
      const init = createInitialState(params);
      stateRef.current = init;
      setLiveState(init);
      trajectoryHistoryRef.current = [{ ...init.position }];
      setChartData([]);
    },
  });

  // Re-initialize when parameters change while stopped
  const handleParamChange = (newParams: Partial<ProjectileParams>) => {
    setParams((prev) => {
      const updated = { ...prev, ...newParams };
      if (simState.status !== 'running') {
        const init = createInitialState(updated);
        stateRef.current = init;
        setLiveState(init);
        trajectoryHistoryRef.current = [{ ...init.position }];
        setChartData([]);
      }
      return updated;
    });
  };

  // Canvas rendering loop
  const drawSimulation = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear background
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, width, height);

    // Compute coordinate scaling
    const margin = 50;
    const maxRange = Math.max(analytical.range * 1.25, 60);
    const maxHeight = Math.max(analytical.maxHeight * 1.5, 30);
    const scaleX = (width - margin * 2) / maxRange;
    const scaleY = (height - margin * 2) / maxHeight;
    const originX = margin;
    const originY = height - margin;

    // Helper to map meters to canvas pixels
    const toCanvasX = (x: number) => originX + x * scaleX;
    const toCanvasY = (y: number) => originY - y * scaleY;

    // Grid lines
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    const gridStepX = Math.pow(10, Math.floor(Math.log10(maxRange / 4)));
    for (let gx = 0; gx <= maxRange; gx += gridStepX) {
      const cx = toCanvasX(gx);
      ctx.beginPath();
      ctx.moveTo(cx, margin);
      ctx.lineTo(cx, originY);
      ctx.stroke();

      // X Axis label
      ctx.fillStyle = '#64748b';
      ctx.font = '10px monospace';
      ctx.fillText(`${gx.toFixed(0)}m`, cx - 8, originY + 16);
    }

    const gridStepY = Math.pow(10, Math.floor(Math.log10(maxHeight / 4)));
    for (let gy = 0; gy <= maxHeight; gy += gridStepY) {
      const cy = toCanvasY(gy);
      ctx.beginPath();
      ctx.moveTo(originX, cy);
      ctx.lineTo(width - margin, cy);
      ctx.stroke();

      // Y Axis label
      ctx.fillStyle = '#64748b';
      ctx.font = '10px monospace';
      ctx.fillText(`${gy.toFixed(0)}m`, originX - 35, cy + 3);
    }

    // Ground plane
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(originX - 20, originY);
    ctx.lineTo(width - margin + 20, originY);
    ctx.stroke();

    // Theoretical analytical trajectory (dashed cyan)
    if (idealPath.length > 1) {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(toCanvasX(idealPath[0].x), toCanvasY(idealPath[0].y));
      for (let i = 1; i < idealPath.length; i++) {
        ctx.lineTo(toCanvasX(idealPath[i].x), toCanvasY(idealPath[i].y));
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Actual simulation trajectory trail (vibrant violet/pink glow)
    const history = trajectoryHistoryRef.current;
    if (history.length > 1) {
      ctx.strokeStyle = '#ec4899';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(toCanvasX(history[0].x), toCanvasY(history[0].y));
      for (let i = 1; i < history.length; i++) {
        ctx.lineTo(toCanvasX(history[i].x), toCanvasY(history[i].y));
      }
      ctx.stroke();
    }

    // Current projectile position
    const px = toCanvasX(liveState.position.x);
    const py = toCanvasY(liveState.position.y);

    // Velocity vector arrows
    const vScale = 1.2;
    const vxLen = liveState.velocity.x * vScale;
    const vyLen = -liveState.velocity.y * vScale; // canvas Y is inverted

    // Vx vector (green)
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + vxLen, py);
    ctx.stroke();

    // Vy vector (sky blue)
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px, py + vyLen);
    ctx.stroke();

    // Resultant Velocity vector (yellow)
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + vxLen, py + vyLen);
    ctx.stroke();

    // Projectile ball with glow
    ctx.fillStyle = '#f43f5e';
    ctx.shadowColor = '#f43f5e';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(px, py, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0; // reset
  }, [analytical, idealPath, liveState]);

  useEffect(() => {
    drawSimulation();
  }, [drawSimulation]);

  // Handle canvas resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = canvas.parentElement?.clientWidth || 800;
        canvas.height = 380;
        drawSimulation();
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawSimulation]);

  return (
    <LabLayout title="Projectile Motion Laboratory" category="Mechanics & Kinematics">
      <div className="space-y-6">
        {/* Controls bar */}
        <SimulationControls
          state={simState}
          onPlay={play}
          onPause={pause}
          onReset={reset}
          onStep={step}
          onSpeedChange={setSpeed}
        />

        {/* Main interactive grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Simulation Canvas (Col 2) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl relative">
              <div className="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
                <span className="text-xs font-mono font-medium text-slate-400">
                  Real-Time Trajectory View (Canvas)
                </span>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1 text-sky-400">
                    <span className="w-2.5 h-0.5 bg-sky-400 border border-sky-400" /> Ideal Path
                  </span>
                  <span className="flex items-center gap-1 text-pink-400">
                    <span className="w-2.5 h-1 bg-pink-500 rounded" /> Simulated
                  </span>
                  <span className="flex items-center gap-1 text-amber-400">
                    <span className="w-2 h-0.5 bg-amber-400" /> v Vector
                  </span>
                </div>
              </div>

              <div className="w-full relative">
                <canvas ref={canvasRef} className="w-full block cursor-crosshair" />
              </div>

              {/* Status footer bar */}
              <div className="p-3 bg-slate-950/80 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                <div>
                  <span className="text-slate-500">x: </span>
                  <span className="text-slate-200">{liveState.position.x.toFixed(2)} m</span>
                </div>
                <div>
                  <span className="text-slate-500">y: </span>
                  <span className="text-slate-200">{liveState.position.y.toFixed(2)} m</span>
                </div>
                <div>
                  <span className="text-slate-500">v_x: </span>
                  <span className="text-emerald-400">{liveState.velocity.x.toFixed(2)} m/s</span>
                </div>
                <div>
                  <span className="text-slate-500">v_y: </span>
                  <span className="text-sky-400">{liveState.velocity.y.toFixed(2)} m/s</span>
                </div>
              </div>
            </div>

            {/* Live Charting */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <PhysicsChart
                data={chartData}
                title="Trajectory Coordinates (y vs x)"
                xLabel="Horizontal x (m)"
                series={[
                  { key: 'y', name: 'Height y', color: '#ec4899', unit: 'm' },
                ]}
                exportFilename="projectile-coordinates.csv"
              />
              <PhysicsChart
                data={chartData}
                title="Kinematic Velocity Profile"
                xLabel="Time (s)"
                series={[
                  { key: 'speed', name: '|v| Speed', color: '#eab308', unit: 'm/s' },
                  { key: 'vy', name: 'Vertical v_y', color: '#38bdf8', unit: 'm/s' },
                ]}
                exportFilename="projectile-velocities.csv"
              />
            </div>
          </div>

          {/* Configuration & Parameters Panel (Col 1) */}
          <div className="space-y-5">
            {/* Controls Box */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <Sliders className="w-4 h-4 text-sky-400" />
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                  Parameters
                </h3>
              </div>

              {/* Initial Velocity */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Launch Velocity (v₀)</span>
                  <span className="font-mono text-sky-400 font-semibold">{params.velocity} m/s</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="80"
                  step="1"
                  value={params.velocity}
                  onChange={(e) => handleParamChange({ velocity: Number(e.target.value) })}
                  className="w-full accent-sky-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Launch Angle */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Launch Angle (θ)</span>
                  <span className="font-mono text-sky-400 font-semibold">{params.angle}°</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="90"
                  step="1"
                  value={params.angle}
                  onChange={(e) => handleParamChange({ angle: Number(e.target.value) })}
                  className="w-full accent-sky-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Gravitational Acceleration */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Gravity (g)</span>
                  <span className="font-mono text-emerald-400 font-semibold">{params.gravity} m/s²</span>
                </div>
                <input
                  type="range"
                  min="1.6"
                  max="25"
                  step="0.1"
                  value={params.gravity}
                  onChange={(e) => handleParamChange({ gravity: Number(e.target.value) })}
                  className="w-full accent-emerald-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex gap-2 text-[10px] text-slate-500 pt-1">
                  <button
                    onClick={() => handleParamChange({ gravity: 9.81 })}
                    className="hover:text-slate-300 underline"
                  >
                    Earth (9.81)
                  </button>
                  <button
                    onClick={() => handleParamChange({ gravity: 1.62 })}
                    className="hover:text-slate-300 underline"
                  >
                    Moon (1.62)
                  </button>
                  <button
                    onClick={() => handleParamChange({ gravity: 3.71 })}
                    className="hover:text-slate-300 underline"
                  >
                    Mars (3.71)
                  </button>
                </div>
              </div>

              {/* Initial Height */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Initial Height (y₀)</span>
                  <span className="font-mono text-purple-400 font-semibold">{params.height} m</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="1"
                  value={params.height}
                  onChange={(e) => handleParamChange({ height: Number(e.target.value) })}
                  className="w-full accent-purple-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Air Resistance Toggle */}
              <div className="pt-2 border-t border-slate-800/80 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={params.dragEnabled}
                    onChange={(e) => handleParamChange({ dragEnabled: e.target.checked })}
                    className="rounded bg-slate-800 border-slate-700 text-sky-500 focus:ring-sky-500"
                  />
                  <span className="text-xs font-medium text-slate-300">
                    Atmospheric Drag (Quadratic)
                  </span>
                </label>

                {params.dragEnabled && (
                  <div className="space-y-1 pl-6 pt-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500">Drag Coeff (k)</span>
                      <span className="font-mono text-slate-300">{params.dragCoefficient}</span>
                    </div>
                    <input
                      type="range"
                      min="0.001"
                      max="0.05"
                      step="0.001"
                      value={params.dragCoefficient}
                      onChange={(e) => handleParamChange({ dragCoefficient: Number(e.target.value) })}
                      className="w-full accent-rose-500 bg-slate-800 h-1 rounded appearance-none"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Analytical Benchmark Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5">
                <Activity className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Theoretical Benchmarks (No Drag)
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <div className="text-slate-500 text-[11px]">Max Height (H)</div>
                  <div className="text-sm font-mono font-bold text-emerald-400 mt-0.5">
                    {analytical.maxHeight.toFixed(2)} m
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <div className="text-slate-500 text-[11px]">Range (R)</div>
                  <div className="text-sm font-mono font-bold text-sky-400 mt-0.5">
                    {analytical.range.toFixed(2)} m
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <div className="text-slate-500 text-[11px]">Flight Time (t_f)</div>
                  <div className="text-sm font-mono font-bold text-amber-400 mt-0.5">
                    {analytical.flightTime.toFixed(2)} s
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <div className="text-slate-500 text-[11px]">Apex Time</div>
                  <div className="text-sm font-mono font-bold text-purple-400 mt-0.5">
                    {analytical.timeToApex.toFixed(2)} s
                  </div>
                </div>
              </div>
            </div>

            {/* Equations Box with KaTeX */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                <Info className="w-4 h-4 text-indigo-400" />
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Governing Equations
                </h3>
              </div>
              <div className="space-y-2 text-xs text-slate-300">
                <div className="p-2 rounded bg-slate-950/80 border border-slate-800/80 overflow-x-auto">
                  <MathFormula formula="x(t) = v_0 \cos(\theta) \cdot t" />
                </div>
                <div className="p-2 rounded bg-slate-950/80 border border-slate-800/80 overflow-x-auto">
                  <MathFormula formula="y(t) = y_0 + v_0 \sin(\theta) \cdot t - \frac{1}{2}g t^2" />
                </div>
                <div className="p-2 rounded bg-slate-950/80 border border-slate-800/80 overflow-x-auto">
                  <MathFormula formula="R = \frac{v_0^2 \sin(2\theta)}{g} \quad (\text{for } y_0 = 0)" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </LabLayout>
  );
};
