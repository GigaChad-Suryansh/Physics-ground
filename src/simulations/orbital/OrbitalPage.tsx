import React, { useRef, useEffect, useState, useCallback } from 'react';
import { LabLayout } from '../../components/layout/LabLayout';
import { SimulationControls } from '../../components/controls/SimulationControls';
import { PhysicsChart, DataPoint } from '../../components/charts/PhysicsChart';
import { MathFormula } from '../../components/ui/MathFormula';
import { useSimulation } from '../../hooks/useSimulation';
import {
  OrbitalParams,
  OrbitalState,
  DEFAULT_ORBITAL_PARAMS,
  createInitialOrbitalState,
  stepOrbital,
  circularOrbitSpeed,
} from '../../physics/mechanics/orbital';
import { Sliders, Activity, Info, Orbit } from 'lucide-react';

export const OrbitalPage: React.FC = () => {
  const [params, setParams] = useState<OrbitalParams>(DEFAULT_ORBITAL_PARAMS);
  const stateRef = useRef<OrbitalState>(createInitialOrbitalState(DEFAULT_ORBITAL_PARAMS));
  const [liveState, setLiveState] = useState<OrbitalState>(stateRef.current);
  const [chartData, setChartData] = useState<DataPoint[]>([]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const { state: simState, play, pause, reset, step, setSpeed } = useSimulation({
    dt: 1 / 120,
    onStep: (dt) => {
      const nextState = stepOrbital(stateRef.current, params, dt);
      stateRef.current = nextState;
      setLiveState({ ...nextState });

      setChartData((prev) => [
        ...prev,
        {
          time: nextState.time,
          totalEnergy: nextState.totalEnergy,
          kineticEnergy: nextState.kineticEnergy,
          potentialEnergy: nextState.potentialEnergy,
          angularMomentum: nextState.angularMomentum,
          separation: nextState.separation,
        },
      ]);
    },
    onReset: () => {
      const init = createInitialOrbitalState(params);
      stateRef.current = init;
      setLiveState(init);
      setChartData([]);
    },
  });

  const handleParamChange = (newParams: Partial<OrbitalParams>) => {
    setParams((prev) => {
      const updated = { ...prev, ...newParams };
      if (simState.status !== 'running') {
        const init = createInitialOrbitalState(updated);
        stateRef.current = init;
        setLiveState(init);
        setChartData([]);
      }
      return updated;
    });
  };

  const setCircularOrbitPreset = () => {
    const vCirc = circularOrbitSpeed(params.body1Mass, params.initialSeparation, params.gravitationalConstant);
    handleParamChange({ body2Speed: vCirc });
  };

  const drawOrbit = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Deep space background
    ctx.fillStyle = '#050813';
    ctx.fillRect(0, 0, width, height);

    // Center coordinates
    const cx = width / 2;
    const cy = height / 2;
    const scale = 0.85;

    // Central grid concentric rings
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let r = 50; r <= 250; r += 50) {
      ctx.beginPath();
      ctx.arc(cx, cy, r * scale, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Body 2 Orbit Trail (Glowing cyan)
    const trail = liveState.body2.trail;
    if (trail.length > 1) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx + trail[0].x * scale, cy + trail[0].y * scale);
      for (let i = 1; i < trail.length; i++) {
        ctx.lineTo(cx + trail[i].x * scale, cy + trail[i].y * scale);
      }
      ctx.stroke();
    }

    // Central Heavy Body (Sun / Star)
    const b1x = cx + liveState.body1.position.x * scale;
    const b1y = cy + liveState.body1.position.y * scale;

    ctx.fillStyle = '#fbbf24';
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 24;
    ctx.beginPath();
    ctx.arc(b1x, b1y, liveState.body1.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Orbiting Satellite / Planet
    const b2x = cx + liveState.body2.position.x * scale;
    const b2y = cy + liveState.body2.position.y * scale;

    ctx.fillStyle = '#38bdf8';
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(b2x, b2y, liveState.body2.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Velocity Vector on Orbiting Body
    const vScale = 0.6;
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(b2x, b2y);
    ctx.lineTo(b2x + liveState.body2.velocity.x * vScale, b2y + liveState.body2.velocity.y * vScale);
    ctx.stroke();
  }, [liveState]);

  useEffect(() => {
    drawOrbit();
  }, [drawOrbit]);

  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = canvas.parentElement?.clientWidth || 800;
        canvas.height = 360;
        drawOrbit();
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawOrbit]);

  return (
    <LabLayout title="Gravity & Orbital Mechanics" category="Astrophysics">
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
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl relative">
              <div className="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
                <span className="text-xs font-mono font-medium text-slate-400">
                  Two-Body Gravitational Space (Symplectic Velocity Verlet)
                </span>
                <button
                  onClick={setCircularOrbitPreset}
                  className="px-2.5 py-1 text-xs rounded bg-sky-500/10 text-sky-300 border border-sky-500/20 hover:bg-sky-500/20 transition-all font-mono"
                >
                  Set Circular Velocity (v = √(GM/r))
                </button>
              </div>
              <div className="w-full relative">
                <canvas ref={canvasRef} className="w-full block" />
              </div>
              <div className="p-3 bg-slate-950/80 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                <div>
                  <span className="text-slate-500">Separation (r): </span>
                  <span className="text-sky-400 font-bold">{liveState.separation.toFixed(1)} m</span>
                </div>
                <div>
                  <span className="text-slate-500">Total Energy (E): </span>
                  <span className="text-emerald-400 font-bold">{liveState.totalEnergy.toFixed(2)} J</span>
                </div>
                <div>
                  <span className="text-slate-500">Ang. Mom. (L): </span>
                  <span className="text-purple-400 font-bold">{liveState.angularMomentum.toFixed(1)} kg·m²/s</span>
                </div>
                <div>
                  <span className="text-slate-500">Status: </span>
                  <span className={liveState.hasCollided ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                    {liveState.hasCollided ? 'Collided' : 'Stable Orbit'}
                  </span>
                </div>
              </div>
            </div>

            {/* Graphs for Conservation of Energy & Momentum */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <PhysicsChart
                data={chartData}
                title="Energy Conservation (E, K, U vs t)"
                xLabel="Time (s)"
                series={[
                  { key: 'totalEnergy', name: 'Total Energy (E)', color: '#10b981', unit: 'J' },
                  { key: 'kineticEnergy', name: 'Kinetic (K)', color: '#38bdf8', unit: 'J' },
                  { key: 'potentialEnergy', name: 'Potential (U)', color: '#f43f5e', unit: 'J' },
                ]}
                exportFilename="orbital-energy.csv"
              />
              <PhysicsChart
                data={chartData}
                title="Orbital Distance & Momentum"
                xLabel="Time (s)"
                series={[
                  { key: 'separation', name: 'Separation (r)', color: '#a855f7', unit: 'm' },
                  { key: 'angularMomentum', name: 'Angular Mom. (L)', color: '#eab308', unit: 'kg·m²/s' },
                ]}
                exportFilename="orbital-momentum.csv"
              />
            </div>
          </div>

          {/* Controls & Parameters */}
          <div className="space-y-5">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <Sliders className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                  Orbital Setup
                </h3>
              </div>

              {/* Central Mass */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Central Star Mass (M)</span>
                  <span className="font-mono text-amber-400 font-semibold">{params.body1Mass.toExponential(1)} kg</span>
                </div>
                <input
                  type="range"
                  min="5e11"
                  max="5e12"
                  step="1e11"
                  value={params.body1Mass}
                  onChange={(e) => handleParamChange({ body1Mass: Number(e.target.value) })}
                  className="w-full accent-amber-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Initial Distance */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Initial Radius (r₀)</span>
                  <span className="font-mono text-sky-400 font-semibold">{params.initialSeparation} m</span>
                </div>
                <input
                  type="range"
                  min="80"
                  max="280"
                  step="5"
                  value={params.initialSeparation}
                  onChange={(e) => handleParamChange({ initialSeparation: Number(e.target.value) })}
                  className="w-full accent-sky-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Tangential Speed */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Orbital Speed (v₀)</span>
                  <span className="font-mono text-purple-400 font-semibold">{params.body2Speed} m/s</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="1"
                  value={params.body2Speed}
                  onChange={(e) => handleParamChange({ body2Speed: Number(e.target.value) })}
                  className="w-full accent-purple-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>

            {/* Astrophysics Equations */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                <Info className="w-4 h-4 text-purple-400" />
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Gravitational Laws
                </h3>
              </div>
              <div className="space-y-2 text-xs text-slate-300">
                <div className="p-2 rounded bg-slate-950/80 border border-slate-800/80 overflow-x-auto">
                  <MathFormula formula="F = G \frac{M m}{r^2}" />
                </div>
                <div className="p-2 rounded bg-slate-950/80 border border-slate-800/80 overflow-x-auto">
                  <MathFormula formula="v_{\text{circ}} = \sqrt{\frac{G M}{r}}, \quad v_{\text{esc}} = \sqrt{\frac{2 G M}{r}}" />
                </div>
                <div className="p-2 rounded bg-slate-950/80 border border-slate-800/80 overflow-x-auto">
                  <MathFormula formula="E = \frac{1}{2}m v^2 - \frac{G M m}{r} = \text{const}" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </LabLayout>
  );
};
