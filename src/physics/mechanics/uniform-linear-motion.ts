/**
 * Uniform Linear Motion (Constant Velocity Motion)
 *
 * Concept:
 * Uniform linear motion occurs when an object moves along a straight line at a constant speed,
 * meaning its acceleration is zero (a = 0) and its velocity (v) remains constant over time.
 *
 * Key Equations:
 * 1. Position x(t):
 *    x(t) = x_0 + v * t
 *    where x_0 is initial position, v is constant velocity, and t is time.
 *
 * 2. Velocity v(t):
 *    v(t) = v = constant
 *
 * 3. Acceleration a(t):
 *    a(t) = 0
 *
 * 4. Displacement Δx over interval [t1, t2]:
 *    Δx = v * (t2 - t1)
 *
 * Assumptions:
 * - Motion occurs in 1D or 2D along a straight path without turning or changing direction.
 * - Net force on the object is zero (Newton's First Law).
 * - Friction, air resistance, and external forces are zero.
 */

import { Vec2, add, scale, magnitude } from '../vector';

export interface UniformLinearParams {
  initialPosition: Vec2;
  velocity: Vec2;
}

export interface UniformLinearState {
  time: number;
  position: Vec2;
  velocity: Vec2;
  acceleration: Vec2;
  displacement: Vec2;
  distanceTraveled: number;
}

export const DEFAULT_UNIFORM_LINEAR_PARAMS: UniformLinearParams = {
  initialPosition: { x: 0, y: 0 },
  velocity: { x: 5, y: 0 }, // 5 m/s in x-direction
};

/**
 * Calculates exact analytical state at time t for uniform linear motion.
 */
export function getUniformLinearState(
  t: number,
  params: UniformLinearParams = DEFAULT_UNIFORM_LINEAR_PARAMS
): UniformLinearState {
  const time = Math.max(0, t);
  const { initialPosition, velocity } = params;

  const displacement = scale(velocity, time);
  const position = add(initialPosition, displacement);
  const distanceTraveled = magnitude(displacement);

  return {
    time,
    position,
    velocity: { ...velocity },
    acceleration: { x: 0, y: 0 },
    displacement,
    distanceTraveled,
  };
}

/**
 * Calculates position at specific time t given x0 and v.
 */
export function calculatePosition1D(x0: number, v: number, t: number): number {
  return x0 + v * Math.max(0, t);
}

/**
 * Calculates displacement over a given time interval Δt.
 */
export function calculateDisplacement1D(v: number, deltaTime: number): number {
  return v * Math.max(0, deltaTime);
}

/**
 * Calculates time required to travel a distance d at constant speed v.
 * Returns Infinity if v is 0 and d > 0, or 0 if d <= 0.
 */
export function calculateTimeToReach(distance: number, speed: number): number {
  if (distance <= 0) return 0;
  if (speed <= 0) return Infinity;
  return distance / speed;
}
