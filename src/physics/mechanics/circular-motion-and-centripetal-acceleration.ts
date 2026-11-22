/**
 * Circular Motion and Centripetal Acceleration
 *
 * Concepts & Equations:
 * 1. Angular Velocity (ω):
 *    ω = dθ/dt = v / r = 2π * f = 2π / T
 *
 * 2. Position r(t):
 *    r(t) = (r * cos(ω * t + θ0), r * sin(ω * t + θ0))
 *
 * 3. Tangential Velocity v(t):
 *    v(t) = (-r * ω * sin(ω * t + θ0), r * ω * cos(ω * t + θ0))
 *    Speed |v| = v = r * ω
 *
 * 4. Centripetal Acceleration ac(t):
 *    ac(t) = (-r * ω^2 * cos(ω * t + θ0), -r * ω^2 * sin(ω * t + θ0)) = -ω^2 * r(t)
 *    Magnitude |ac| = ac = v^2 / r = r * ω^2
 *
 * 5. Centripetal Force Fc:
 *    Fc = m * ac = m * v^2 / r = m * r * ω^2
 *
 * Assumptions:
 * - Ideal uniform circular motion (constant angular velocity ω unless specified).
 * - 2D planar motion in xy plane with center at origin or arbitrary center (cx, cy).
 */

import { Vec2 } from '../vector';

export interface CircularMotionParams {
  radius: number;          // r (m), r > 0
  angularVelocity: number; // ω (rad/s)
  mass: number;            // m (kg), m > 0
  initialAngle?: number;   // θ0 (rad), default 0
  center?: Vec2;           // Center of circle, default (0,0)
}

export interface CircularMotionState {
  time: number;
  angle: number;           // θ(t) (rad)
  position: Vec2;          // r(t) (m)
  velocity: Vec2;          // v(t) (m/s)
  acceleration: Vec2;      // ac(t) (m/s^2)
  speed: number;           // |v| (m/s)
  centripetalAccelMag: number; // |ac| (m/s^2)
  centripetalForceMag: number; // |Fc| (N)
  period: number;          // T (s)
  frequency: number;       // f (Hz)
}

export const DEFAULT_CIRCULAR_MOTION_PARAMS: CircularMotionParams = {
  radius: 5,
  angularVelocity: 2,
  mass: 1,
  initialAngle: 0,
  center: { x: 0, y: 0 },
};

/**
 * Calculates theoretical period T from angular velocity omega.
 */
export function calculatePeriod(omega: number): number {
  if (Math.abs(omega) < 1e-12) return Infinity;
  return (2 * Math.PI) / Math.abs(omega);
}

/**
 * Calculates frequency f from angular velocity omega.
 */
export function calculateFrequency(omega: number): number {
  return Math.abs(omega) / (2 * Math.PI);
}

/**
 * Calculates centripetal acceleration magnitude ac = r * ω^2.
 */
export function calculateCentripetalAcceleration(radius: number, omega: number): number {
  return radius * omega * omega;
}

/**
 * Calculates centripetal force magnitude Fc = m * r * ω^2.
 */
export function calculateCentripetalForce(mass: number, radius: number, omega: number): number {
  return mass * radius * omega * omega;
}

/**
 * Computes exact state at time t for uniform circular motion.
 */
export function getCircularMotionState(t: number, params: CircularMotionParams): CircularMotionState {
  const { radius, angularVelocity: omega, mass, initialAngle = 0, center = { x: 0, y: 0 } } = params;

  const currentAngle = initialAngle + omega * t;
  const cosTheta = Math.cos(currentAngle);
  const sinTheta = Math.sin(currentAngle);

  // Position relative to origin + center offset
  const rx = radius * cosTheta;
  const ry = radius * sinTheta;
  const position: Vec2 = { x: center.x + rx, y: center.y + ry };

  // Velocity: v = (-r*w*sin θ, r*w*cos θ)
  const velocity: Vec2 = {
    x: -radius * omega * sinTheta,
    y: radius * omega * cosTheta,
  };

  // Acceleration: a = (-r*w^2*cos θ, -r*w^2*sin θ) pointing toward center
  const acceleration: Vec2 = {
    x: -radius * omega * omega * cosTheta,
    y: -radius * omega * omega * sinTheta,
  };

  const speed = Math.abs(radius * omega);
  const centripetalAccelMag = calculateCentripetalAcceleration(radius, omega);
  const centripetalForceMag = calculateCentripetalForce(mass, radius, omega);
  const period = calculatePeriod(omega);
  const frequency = calculateFrequency(omega);

  return {
    time: t,
    angle: currentAngle,
    position,
    velocity,
    acceleration,
    speed,
    centripetalAccelMag,
    centripetalForceMag,
    period,
    frequency,
  };
}

/**
 * Integrates state forward by dt (analytical step).
 */
export function stepCircularMotion(
  currentState: CircularMotionState,
  dt: number,
  params: CircularMotionParams
): CircularMotionState {
  return getCircularMotionState(currentState.time + dt, params);
}
