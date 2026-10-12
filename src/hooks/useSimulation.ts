/**
 * useSimulation hook — React integration for SimulationEngine.
 * Provides reactive state and control methods.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { SimulationEngine } from '../engine/SimulationEngine';
import type { SimulationCallbacks, SimulationState } from '../engine/SimulationEngine';

export interface UseSimulationOptions {
  dt?: number;
  onStep: (dt: number, totalTime: number) => void;
  onReset?: () => void;
  onFinish?: () => void;
}

export interface UseSimulationReturn {
  state: SimulationState;
  play: () => void;
  pause: () => void;
  reset: () => void;
  step: () => void;
  /** Stop the clock for good (e.g. the projectile landed). Start restarts the run. */
  finish: () => void;
  /** Play, but if the run already finished, restart it from the beginning first. */
  playOrRestart: () => void;
  setSpeed: (speed: number) => void;
  isRunning: boolean;
  isPaused: boolean;
  isFinished: boolean;
}

export function useSimulation(options: UseSimulationOptions): UseSimulationReturn {
  const [state, setState] = useState<SimulationState>(() => ({
    status: 'idle',
    time: 0,
    speed: 1,
    dt: options.dt ?? 1 / 120,
    frameCount: 0,
  }));

  // Always call the latest callbacks without recreating the engine.
  const callbacksRef = useRef<SimulationCallbacks>(options);
  callbacksRef.current = {
    onStep: options.onStep,
    onReset: options.onReset,
    onFinish: options.onFinish,
  };

  const engineRef = useRef<SimulationEngine | null>(null);

  if (!engineRef.current) {
    engineRef.current = new SimulationEngine(
      {
        onStep: (dt, t) => callbacksRef.current.onStep(dt, t),
        onReset: () => callbacksRef.current.onReset?.(),
        onFinish: () => callbacksRef.current.onFinish?.(),
      },
      options.dt ?? 1 / 120
    );
  }

  const engine = engineRef.current;

  useEffect(() => {
    const unsubscribe = engine.subscribe(() => {
      setState(engine.getState());
    });
    return () => {
      unsubscribe();
      engine.destroy();
    };
  }, [engine]);

  const play = useCallback(() => engine.play(), [engine]);
  const reset = useCallback(() => engine.reset(), [engine]);

  return {
    state,
    play,
    pause: useCallback(() => engine.pause(), [engine]),
    reset,
    step: useCallback(() => engine.step(), [engine]),
    finish: useCallback(() => engine.finish(), [engine]),
    playOrRestart: useCallback(() => {
      if (engine.getState().status === 'finished') engine.reset();
      engine.play();
    }, [engine]),
    setSpeed: useCallback((s: number) => engine.setSpeed(s), [engine]),
    isRunning: state.status === 'running',
    isPaused: state.status === 'paused',
    isFinished: state.status === 'finished',
  };
}
