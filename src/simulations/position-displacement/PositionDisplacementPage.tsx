import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Sliders, Compass, Info, RotateCw, Navigation } from 'lucide-react';
import { LabLayout } from '../../components/layout/LabLayout';
import { SimulationControls } from '../../components/controls/SimulationControls';
import { PhysicsChart } from '../../components/charts/PhysicsChart';
import { SimCanvas } from '../../components/canvas/SimCanvas';
import type { DrawFn } from '../../components/canvas/SimCanvas';
import {
  MONO,
  drawArrow,
  drawTag,
  fillGradient,
  niceTicks,
  formatTickValue,
} from '../../components/canvas/draw';
import { Badge, FormulaList, Panel, ReadoutBar } from '../../components/ui/Panel';
import { Slider } from '../../components/ui/Slider';
import { CANVAS_COLORS } from '../../components/ui/theme';
import { useSimulation } from '../../hooks/useSimulation';
import { useTelemetry } from '../../hooks/useTelemetry';
import {
  DEFAULT_FRAME_PARAMS,
  getPositionAtTime,
  transformToFrame,
  type ReferenceFrameParams,
} from '../../physics/mechanics/position-displacement';
import { DEG_TO_RAD, RAD_TO_DEG } from '../../physics/constants';

const CANVAS_HEIGHT = 440;
const PX_PER_M = 30; // Scale: 30 pixels per meter

type TrajType = 'circle' | 'linear' | 'oscillation';

