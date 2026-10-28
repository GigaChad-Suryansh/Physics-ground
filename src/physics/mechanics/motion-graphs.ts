/**
 * Motion Graphs Physics Module
 *
 * Concepts and Equations:
 * 1. Position x(t): The location of an object as a function of time.
 *    - Uniform Motion: x(t) = x0 + v0 * t
 *    - Constant Acceleration: x(t) = x0 + v0 * t + 0.5 * a * t^2
 *    - Harmonic Motion: x(t) = A * cos(ω * t + φ)
 *
 * 2. Velocity v(t): The derivative of position with respect to time (dx/dt).
 *    - Slope of x-t graph = Velocity v(t)
 *    - Uniform Motion: v(t) = v0
 *    - Constant Acceleration: v(t) = v0 + a * t
 *    - Harmonic Motion: v(t) = -A * ω * sin(ω * t + φ)
 *
 * 3. Acceleration a(t): The derivative of velocity with respect to time (dv/dt).
 *    - Slope of v-t graph = Acceleration a(t)
 *    - Uniform Motion: a(t) = 0
 *    - Constant Acceleration: a(t) = a
 *    - Harmonic Motion: a(t) = -A * ω^2 * cos(ω * t + φ)
 *
 * 4. Integrals and Areas:
 *    - Area under v-t graph = Displacement Δx
 *    - Area under a-t graph = Change in velocity Δv
 */

export type MotionProfileType = 'uniform' | 'constant-acceleration' | 'harmonic';

export interface MotionGraphParams {
  type: MotionProfileType;
  initialPosition: number; // x0 (m)
  initialVelocity: number; // v0 (m/s)
  acceleration: number;    // a (m/s^2) for constant-acceleration
  amplitude: number;       // A (m) for harmonic
  frequency: number;       // f (Hz) for harmonic
  phase: number;           // φ (rad) for harmonic
}

export interface MotionGraphState {
  time: number;
  position: number;
  velocity: number;
  acceleration: number;
}

export const DEFAULT_MOTION_GRAPH_PARAMS: MotionGraphParams = {
  type: 'constant-acceleration',
  initialPosition: 0,
  initialVelocity: 5,
  acceleration: -2,
  amplitude: 2,
  frequency: 0.5,
  phase: 0,
};

/**
 * Calculates position, velocity, and acceleration at time t for a given motion profile.
 */
export function getMotionGraphState(t: number, params: MotionGraphParams): MotionGraphState {
  const { type, initialPosition, initialVelocity, acceleration, amplitude, frequency, phase } = params;

  if (t < 0) {
    return { time: 0, position: initialPosition, velocity: 0, acceleration: 0 };
  }

  let position = initialPosition;
  let velocity = initialVelocity;
  let accel = 0;

  switch (type) {
    case 'uniform':
      position = initialPosition + initialVelocity * t;
      velocity = initialVelocity;
      accel = 0;
      break;

    case 'constant-acceleration':
      position = initialPosition + initialVelocity * t + 0.5 * acceleration * t * t;
      velocity = initialVelocity + acceleration * t;
      accel = acceleration;
      break;

    case 'harmonic': {
      const omega = 2 * Math.PI * frequency;
      const angle = omega * t + phase;
      position = amplitude * Math.cos(angle);
      velocity = -amplitude * omega * Math.sin(angle);
      accel = -amplitude * omega * omega * Math.cos(angle);
      break;
    }
  }

  return {
    time: t,
    position,
    velocity,
    acceleration: accel,
  };
}

/**
 * Calculates displacement Δx over a time interval [t1, t2].
 */
export function calculateDisplacement(t1: number, t2: number, params: MotionGraphParams): number {
  const s1 = getMotionGraphState(t1, params);
  const s2 = getMotionGraphState(t2, params);
  return s2.position - s1.position;
}

/**
 * Calculates change in velocity Δv over a time interval [t1, t2].
 */
export function calculateVelocityChange(t1: number, t2: number, params: MotionGraphParams): number {
  const s1 = getMotionGraphState(t1, params);
  const s2 = getMotionGraphState(t2, params);
  return s2.velocity - s1.velocity;
}

/**
 * Generates sample data points for graphing over a given duration.
 */
export function generateMotionGraphData(
  params: MotionGraphParams,
  duration: number,
  samples: number = 50
): MotionGraphState[] {
  const data: MotionGraphState[] = [];
  const step = duration / Math.max(1, samples - 1);
  for (let i = 0; i < samples; i++) {
    const t = i * step;
    data.push(getMotionGraphState(t, params));
  }
  return data;
}
