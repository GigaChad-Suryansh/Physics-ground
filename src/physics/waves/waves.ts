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

export interface SHMState {
  displacement: number;   // m
  velocity: number;       // m/s
  acceleration: number;   // m/s²
  time: number;
  springForce: number;    // N
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
 * SHM state at time t (undamped).
 * x(t) = A·cos(ωt)
 * v(t) = -Aω·sin(ωt)
 * a(t) = -Aω²·cos(ωt)
 */
export function getSHMState(params: SHMParams, t: number): SHMState {
  const omega = angularFrequency(params.frequency);
  const k = springConstant(params.mass, params.frequency);

  let displacement: number;
  let velocity: number;

  if (params.damping > 0) {
    // Under-damped SHM: x(t) = A·e^(-γt)·cos(ω't)
    const gamma = params.damping / (2 * params.mass);
    const omegaPrime = Math.sqrt(Math.max(0, omega * omega - gamma * gamma));
    const envelope = Math.exp(-gamma * t);
    displacement = params.amplitude * envelope * Math.cos(omegaPrime * t);
    velocity = params.amplitude * envelope * (
      -gamma * Math.cos(omegaPrime * t) - omegaPrime * Math.sin(omegaPrime * t)
    );
  } else {
    displacement = params.amplitude * Math.cos(omega * t);
    velocity = -params.amplitude * omega * Math.sin(omega * t);
  }

  const acceleration = -(k / params.mass) * displacement;
  const springForce = -k * displacement;
  const kineticEnergy = 0.5 * params.mass * velocity * velocity;
  const potentialEnergy = 0.5 * k * displacement * displacement;

  return {
    displacement,
    velocity,
    acceleration,
    time: t,
    springForce,
    kineticEnergy,
    potentialEnergy,
    totalEnergy: kineticEnergy + potentialEnergy,
  };
}
