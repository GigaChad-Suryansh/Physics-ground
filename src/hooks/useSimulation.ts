/**
 * useSimulation hook — React integration for SimulationEngine.
 * Provides reactive state and control methods.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { SimulationEngine, SimulationCallbacks, SimulationState } from '../engine/SimulationEngine';

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
  setSpeed: (speed: number) => void;
  isRunning: boolean;
  isPaused: boolean;
}

export function useSimulation(options: UseSimulationOptions): UseSimulationReturn {
  const [state, setState] = useState<SimulationState>(() => ({
    status: 'idle',
    time: 0,
    speed: 1,
    dt: options.dt ?? 1 / 120,
    frameCount: 0,
  }));

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

  return {
    state,
    play: useCallback(() => engine.play(), [engine]),
    pause: useCallback(() => engine.pause(), [engine]),
    reset: useCallback(() => engine.reset(), [engine]),
    step: useCallback(() => engine.step(), [engine]),
    setSpeed: useCallback((s: number) => engine.setSpeed(s), [engine]),
    isRunning: state.status === 'running',
    isPaused: state.status === 'paused',
  };
}
