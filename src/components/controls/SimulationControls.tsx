import React from 'react';
import { Play, Pause, RotateCcw, StepForward, Gauge } from 'lucide-react';
import { SimulationState } from '../../engine/SimulationEngine';

interface SimulationControlsProps {
  state: SimulationState;
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
  onStep: () => void;
  onSpeedChange: (speed: number) => void;
  className?: string;
}

export const SimulationControls: React.FC<SimulationControlsProps> = ({
  state,
  onPlay,
  onPause,
  onReset,
  onStep,
  onSpeedChange,
  className = '',
}) => {
  const isRunning = state.status === 'running';

  return (
    <div className={`flex flex-wrap items-center gap-3 bg-slate-900/90 border border-slate-800 rounded-xl px-4 py-2.5 shadow-lg backdrop-blur-md ${className}`}>
      {/* Play / Pause */}
      <button
        onClick={isRunning ? onPause : onPlay}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all shadow-sm ${
          isRunning
            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30'
            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30'
        }`}
        title={isRunning ? 'Pause (Space)' : 'Start Simulation (Space)'}
      >
        {isRunning ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
        <span>{isRunning ? 'Pause' : 'Start'}</span>
      </button>

      {/* Step */}
      <button
        onClick={onStep}
        disabled={isRunning}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium text-sm bg-slate-800 text-slate-300 border border-slate-700/60 hover:bg-slate-700/50 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        title="Advance 1 physics step"
      >
        <StepForward className="w-4 h-4" />
        <span className="hidden sm:inline">Step</span>
      </button>

      {/* Reset */}
      <button
        onClick={onReset}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium text-sm bg-slate-800 text-slate-300 border border-slate-700/60 hover:bg-rose-500/20 hover:text-rose-300 hover:border-rose-500/30 transition-all"
        title="Reset to initial state"
      >
        <RotateCcw className="w-4 h-4" />
        <span className="hidden sm:inline">Reset</span>
      </button>

      {/* Divider */}
      <div className="h-6 w-px bg-slate-800 mx-1 hidden sm:block" />

      {/* Speed Control */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Gauge className="w-4 h-4 text-sky-400" />
        <span className="hidden md:inline font-medium">Speed:</span>
        <div className="flex bg-slate-950/60 p-0.5 rounded-lg border border-slate-800">
          {[0.5, 1, 2, 5].map((s) => (
            <button
              key={s}
              onClick={() => onSpeedChange(s)}
              className={`px-2 py-1 rounded text-xs font-mono font-medium transition-all ${
                state.speed === s
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* Elapsed Time Display */}
      <div className="ml-auto flex items-center gap-2 font-mono text-xs bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800/80">
        <span className="text-slate-500">t =</span>
        <span className="text-sky-400 font-semibold">{state.time.toFixed(2)} s</span>
      </div>
    </div>
  );
};
