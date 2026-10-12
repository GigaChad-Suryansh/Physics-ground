import React, { useEffect } from 'react';
import { Play, Pause, RotateCcw, StepForward, Gauge, RefreshCw } from 'lucide-react';
import type { SimulationState } from '../../engine/SimulationEngine';

interface SimulationControlsProps {
  state: SimulationState;
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
  onStep: () => void;
  onSpeedChange: (speed: number) => void;
  className?: string;
  /** Extra content on the right of the bar (e.g. an event badge). */
  extra?: React.ReactNode;
}

const SPEEDS = [0.25, 0.5, 1, 2, 5];

const STATUS_LABEL: Record<SimulationState['status'], { text: string; dot: string }> = {
  idle: { text: 'Ready', dot: 'bg-slate-500' },
  running: { text: 'Running', dot: 'bg-emerald-400 animate-pulse' },
  paused: { text: 'Paused', dot: 'bg-amber-400' },
  finished: { text: 'Finished', dot: 'bg-sky-400' },
};

export const SimulationControls: React.FC<SimulationControlsProps> = ({
  state,
  onPlay,
  onPause,
  onReset,
  onStep,
  onSpeedChange,
  className = '',
  extra,
}) => {
  const isRunning = state.status === 'running';
  const isFinished = state.status === 'finished';
  const status = STATUS_LABEL[state.status];

  // Space toggles play / pause (unless the user is typing or pressing a button,
  // which already handles Space natively).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      const isRange = tag === 'INPUT' && (el as HTMLInputElement).type === 'range';
      if (tag === 'BUTTON' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return;
      if (tag === 'INPUT' && !isRange) return;
      e.preventDefault();
      if (isRunning) onPause();
      else onPlay();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isRunning, onPause, onPlay]);

  return (
    <div
      className={`flex flex-wrap items-center gap-3 rounded-xl border border-slate-800/90 bg-slate-900/80 px-4 py-2.5 shadow-lg shadow-black/20 backdrop-blur-md ${className}`}
    >
      {/* Play / Pause / Replay */}
      <button
        onClick={isRunning ? onPause : onPlay}
        className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium shadow-sm transition-all ${
          isRunning
            ? 'border-amber-500/30 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
            : 'border-emerald-500/30 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
        }`}
        title={isRunning ? 'Pause (Space)' : isFinished ? 'Run again (Space)' : 'Start (Space)'}
      >
        {isRunning ? (
          <Pause className="h-4 w-4 fill-current" />
        ) : isFinished ? (
          <RefreshCw className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4 fill-current" />
        )}
        <span>{isRunning ? 'Pause' : isFinished ? 'Replay' : state.status === 'paused' ? 'Resume' : 'Start'}</span>
      </button>

      {/* Step */}
      <button
        onClick={onStep}
        disabled={isRunning || isFinished}
        className="flex items-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-300 transition-all hover:bg-slate-700/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        title="Advance one physics step (1/120 s)"
      >
        <StepForward className="h-4 w-4" />
        <span className="hidden sm:inline">Step</span>
      </button>

      {/* Reset */}
      <button
        onClick={onReset}
        className="flex items-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-300 transition-all hover:border-rose-500/30 hover:bg-rose-500/20 hover:text-rose-300"
        title="Reset to the initial state"
      >
        <RotateCcw className="h-4 w-4" />
        <span className="hidden sm:inline">Reset</span>
      </button>

      <div className="mx-1 hidden h-6 w-px bg-slate-800 sm:block" />

      {/* Speed Control */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Gauge className="h-4 w-4 text-sky-400" />
        <span className="hidden font-medium md:inline">Speed</span>
        <div className="flex rounded-lg border border-slate-800 bg-slate-950/60 p-0.5">
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => onSpeedChange(s)}
              className={`rounded border px-2 py-1 font-mono text-xs font-medium transition-all ${
                state.speed === s
                  ? 'border-sky-500/40 bg-sky-500/20 text-sky-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>

      {extra}

      {/* Status + elapsed time */}
      <div className="ml-auto flex items-center gap-3">
        <div className="hidden items-center gap-2 text-xs text-slate-400 sm:flex">
          <span className={`h-2 w-2 rounded-full ${status.dot}`} />
          <span>{status.text}</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-slate-800/80 bg-slate-950/80 px-3 py-1.5 font-mono text-xs">
          <span className="text-slate-500">t =</span>
          <span className="w-14 text-right font-semibold tabular-nums text-sky-400">
            {state.time.toFixed(2)} s
          </span>
        </div>
      </div>
    </div>
  );
};