export const PositionDisplacementPage: React.FC = () => {
  const [trajType, setTrajType] = useState<TrajType>('circle');
  const [frameParams, setFrameParams] = useState<ReferenceFrameParams>(DEFAULT_FRAME_PARAMS);
  const frameRef = useRef(frameParams);
  frameRef.current = frameParams;

  const trajRef = useRef<TrajType>(trajType);
  trajRef.current = trajType;

  const timeRef = useRef(0);
  const [liveTime, setLiveTime] = useState(0);

  const telemetry = useTelemetry(1500, 4);

  const initialA = useMemo(() => getPositionAtTime(0, trajType), [trajType]);

  const { state: simState, play, pause, reset, step, setSpeed } = useSimulation({
    dt: 1 / 60,
    onStep: () => {
      const t = timeRef.current + 1 / 60;
      timeRef.current = t;
      setLiveTime(t);

      const currentA = getPositionAtTime(t, trajRef.current);
      const trans = transformToFrame(currentA, initialA, frameRef.current);

      telemetry.push({
        time: t,
        x_A: trans.positionInA.x,
        y_A: trans.positionInA.y,
        x_B: trans.positionInB.x,
        y_B: trans.positionInB.y,
        dx_A: trans.displacementInA.x,
        dy_A: trans.displacementInA.y,
      });
    },
    onReset: () => {
      timeRef.current = 0;
      setLiveTime(0);
      telemetry.clear();
    },
  });

  const updateFrame = useCallback(
    (patch: Partial<ReferenceFrameParams>) => {
      setFrameParams((prev) => ({ ...prev, ...patch }));
    },
    []
  );

  const handleTrajChange = (type: TrajType) => {
    setTrajType(type);
    timeRef.current = 0;
    setLiveTime(0);
    telemetry.clear();
    reset();
  };

  const currentA = getPositionAtTime(liveTime, trajType);
  const transformation = transformToFrame(currentA, initialA, frameParams);

  const draw: DrawFn = (ctx, width, height) => {
    const originX = width / 2;
    const originY = height / 2;

    fillGradient(ctx, width, height, '#070b14', CANVAS_COLORS.bgDeep);

    // Draw coordinate grid (Global Frame A)
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;

    const xMin = -originX / PX_PER_M;
    const xMax = (width - originX) / PX_PER_M;
    const yMin = -(height - originY) / PX_PER_M;
    const yMax = originY / PX_PER_M;

    const xTicks = niceTicks(xMin, xMax, 6);
    const yTicks = niceTicks(yMin, yMax, 6);

    for (const x of xTicks) {
      const sx = originX + x * PX_PER_M;
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, height);
      ctx.stroke();
    }
    for (const y of yTicks) {
      const sy = originY - y * PX_PER_M;
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(width, sy);
      ctx.stroke();
    }

    // Global Axes (Frame A)
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, originY);
    ctx.lineTo(width, originY);
    ctx.moveTo(originX, 0);
    ctx.lineTo(originX, height);
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = MONO;
    ctx.fillText('Frame A (Global x, y)', width - 160, originY - 10);

    // Draw trajectory trail
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    for (let t = 0; t <= Math.max(liveTime, 0.05); t += 0.05) {
      const pt = getPositionAtTime(t, trajType);
      const sx = originX + pt.x * PX_PER_M;
      const sy = originY - pt.y * PX_PER_M;
      if (t === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Reference Frame B Origin & Axes
    const bOriginScreen = {
      x: originX + frameParams.originB.x * PX_PER_M,
      y: originY - frameParams.originB.y * PX_PER_M,
    };

    const theta = frameParams.rotationB * DEG_TO_RAD;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);

    // Frame B axis vectors of length 4 meters
    const axisLen = 4 * PX_PER_M;
    const bXEnd = {
      x: bOriginScreen.x + cosT * axisLen,
      y: bOriginScreen.y - sinT * axisLen,
    };
    const bYEnd = {
      x: bOriginScreen.x - sinT * axisLen,
      y: bOriginScreen.y - cosT * axisLen,
    };

    // Draw Frame B axes
    drawArrow(ctx, bOriginScreen.x, bOriginScreen.y, bXEnd.x, bXEnd.y, '#f43f5e', { width: 2, head: 10 });
    drawArrow(ctx, bOriginScreen.x, bOriginScreen.y, bYEnd.x, bYEnd.y, '#10b981', { width: 2, head: 10 });
    drawTag(ctx, 'Origin B (O_B)', bOriginScreen.x + 8, bOriginScreen.y - 12, { bg: 'rgba(244,63,94,0.2)', color: '#fda4af' });

    // Initial Position in A & Current Position in A
    const initScreen = {
      x: originX + initialA.x * PX_PER_M,
      y: originY - initialA.y * PX_PER_M,
    };
    const currScreen = {
      x: originX + currentA.x * PX_PER_M,
      y: originY - currentA.y * PX_PER_M,
    };

    // Position Vector r_A (from Global Origin to Current Position)
    drawArrow(ctx, originX, originY, currScreen.x, currScreen.y, '#38bdf8', { width: 2, head: 8, dash: [2, 2] });

    // Displacement Vector Δr_A (from Initial Position to Current Position)
    drawArrow(ctx, initScreen.x, initScreen.y, currScreen.x, currScreen.y, '#fbbf24', { width: 3, head: 12 });

    // Draw Initial and Current Dots
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.arc(initScreen.x, initScreen.y, 5, 0, Math.PI * 2);
    ctx.fill();
    drawTag(ctx, 'Initial (r_0)', initScreen.x + 8, initScreen.y + 12);

    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(currScreen.x, currScreen.y, 7, 0, Math.PI * 2);
    ctx.fill();
    drawTag(ctx, 'Object (r)', currScreen.x + 10, currScreen.y - 10, { color: '#38bdf8', bg: 'rgba(56,189,248,0.2)' });
  };

  return (
    <LabLayout
      title="Position, Displacement, and Reference Frames"
      category="Classical Mechanics"
      description="Explore position vectors, displacement independent of origin, and coordinate transformations between reference frames."
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Simulation Panel */}
        <div className="lg:col-span-8 space-y-6">
          <Panel title="Interactive Coordinate Laboratory" icon={Compass}>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="text-xs text-slate-400 font-mono">Trajectory:</span>
              {(['circle', 'linear', 'oscillation'] as TrajType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => handleTrajChange(type)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                    trajType === type
                      ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/25'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
              <SimCanvas height={CANVAS_HEIGHT} draw={draw} ariaLabel="Position and displacement canvas simulation" />
            </div>

            <div className="mt-4">
              <SimulationControls
                isPlaying={simState.isPlaying}
                speed={simState.speed}
                time={liveTime}
                onPlay={play}
                onPause={pause}
                onReset={reset}
                onStepForward={step}
                onSpeedChange={setSpeed}
              />
            </div>
          </Panel>

          {/* Readouts */}
          <ReadoutBar
            items={[
              { label: 'Time', value: liveTime.toFixed(2), unit: 's' },
              { label: 'Position (A)', value: `(${transformation.positionInA.x.toFixed(2)}, ${transformation.positionInA.y.toFixed(2)})`, unit: 'm' },
              { label: 'Displacement (A)', value: `(${transformation.displacementInA.x.toFixed(2)}, ${transformation.displacementInA.y.toFixed(2)})`, unit: 'm' },
              { label: 'Position (B)', value: `(${transformation.positionInB.x.toFixed(2)}, ${transformation.positionInB.y.toFixed(2)})`, unit: 'm' },
              { label: 'Displacement (B)', value: `(${transformation.displacementInB.x.toFixed(2)}, ${transformation.displacementInB.y.toFixed(2)})`, unit: 'm' },
            ]}
          />

          {/* Telemetry Chart */}
          <PhysicsChart
            data={telemetry.data}
            timeKey="time"
            lines={[
              { key: 'x_A', name: 'Global X (m)', color: '#38bdf8' },
              { key: 'y_A', name: 'Global Y (m)', color: '#10b981' },
              { key: 'x_B', name: 'Local X' , color: '#f43f5e' },
              { key: 'y_B', name: 'Local Y', color: '#fbbf24' },
            ]}
            height={220}
          />
        </div>

        {/* Controls & Sidebar Panel */}
        <div className="lg:col-span-4 space-y-6">
          <Panel title="Reference Frame B Settings" icon={Sliders}>
            <div className="space-y-5">
              <Slider
                label="Frame Origin X"
                value={frameParams.originB.x}
                min={-8}
                max={8}
                step={0.5}
                unit="m"
                onChange={(val) => updateFrame({ originB: { ...frameParams.originB, x: val } })}
              />
              <Slider
                label="Frame Origin Y"
                value={frameParams.originB.y}
                min={-8}
                max={8}
                step={0.5}
                unit="m"
                onChange={(val) => updateFrame({ originB: { ...frameParams.originB, y: val } })}
              />
              <Slider
                label="Frame Rotation"
                value={frameParams.rotationB}
                min={-180}
                max={180}
                step={5}
                unit="°"
                onChange={(val) => updateFrame({ rotationB: val })}
              />
            </div>
          </Panel>

          <Panel title="Core Physics Concepts" icon={Info}>
            <FormulaList
              formulas={[
                { name: 'Position Vector', latex: '\\vec{r} = x\\hat{i} + y\\hat{j}' },
                { name: 'Displacement', latex: '\\Delta\\vec{r} = \\vec{r}_f - \\vec{r}_i' },
                { name: 'Frame Transformation', latex: '\\vec{r}_B = R(-\\theta)(\\vec{r}_A - \\vec{O}_B)' },
              ]}
            />
            <div className="mt-4 text-xs text-slate-400 space-y-2">
              <p>
                <strong className="text-slate-200">Position</strong> specifies an object's precise location relative to a chosen origin.
              </p>
              <p>
                <strong className="text-slate-200">Displacement</strong> measures the straight-line vector change in position and is independent of the coordinate origin.
              </p>
              <p>
                <strong className="text-slate-200">Reference Frames</strong> allow observers in different positions or orientations to describe the same physical motion.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </LabLayout>
  );
};

export default PositionDisplacementPage;
