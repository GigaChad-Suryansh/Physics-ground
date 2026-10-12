/**
 * Wave Physics Module
 * 
 * Implements:
 *   - Transverse wave: y(x,t) = A·sin(kx - ωt + φ)
 *   - Superposition of two waves
 *   - Standing waves: y = 2A·sin(kx)·cos(ωt)
 *   - Simple Harmonic Motion: x(t) = A·cos(ωt + φ)
 * 
 * Relations:
 *   v = fλ
 *   ω = 2πf
 *   k = 2π/λ
 *   T = 1/f
 */

export interface WaveParams {
  amplitude: number;      // m
  frequency: number;      // Hz
  wavelength: number;     // m
  phase: number;          // radians
  waveType: 'transverse' | 'longitudinal';
}

export interface DualWaveParams {
  wave1: WaveParams;
  wave2: WaveParams;
  showSuperposition: boolean;
  showStandingWave: boolean;
}

export interface SHMParams {
  amplitude: number;      // m
  frequency: number;      // Hz
  mass: number;           // kg
  damping: number;        // damping coefficient (0 = undamped)
}

export type DampingRegime = 'undamped' | 'underdamped' | 'critical' | 'overdamped';

export interface SHMState {
  displacement: number;   // m
  velocity: number;       // m/s
  acceleration: number;   // m/s²
  time: number;
  springForce: number;    // N
  dampingForce: number;   // N (−c·v)
  kineticEnergy: number;
  potentialEnergy: number;
  totalEnergy: number;
}

export const DEFAULT_WAVE_PARAMS: WaveParams = {
  amplitude: 1,
  frequency: 1,
  wavelength: 2,
  phase: 0,
  waveType: 'transverse',
};

export const DEFAULT_DUAL_WAVE_PARAMS: DualWaveParams = {
  wave1: { ...DEFAULT_WAVE_PARAMS },
  wave2: { amplitude: 0.8, frequency: 1.2, wavelength: 2, phase: 0, waveType: 'transverse' },
  showSuperposition: true,
  showStandingWave: false,
};

export const DEFAULT_SHM_PARAMS: SHMParams = {
  amplitude: 1,
  frequency: 1,
  mass: 1,
  damping: 0,
};

/**
 * Calculate wave speed from frequency and wavelength.
 * v = fλ
 */
export function waveSpeed(frequency: number, wavelength: number): number {
  return frequency * wavelength;
}

/**
 * Angular frequency ω = 2πf
 */
export function angularFrequency(frequency: number): number {
  return 2 * Math.PI * frequency;
}

/**
 * Wave number k = 2π/λ
 */
export function waveNumber(wavelength: number): number {
  return (2 * Math.PI) / wavelength;
}

/**
 * Period T = 1/f
 */
export function period(frequency: number): number {
  return frequency > 0 ? 1 / frequency : Infinity;
}

/**
 * Displacement of a transverse wave at position x and time t.
 * y(x, t) = A·sin(kx - ωt + φ)
 */
export function waveDisplacement(
  params: WaveParams,
  x: number,
  t: number
): number {
  const k = waveNumber(params.wavelength);
  const omega = angularFrequency(params.frequency);
  return params.amplitude * Math.sin(k * x - omega * t + params.phase);
}

/**
 * Generate wave profile at time t for an array of x positions.
 */
export function generateWaveProfile(
  params: WaveParams,
  xMin: number,
  xMax: number,
  numPoints: number,
  t: number
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  const dx = (xMax - xMin) / numPoints;
  for (let i = 0; i <= numPoints; i++) {
    const x = xMin + i * dx;
    points.push({ x, y: waveDisplacement(params, x, t) });
  }
  return points;
}

/**
 * Superposition of two waves at position x and time t.
 */
export function superposition(
  wave1: WaveParams,
  wave2: WaveParams,
  x: number,
  t: number
): number {
  return waveDisplacement(wave1, x, t) + waveDisplacement(wave2, x, t);
}

/**
 * Spring constant for SHM: k = mω² = m(2πf)²
 */
