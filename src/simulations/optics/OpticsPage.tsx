import React, { useRef, useEffect, useState, useCallback } from 'react';
import { LabLayout } from '../../components/layout/LabLayout';
import { MathFormula } from '../../components/ui/MathFormula';
import {
  OpticsParams,
  OpticalElement,
  DEFAULT_OPTICS_PARAMS,
  calculateImage,
  generatePrincipalRays,
} from '../../physics/optics/optics';
import { Sliders, Eye, Info, Sparkles } from 'lucide-react';

export const OpticsPage: React.FC = () => {
  const [params, setParams] = useState<OpticsParams>(DEFAULT_OPTICS_PARAMS);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Compute optical image formation
  const result = calculateImage(params);
  const rays = generatePrincipalRays(params, result);

  const drawOptics = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Background
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, width, height);

    const midX = width / 2;
    const midY = height / 2;
    const scale = 5; // pixels per cm

    // Principal Optical Axis
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(width, midY);
    ctx.stroke();

    // Optical element (Lens or Mirror) vertical plane at midX
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(midX, midY - 120);
    ctx.lineTo(midX, midY + 120);
    ctx.stroke();

    // Arrows on lens ends indicating converging vs diverging
    const isConverging = params.element === 'converging-lens' || params.element === 'concave-mirror';
    if (params.element.includes('lens')) {
      ctx.fillStyle = '#38bdf8';
      // top tip
      ctx.beginPath();
      if (isConverging) {
        ctx.moveTo(midX, midY - 125);
        ctx.lineTo(midX - 6, midY - 115);
        ctx.lineTo(midX + 6, midY - 115);
      } else {
        ctx.moveTo(midX, midY - 115);
        ctx.lineTo(midX - 6, midY - 125);
        ctx.lineTo(midX + 6, midY - 125);
      }
      ctx.fill();

      // bottom tip
      ctx.beginPath();
      if (isConverging) {
        ctx.moveTo(midX, midY + 125);
        ctx.lineTo(midX - 6, midY + 115);
        ctx.lineTo(midX + 6, midY + 115);
      } else {
        ctx.moveTo(midX, midY + 115);
        ctx.lineTo(midX - 6, midY + 125);
        ctx.lineTo(midX + 6, midY + 125);
      }
      ctx.fill();
    }

    // Focal Points (F and 2F)
    const fPx = Math.abs(result.signedFocalLength) * scale;
    const drawPoint = (x: number, label: string) => {
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.arc(x, midY, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.fillText(label, x - 5, midY + 15);
    };

    drawPoint(midX - fPx, 'F₁');
    drawPoint(midX + fPx, 'F₂');
    drawPoint(midX - 2 * fPx, '2F₁');
    drawPoint(midX + 2 * fPx, '2F₂');

    // Object Arrow (Green)
    const objX = midX - params.objectDistance * scale;
    const objY = midY - params.objectHeight * scale;

    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(objX, midY);
    ctx.lineTo(objX, objY);
    ctx.stroke();

    // Object Arrow Head
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.moveTo(objX, objY);
    ctx.lineTo(objX - 5, objY + 8);
    ctx.lineTo(objX + 5, objY + 8);
    ctx.fill();

    // Object Label
    ctx.font = '11px Inter, sans-serif';
    ctx.fillText('Object', objX - 16, objY - 8);

    // Image Arrow (Rose / Pink) if not infinity
    if (isFinite(result.imageDistance) && Math.abs(result.imageDistance) < 500) {
      const isMirror = params.element.includes('mirror');
      const imgX = isMirror
        ? midX - result.imageDistance * scale
        : midX + result.imageDistance * scale;
      const imgY = midY - result.imageHeight * scale;

      ctx.strokeStyle = result.isReal ? '#ec4899' : '#a855f7';
      if (!result.isReal) ctx.setLineDash([4, 4]); // virtual dashed
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(imgX, midY);
      ctx.lineTo(imgX, imgY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Image arrow head
      ctx.fillStyle = result.isReal ? '#ec4899' : '#a855f7';
      const arrowDir = result.imageHeight >= 0 ? -1 : 1;
      ctx.beginPath();
      ctx.moveTo(imgX, imgY);
      ctx.lineTo(imgX - 5, imgY - arrowDir * 8);
      ctx.lineTo(imgX + 5, imgY - arrowDir * 8);
      ctx.fill();

      ctx.fillText(result.isReal ? 'Real Image' : 'Virtual Image', imgX - 25, imgY + (arrowDir > 0 ? 18 : -8));
    }

    // Principal Rays
    rays.forEach((r) => {
      if (r.points.length < 2) return;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();

      const toScreenX = (x: number) => midX + x * scale;
      const toScreenY = (y: number) => midY - y * scale;

      ctx.moveTo(toScreenX(r.points[0].x), toScreenY(r.points[0].y));
      for (let i = 1; i < r.points.length; i++) {
        ctx.lineTo(toScreenX(r.points[i].x), toScreenY(r.points[i].y));
      }
      ctx.stroke();
    });
  }, [params, result, rays]);

  useEffect(() => {
    drawOptics();
  }, [drawOptics]);

  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = canvas.parentElement?.clientWidth || 800;
        canvas.height = 360;
        drawOptics();
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawOptics]);

  return (
    <LabLayout title="Geometric Optics & Ray Tracing" category="Optics & Waves">
      <div className="space-y-6">
        {/* Optical Element Switcher */}
        <div className="flex flex-wrap items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl p-2.5">
          <span className="text-xs font-mono uppercase text-slate-500 font-semibold px-2">
            Element Type:
          </span>
          {(
            [
              'converging-lens',
              'diverging-lens',
              'concave-mirror',
              'convex-mirror',
            ] as OpticalElement[]
          ).map((elem) => (
            <button
              key={elem}
              onClick={() => setParams((p) => ({ ...p, element: elem }))}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                params.element === elem
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {elem.replace('-', ' ')}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {/* Visual Ray Tracing Canvas */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl relative">
              <div className="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
                <span className="text-xs font-mono font-medium text-slate-400">
                  Principal Ray Tracing & Image Formation
                </span>
                <span className="text-xs font-mono text-rose-400 font-bold">{result.nature}</span>
              </div>
              <div className="w-full relative">
                <canvas ref={canvasRef} className="w-full block" />
              </div>
              <div className="p-3 bg-slate-950/80 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                <div>
                  <span className="text-slate-500">Image Dist (v): </span>
                  <span className="text-rose-400 font-bold">
                    {isFinite(result.imageDistance) ? `${result.imageDistance.toFixed(2)} cm` : 'Infinity'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Magnification (m): </span>
                  <span className="text-sky-400 font-bold">
                    {isFinite(result.magnification) ? `${result.magnification.toFixed(2)}x` : 'Infinity'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Image Height (h_i): </span>
                  <span className="text-purple-400 font-bold">
                    {isFinite(result.imageHeight) ? `${result.imageHeight.toFixed(2)} cm` : 'Infinity'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Focal Length (f): </span>
                  <span className="text-emerald-400 font-bold">{result.signedFocalLength} cm</span>
                </div>
              </div>
            </div>

            {/* Ray Diagram Legend Card */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="w-3 h-0.5 bg-red-500" />
                <span className="text-slate-300">Ray 1: Parallel to Axis → Focal Point</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-0.5 bg-green-500" />
                <span className="text-slate-300">Ray 2: Undeviated through Optical Center</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-0.5 bg-blue-500" />
                <span className="text-slate-300">Ray 3: Through Focal Point → Parallel</span>
              </div>
            </div>
          </div>

          {/* Controls & Optics Math */}
          <div className="space-y-5">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <Sliders className="w-4 h-4 text-rose-400" />
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                  Optical Parameters
                </h3>
              </div>

              {/* Object Distance (u) */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Object Distance (u)</span>
                  <span className="font-mono text-emerald-400 font-semibold">{params.objectDistance} cm</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="60"
                  step="1"
                  value={params.objectDistance}
                  onChange={(e) => setParams((p) => ({ ...p, objectDistance: Number(e.target.value) }))}
                  className="w-full accent-emerald-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Focal Length (f) */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Focal Length (|f|)</span>
                  <span className="font-mono text-sky-400 font-semibold">{params.focalLength} cm</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="35"
                  step="1"
                  value={params.focalLength}
                  onChange={(e) => setParams((p) => ({ ...p, focalLength: Number(e.target.value) }))}
                  className="w-full accent-sky-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Object Height (h_o) */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Object Height (h_o)</span>
                  <span className="font-mono text-purple-400 font-semibold">{params.objectHeight} cm</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="15"
                  step="0.5"
                  value={params.objectHeight}
                  onChange={(e) => setParams((p) => ({ ...p, objectHeight: Number(e.target.value) }))}
                  className="w-full accent-purple-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>

            {/* Geometric Formulas */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                <Info className="w-4 h-4 text-rose-400" />
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Lens & Mirror Equations
                </h3>
              </div>
              <div className="space-y-2 text-xs text-slate-300">
                <div className="p-2 rounded bg-slate-950/80 border border-slate-800/80 overflow-x-auto">
                  <MathFormula formula="\frac{1}{f} = \frac{1}{v} - \frac{1}{u} \implies v = \frac{u f}{u - f}" />
                </div>
                <div className="p-2 rounded bg-slate-950/80 border border-slate-800/80 overflow-x-auto">
                  <MathFormula formula="m = \frac{h_i}{h_o} = \frac{v}{u}" />
                </div>
                <div className="p-2 rounded bg-slate-950/80 border border-slate-800/80 overflow-x-auto">
                  <MathFormula formula="\text{Power } P = \frac{1}{f \text{ (meters)}} \quad (\text{Diopters})" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </LabLayout>
  );
};
