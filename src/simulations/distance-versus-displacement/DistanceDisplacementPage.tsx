import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Sliders, Activity, Info } from 'lucide-react';
import { LabLayout } from '../../components/layout/LabLayout';
import { SimulationControls } from '../../components/controls/SimulationControls';
import { PhysicsChart } from '../../components/charts/PhysicsChart';
import { SimCanvas } from '../../components/canvas/SimCanvas';
import type { DrawFn } from '../../components/canvas/SimCanvas';
import { MONO, drawArrow, drawTag, fillGradient, glowDot, niceTicks } from '../../components/canvas/draw';
import { FormulaList, Panel, ReadoutBar } from '../../components/ui/Panel';
import { Slider } from '../../components/ui/Slider';
import { CANVAS_COLORS } from '../../components/ui/theme';
import { useSimulation } from '../../hooks/useSimulation';
import { useTelemetry } from '../../hooks/useTelemetry';
import {
  getPathPosition,
  calculateDisplacement,
  calculateDistanceStep,
  type PathType,
  type PathParams,
} from '../../physics/mechanics/distance-versus-displacement';

const CANVAS_HEIGHT = 440;
const PX_PER_M = 30;
const DT = 1 / 60;
const DURATION = 10;

export const DistanceDisplacementPage: React.FC = () => {
  const [pathType, setPathType] = useState<PathType>('zigzag');
  const [amplitude, setAmplitude] = useState(2);
  const [showTrace, setShowTrace] = useState(true);

  const paramsRef = useRef<PathParams>({ type: pathType, amplitude });
  paramsRef.current = { type: pathType, amplitude };

  const timeRef = useRef(0);
  const [liveTime, setLiveTime] = useState(0);
  
  const [distance, setDistance] = useState(0);
  const distanceRef = useRef(0);
  const prevPosRef = useRef(getPathPosition(0, paramsRef.current));

  const telemetry = useTelemetry(1500, 2);

  const initialPos = useMemo(() => getPathPosition(0, paramsRef.current), [pathType, amplitude]);

  const { state: simState, play, pause, reset, step, setSpeed, finish } = useSimulation({
    dt: DT,
    onStep: () => {
      if (timeRef.current >= DURATION) return;
      const t = Math.min(timeRef.current + DT, DURATION);
      timeRef.current = t;
      setLiveTime(t);

      const currentPos = getPathPosition(t, paramsRef.current);
      const stepDist = calculateDistanceStep(currentPos, prevPosRef.current);
      distanceRef.current += stepDist;
      setDistance(distanceRef.current);
      prevPosRef.current = currentPos;

      const displacement = calculateDisplacement(currentPos, initialPos);

      telemetry.push({
        time: t,
        distance: distanceRef.current,
        displacementMag: displacement.magnitude,
      }, t >= DURATION);

      if (t >= DURATION) finish();
    },
    onReset: () => {
      timeRef.current = 0;
      setLiveTime(0);
      distanceRef.current = 0;
      setDistance(0);
      prevPosRef.current = getPathPosition(0, paramsRef.current);
      telemetry.clear();
    },
  });

  const handlePathChange = (type: PathType) => {
    setPathType(type);
    reset();
  };

  const currentPos = getPathPosition(liveTime, paramsRef.current);
  const displacement = calculateDisplacement(currentPos, initialPos);

  const draw: DrawFn = (ctx, width, height) => {
    const originX = width / 2 - 100; // Offset origin slightly left
    const originY = height / 2;

    fillGradient(ctx, width, height, '#070b14', CANVAS_COLORS.bgDeep);

    // Grid
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    const xTicks = niceTicks(-width / PX_PER_M, width / PX_PER_M, 10);
    const yTicks = niceTicks(-height / PX_PER_M, height / PX_PER_M, 6);

    for (const x of xTicks) {
      const sx = originX + x * PX_PER_M;
      ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, height); ctx.stroke();
    }
    for (const y of yTicks) {
      const sy = originY - y * PX_PER_M;
      ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(width, sy); ctx.stroke();
    }

    // Path Trace
    if (showTrace) {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let t = 0; t <= liveTime + 1e-9; t += 0.05) {
        const pt = getPathPosition(t, paramsRef.current);
        const sx = originX + pt.x * PX_PER_M;
        const sy = originY - pt.y * PX_PER_M;
        if (t === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
    }

    // Displacement Vector
    const startScreen = { x: originX + initialPos.x * PX_PER_M, y: originY - initialPos.y * PX_PER_M };
    const endScreen = { x: originX + currentPos.x * PX_PER_M, y: originY - currentPos.y * PX_PER_M };
    
    drawArrow(ctx, startScreen.x, startScreen.y, endScreen.x, endScreen.y, '#fbbf24', { width: 3, head: 12 });
    
    // Start and End dots
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath(); ctx.arc(startScreen.x, startScreen.y, 4, 0, Math.PI * 2); ctx.fill();
    drawTag(ctx, 'Start', startScreen.x, startScreen.y + 15, { align: 'center' });

    glowDot(ctx, endScreen.x, endScreen.y, 6, '#38bdf8', 10);
    drawTag(ctx, 'Object', endScreen.x, endScreen.y - 15, { align: 'center', color: '#38bdf8', bg: 'rgba(56,189,248,0.2)' });
  };

  return (
    <LabLayout title="Distance versus Displacement" category="Mechanics & Kinematics">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <Panel title="Path Comparison Laboratory" icon={Activity}>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="text-xs text-slate-400 font-mono">Path Type:</span>
              {(['linear', 'zigzag', 'circle', 'random'] as PathType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => handlePathChange(type)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                    pathType === type
                      ? 'bg-sky-500 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
              <SimCanvas height={CANVAS_HEIGHT} draw={draw} ariaLabel="Distance vs Displacement simulation" />
            </div>

            <div className="mt-4">
              <SimulationControls
                state={simState}
                onPlay={() => { if (simState.status === 'finished') reset(); play(); }}
                onPause={pause}
                onReset={reset}
                onStep={step}
                onSpeedChange={setSpeed}
              />
            </div>
          </Panel>

          <ReadoutBar
            items={[
              { label: 'Time', value: `${liveTime.toFixed(2)} s` },
              { label: 'Distance', value: `${distance.toFixed(2)} m`, accent: 'sky' },
              { label: 'Displacement Mag', value: `${displacement.magnitude.toFixed(2)} m`, accent: 'amber' },
              { label: 'Ratio (Dist/Disp)', value: displacement.magnitude > 0 ? (distance / displacement.magnitude).toFixed(2) : '∞' },
            ]}
          />

          <PhysicsChart
            data={telemetry.data}
            title="Distance vs. Displacement Magnitude"
            series={[
              { key: 'distance', name: 'Total Distance', color: '#38bdf8', unit: 'm' },
              { key: 'displacementMag', name: 'Displacement Magnitude', color: '#fbbf24', unit: 'm' },
            ]}
            xLabel="Time (s)"
            yLabel="Meters (m)"
          />
        </div>

        <div className="lg:col-span-4 space-y-6">
          <Panel title="Simulation Settings" icon={Sliders}>
            <div className="space-y-6">
              <Slider
                label="Path Amplitude / Radius"
                value={amplitude}
                min={0.5}
                max={5}
                step={0.1}
                unit="m"
                onChange={(val) => { setAmplitude(val); reset(); }}
              />
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-slate-800">
                <span className="text-sm text-slate-300 font-medium">Show Path Trace</span>
                <button
                  onClick={() => setShowTrace(!showTrace)}
                  className={`w-12 h-6 rounded-full transition-colors relative ${showTrace ? 'bg-sky-500' : 'bg-slate-700'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${showTrace ? 'left-7' : 'left-1'}`} />
                </button>
              </div>
            </div>
          </Panel>

          <Panel title="Mathematical Definitions" icon={Info}>
            <FormulaList
              formulas={[
                'd = \\int_{0}^{t} |\\vec{v}(t)| dt',
                '\\Delta\\vec{r} = \\vec{r}(t) - \\vec{r}(0)',
                'd \\ge |\\Delta\\vec{r}|',
              ]}
            />
            <div className="mt-4 text-xs text-slate-400 space-y-3">
              <p>
                <strong className="text-slate-200">Distance (d)</strong> is a scalar quantity representing the total length of the path an object has traveled. It never decreases over time.
              </p>
              <p>
                <strong className="text-slate-200">Displacement (Δr)</strong> is a vector quantity representing the straight-line change in position. Its magnitude can decrease if the object moves back toward the start.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </LabLayout>
  );
};

export default DistanceDisplacementPage;
