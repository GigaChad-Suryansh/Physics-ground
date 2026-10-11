import React, { useRef, useEffect, useState, useCallback } from 'react';
import { LabLayout } from '../../components/layout/LabLayout';
import { SimulationControls } from '../../components/controls/SimulationControls';
import { PhysicsChart, DataPoint } from '../../components/charts/PhysicsChart';
import { MathFormula } from '../../components/ui/MathFormula';
import { useSimulation } from '../../hooks/useSimulation';
import {
  WaveParams,
  SHMParams,
  DEFAULT_WAVE_PARAMS,
  DEFAULT_SHM_PARAMS,
  generateWaveProfile,
  getSHMState,
  waveSpeed,
  angularFrequency,
  period,
} from '../../physics/waves/waves';
import { Sliders, Activity, Info, Waves as WaveIcon } from 'lucide-react';

export const WavesPage: React.FC = () => {
  const [waveParams, setWaveParams] = useState<WaveParams>(DEFAULT_WAVE_PARAMS);
  const [shmParams, setShmParams] = useState<SHMParams>(DEFAULT_SHM_PARAMS);
  const [mode, setMode] = useState<'traveling' | 'standing' | 'shm'>('traveling');

  const [currentTime, setCurrentTime] = useState<number>(0);
  const [chartData, setChartData] = useState<DataPoint[]>([]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const { state: simState, play, pause, reset, step, setSpeed } = useSimulation({
    dt: 1 / 120,
    onStep: (dt, totalTime) => {
      setCurrentTime(totalTime);

      if (mode === 'shm') {
        const shm = getSHMState(shmParams, totalTime);
        setChartData((prev) => [
          ...prev,
          {
            time: totalTime,
            displacement: shm.displacement,
            velocity: shm.velocity,
            kineticEnergy: shm.kineticEnergy,
            potentialEnergy: shm.potentialEnergy,
          },
        ]);
      } else {
        const sampleDisplacement = waveParams.amplitude * Math.sin(-angularFrequency(waveParams.frequency) * totalTime);
        setChartData((prev) => [
          ...prev,
          {
            time: totalTime,
            displacement: sampleDisplacement,
          },
        ]);
      }
    },
    onReset: () => {
      setCurrentTime(0);
      setChartData([]);
    },
  });

  const vSpeed = waveSpeed(waveParams.frequency, waveParams.wavelength);
  const omega = angularFrequency(waveParams.frequency);
  const T = period(waveParams.frequency);

  const drawWaves = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, width, height);

    const midY = height / 2;

    // Center equilibrium line
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(width, midY);
    ctx.stroke();

    if (mode === 'shm') {
      // Harmonic oscillator drawing: Spring + Mass
      const shm = getSHMState(shmParams, currentTime);
      const ampPx = (shm.displacement / shmParams.amplitude) * (height * 0.35);
      const massY = midY - ampPx;
      const massX = width / 2;

      // Draw spring coils from top ceiling (y = 20) to massY
      const topY = 20;
      const coils = 14;
      const coilWidth = 24;
      const coilStep = (massY - topY) / coils;

      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(massX, topY);
      for (let i = 1; i <= coils; i++) {
        const xOffset = i % 2 === 0 ? coilWidth : -coilWidth;
        ctx.lineTo(massX + (i === coils ? 0 : xOffset), topY + i * coilStep);
      }
      ctx.stroke();

      // Top ceiling support
      ctx.fillStyle = '#334155';
      ctx.fillRect(massX - 40, topY - 8, 80, 8);

      // Oscillating Block with glow
      ctx.fillStyle = '#0284c7';
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.roundRect(massX - 35, massY - 25, 70, 50, 8);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Mass text
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${shmParams.mass} kg`, massX, massY + 4);
    } else {
      // Continuous Wave Simulation
      const xRangeMeters = 8; // width covers 8 meters
      const points = 240;

      ctx.lineWidth = 3;
      ctx.strokeStyle = mode === 'traveling' ? '#38bdf8' : '#ec4899';
      ctx.beginPath();

      for (let i = 0; i <= points; i++) {
        const xCanvas = (i / points) * width;
        const xMeter = (i / points) * xRangeMeters;
        let yDisp = 0;

        if (mode === 'traveling') {
          // y = A sin(kx - wt)
          const k = (2 * Math.PI) / waveParams.wavelength;
          yDisp = waveParams.amplitude * Math.sin(k * xMeter - omega * currentTime);
        } else {
          // Standing wave: y = 2A sin(kx) cos(wt)
          const k = (2 * Math.PI) / waveParams.wavelength;
          yDisp = 2 * waveParams.amplitude * Math.sin(k * xMeter) * Math.cos(omega * currentTime);
        }

        const yCanvas = midY - (yDisp / (waveParams.amplitude * 2)) * (height * 0.35);

        if (i === 0) ctx.moveTo(xCanvas, yCanvas);
        else ctx.lineTo(xCanvas, yCanvas);
      }
      ctx.stroke();

      // Draw particle markers on wave to illustrate oscillation
      for (let p = 1; p < 7; p++) {
        const xMeter = (p / 7) * xRangeMeters;
        const xCanvas = (p / 7) * width;
        const k = (2 * Math.PI) / waveParams.wavelength;
        const yDisp =
          mode === 'traveling'
            ? waveParams.amplitude * Math.sin(k * xMeter - omega * currentTime)
            : 2 * waveParams.amplitude * Math.sin(k * xMeter) * Math.cos(omega * currentTime);
        const yCanvas = midY - (yDisp / (waveParams.amplitude * 2)) * (height * 0.35);

        ctx.fillStyle = '#f43f5e';
        ctx.beginPath();
        ctx.arc(xCanvas, yCanvas, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [currentTime, mode, omega, shmParams, waveParams]);

  useEffect(() => {
    drawWaves();
  }, [drawWaves]);

  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = canvas.parentElement?.clientWidth || 800;
        canvas.height = 340;
        drawWaves();
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawWaves]);

  return (
    <LabLayout title="Waves & Oscillations Laboratory" category="Wave Mechanics">
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
                <div className="flex items-center gap-2">
                  {(['traveling', 'standing', 'shm'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => {
                        setMode(m);
                        setChartData([]);
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-all ${
                        mode === m
                          ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {m === 'shm' ? 'Spring-Mass (SHM)' : `${m} Wave`}
                    </button>
                  ))}
                </div>
                <span className="text-xs font-mono text-slate-500">v = {vSpeed.toFixed(2)} m/s</span>
              </div>
              <div className="w-full relative">
                <canvas ref={canvasRef} className="w-full block" />
              </div>
              <div className="p-3 bg-slate-950/80 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                <div>
                  <span className="text-slate-500">Freq (f): </span>
                  <span className="text-sky-400 font-bold">{waveParams.frequency} Hz</span>
                </div>
                <div>
                  <span className="text-slate-500">Period (T): </span>
                  <span className="text-emerald-400 font-bold">{T.toFixed(2)} s</span>
                </div>
                <div>
                  <span className="text-slate-500">Wavelength (λ): </span>
                  <span className="text-purple-400 font-bold">{waveParams.wavelength} m</span>
                </div>
                <div>
                  <span className="text-slate-500">Ang. Freq (ω): </span>
                  <span className="text-amber-400 font-bold">{omega.toFixed(2)} rad/s</span>
                </div>
              </div>
            </div>

            {/* Graphs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <PhysicsChart
                data={chartData}
                title="Displacement vs Time (x=0)"
                xLabel="Time (s)"
                series={[
                  { key: 'displacement', name: 'Displacement (y)', color: '#38bdf8', unit: 'm' },
                ]}
                exportFilename="wave-displacement.csv"
              />
              <PhysicsChart
                data={chartData}
                title={mode === 'shm' ? 'Harmonic Energy Exchange' : 'Motion Telemetry'}
                xLabel="Time (s)"
                series={
                  mode === 'shm'
                    ? [
                        { key: 'kineticEnergy', name: 'Kinetic (K)', color: '#10b981', unit: 'J' },
                        { key: 'potentialEnergy', name: 'Potential (U)', color: '#f43f5e', unit: 'J' },
                      ]
                    : [{ key: 'displacement', name: 'Phase y', color: '#ec4899', unit: 'm' }]
                }
                exportFilename="wave-energy.csv"
              />
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-5">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <Sliders className="w-4 h-4 text-sky-400" />
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                  Wave Parameters
                </h3>
              </div>

              {/* Amplitude */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Amplitude (A)</span>
                  <span className="font-mono text-sky-400 font-semibold">{waveParams.amplitude} m</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="2.5"
                  step="0.1"
                  value={waveParams.amplitude}
                  onChange={(e) => setWaveParams((p) => ({ ...p, amplitude: Number(e.target.value) }))}
                  className="w-full accent-sky-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Frequency */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Frequency (f)</span>
                  <span className="font-mono text-emerald-400 font-semibold">{waveParams.frequency} Hz</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="4"
                  step="0.1"
                  value={waveParams.frequency}
                  onChange={(e) => {
                    const f = Number(e.target.value);
                    setWaveParams((p) => ({ ...p, frequency: f }));
                    setShmParams((s) => ({ ...s, frequency: f }));
                  }}
                  className="w-full accent-emerald-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Wavelength */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Wavelength (λ)</span>
                  <span className="font-mono text-purple-400 font-semibold">{waveParams.wavelength} m</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="6"
                  step="0.25"
                  value={waveParams.wavelength}
                  onChange={(e) => setWaveParams((p) => ({ ...p, wavelength: Number(e.target.value) }))}
                  className="w-full accent-purple-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>

            {/* Wave Formulas */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                <Info className="w-4 h-4 text-sky-400" />
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Harmonic Relationships
                </h3>
              </div>
              <div className="space-y-2 text-xs text-slate-300">
                <div className="p-2 rounded bg-slate-950/80 border border-slate-800/80 overflow-x-auto">
                  <MathFormula formula="v = f \lambda = \frac{\omega}{k}" />
                </div>
                <div className="p-2 rounded bg-slate-950/80 border border-slate-800/80 overflow-x-auto">
                  <MathFormula formula="y(x,t) = A \sin(k x - \omega t + \phi)" />
                </div>
                <div className="p-2 rounded bg-slate-950/80 border border-slate-800/80 overflow-x-auto">
                  <MathFormula formula="E_{\text{total}} = \frac{1}{2} k_{\text{spring}} A^2 = \text{const}" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </LabLayout>
  );
};
