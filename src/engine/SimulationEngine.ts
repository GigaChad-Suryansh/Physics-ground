/**
 * Simulation Engine — Central simulation clock and state management.
 * 
 * Provides a unified simulation loop with play/pause/reset/step controls,
 * adjustable speed, and consistent time tracking. All simulations use this
 * engine to decouple simulation state from rendering.
 */

export type SimulationStatus = 'idle' | 'running' | 'paused' | 'finished';

export interface SimulationState {
  status: SimulationStatus;
  time: number;           // Simulation time in seconds
  speed: number;          // Speed multiplier (1 = real-time)
  dt: number;             // Fixed time step in seconds
  frameCount: number;
}

export interface SimulationCallbacks {
  /** Called each physics step with (dt, totalTime) */
  onStep: (dt: number, totalTime: number) => void;
  /** Called when simulation is reset */
  onReset?: () => void;
  /** Called when simulation finishes (if applicable) */
  onFinish?: () => void;
}

export class SimulationEngine {
  private state: SimulationState;
  private callbacks: SimulationCallbacks;
  private animFrameId: number | null = null;
  private lastTimestamp: number | null = null;
  private accumulator: number = 0;
  private listeners: Set<() => void> = new Set();

  constructor(callbacks: SimulationCallbacks, dt: number = 1 / 120) {
    this.callbacks = callbacks;
    this.state = {
      status: 'idle',
      time: 0,
      speed: 1,
      dt,
      frameCount: 0,
    };
  }

  getState(): Readonly<SimulationState> {
    return this.state;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(fn => fn());
  }

  play() {
    if (this.state.status === 'running') return;
    this.state = { ...this.state, status: 'running' };
    this.lastTimestamp = null;
    this.accumulator = 0;
    this.startLoop();
    this.notify();
  }

  pause() {
    if (this.state.status !== 'running') return;
    this.state = { ...this.state, status: 'paused' };
    this.stopLoop();
    this.notify();
  }

  reset() {
    this.stopLoop();
    this.state = {
      ...this.state,
      status: 'idle',
      time: 0,
      frameCount: 0,
    };
    this.accumulator = 0;
    this.lastTimestamp = null;
    this.callbacks.onReset?.();
    this.notify();
  }

  step() {
    if (this.state.status === 'running') return;
    if (this.state.status === 'idle') {
      this.state = { ...this.state, status: 'paused' };
    }
    this.doStep(this.state.dt);
    this.notify();
  }

  setSpeed(speed: number) {
    this.state = { ...this.state, speed: Math.max(0.1, Math.min(10, speed)) };
    this.notify();
  }

  finish() {
    this.stopLoop();
    this.state = { ...this.state, status: 'finished' };
    this.callbacks.onFinish?.();
    this.notify();
  }

  destroy() {
    this.stopLoop();
    this.listeners.clear();
  }

  private doStep(dt: number) {
    this.callbacks.onStep(dt, this.state.time);
    this.state = {
      ...this.state,
      time: this.state.time + dt,
      frameCount: this.state.frameCount + 1,
    };
  }

  private startLoop() {
    const loop = (timestamp: number) => {
      if (this.state.status !== 'running') return;

      if (this.lastTimestamp === null) {
        this.lastTimestamp = timestamp;
        this.animFrameId = requestAnimationFrame(loop);
        return;
      }

      // Wall-clock elapsed time, capped to avoid spiral of death
      const wallDt = Math.min((timestamp - this.lastTimestamp) / 1000, 0.1);
      this.lastTimestamp = timestamp;

      // Accumulate scaled time
      this.accumulator += wallDt * this.state.speed;

      // Fixed-step integration. The cap scales with speed so that fast-forward
      // keeps up (wallDt ≤ 0.1 s → at most speed·0.1/dt steps are ever owed),
      // while still protecting against a runaway frame.
      let stepsThisFrame = 0;
      const maxSteps = Math.max(20, Math.ceil((0.1 * this.state.speed) / this.state.dt) + 1);
      while (this.accumulator >= this.state.dt && stepsThisFrame < maxSteps) {
        this.doStep(this.state.dt);
        this.accumulator -= this.state.dt;
        stepsThisFrame++;
        // A callback (e.g. "projectile landed") may have paused/finished us.
        if (this.state.status !== 'running') break;
      }

      // If we hit the cap, drop the backlog instead of letting it grow forever.
      if (stepsThisFrame >= maxSteps) this.accumulator = 0;

      if (stepsThisFrame > 0) {
        this.notify();
      }

      if (this.state.status === 'running') {
        this.animFrameId = requestAnimationFrame(loop);
      }
    };

    this.animFrameId = requestAnimationFrame(loop);
  }

  private stopLoop() {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.lastTimestamp = null;
    this.accumulator = 0;
  }
}