export function springConstant(mass: number, frequency: number): number {
  const omega = angularFrequency(frequency);
  return mass * omega * omega;
}

/**
 * Which damping regime the oscillator is in.
 * Compares γ = c/2m (decay rate) with ω₀ = 2πf (natural angular frequency).
 */
export function getDampingRegime(params: SHMParams): DampingRegime {
  if (!(params.damping > 0)) return 'undamped';
  const omega0 = angularFrequency(params.frequency);
  const gamma = params.damping / (2 * params.mass);
  const rel = (gamma - omega0) / omega0;
  if (Math.abs(rel) < 1e-6) return 'critical';
  return gamma < omega0 ? 'underdamped' : 'overdamped';
}

/**
 * Standing wave from two equal counter-propagating waves:
 * y(x,t) = 2A·sin(kx)·cos(ωt)
 */
export function standingWaveDisplacement(
  params: WaveParams,
  x: number,
  t: number
): number {
  const k = waveNumber(params.wavelength);
  const omega = angularFrequency(params.frequency);
  return 2 * params.amplitude * Math.sin(k * x) * Math.cos(omega * t);
}

/**
 * Mass on a spring released from rest at x = A, solving  m·x'' + c·x' + k·x = 0
 * exactly (closed form) for every damping regime:
 *
 *   undamped      x = A·cos(ω₀t)
 *   underdamped   x = A·e^(−γt)·[cos(ω_d t) + (γ/ω_d)·sin(ω_d t)],  ω_d = √(ω₀² − γ²)
 *   critical      x = A·(1 + γt)·e^(−γt)
 *   overdamped    x = A/(2s)·[r₁e^(r₂t) − r₂e^(r₁t)],  r₁,₂ = −γ ± s,  s = √(γ² − ω₀²)
 *
 * where ω₀ = 2πf, γ = c/(2m). All of them satisfy x(0) = A and x'(0) = 0.
 */
export function getSHMState(params: SHMParams, t: number): SHMState {
  const omega0 = angularFrequency(params.frequency);
  const k = springConstant(params.mass, params.frequency);
  const c = Math.max(0, params.damping);
  const A = params.amplitude;
  const gamma = c / (2 * params.mass);
  const regime = getDampingRegime(params);

  let displacement: number;
  let velocity: number;

  switch (regime) {
    case 'undamped':
      displacement = A * Math.cos(omega0 * t);
      velocity = -A * omega0 * Math.sin(omega0 * t);
      break;
    case 'underdamped': {
      const wd = Math.sqrt(omega0 * omega0 - gamma * gamma);
      const env = Math.exp(-gamma * t);
      displacement = A * env * (Math.cos(wd * t) + (gamma / wd) * Math.sin(wd * t));
      velocity = -A * ((omega0 * omega0) / wd) * env * Math.sin(wd * t);
      break;
    }
    case 'critical': {
      const env = Math.exp(-gamma * t);
      displacement = A * (1 + gamma * t) * env;
      velocity = -A * gamma * gamma * t * env;
      break;
    }
    case 'overdamped': {
      const s = Math.sqrt(gamma * gamma - omega0 * omega0);
      const r1 = -gamma + s;
      const r2 = -gamma - s;
      const e1 = Math.exp(r1 * t);
      const e2 = Math.exp(r2 * t);
      displacement = (A / (2 * s)) * (r1 * e2 - r2 * e1);
      velocity = ((A * omega0 * omega0) / (2 * s)) * (e2 - e1);
      break;
    }
  }

  const springForce = -k * displacement;
  const dampingForce = -c * velocity;
  const acceleration = (springForce + dampingForce) / params.mass;
  const kineticEnergy = 0.5 * params.mass * velocity * velocity;
  const potentialEnergy = 0.5 * k * displacement * displacement;

  return {
    displacement,
    velocity,
    acceleration,
    time: t,
    springForce,
    dampingForce,
    kineticEnergy,
    potentialEnergy,
    totalEnergy: kineticEnergy + potentialEnergy,
  };
}
