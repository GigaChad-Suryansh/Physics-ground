/**
 * Projectile Motion Physics
 * 
 * Analytical solutions for ideal projectile motion (no drag):
 *   x(t) = x₀ + v₀cos(θ)·t
 *   y(t) = y₀ + v₀sin(θ)·t - ½g·t²
 *   vₓ(t) = v₀cos(θ)
 *   vᵧ(t) = v₀sin(θ) - g·t
 * 
 * With quadratic drag (optional):
 *   Uses numerical integration (RK4) since no closed-form exists.
 */

import { DEG_TO_RAD } from '../constants';
import type { Vec2 } from '../vector';

export interface ProjectileParams {
  velocity: number;       // m/s
  angle: number;          // degrees
  gravity: number;        // m/s² (positive downward)
  height: number;         // initial height in m
  dragEnabled: boolean;
  dragCoefficient: number; // dimensionless
  mass: number;           // kg (for drag: F_drag = -½ρCdA|v|v, simplified to -k|v|v)
}

export interface ProjectileState {
  position: Vec2;
  velocity: Vec2;
  time: number;
  hasLanded: boolean;
}

export interface ProjectileAnalytical {
  maxHeight: number;
  range: number;
  flightTime: number;
  timeToApex: number;
}

/** Default parameters for projectile simulation */
export const DEFAULT_PROJECTILE_PARAMS: ProjectileParams = {
  velocity: 30,
  angle: 45,
  gravity: 9.81,
  height: 0,
  dragEnabled: false,
  dragCoefficient: 0.01,
  mass: 1,
};

/** Create initial state from parameters */
export function createInitialState(params: ProjectileParams): ProjectileState {
  const rad = params.angle * DEG_TO_RAD;
  return {
    position: { x: 0, y: params.height },
    velocity: {
      x: params.velocity * Math.cos(rad),
      y: params.velocity * Math.sin(rad),
    },
    time: 0,
    hasLanded: false,
  };
}

/**
 * Analytical solutions for ideal projectile (no drag, flat ground).
 * Valid when dragEnabled=false.
 */
export function getAnalyticalSolution(params: ProjectileParams): ProjectileAnalytical {
  const rad = params.angle * DEG_TO_RAD;
  const v0x = params.velocity * Math.cos(rad);
  const v0y = params.velocity * Math.sin(rad);
  const g = params.gravity;
  const h0 = params.height;

  // Time to apex: v0y - g*t = 0
  const timeToApex = v0y / g;

  // Max height: h0 + v0y²/(2g)
  const maxHeight = h0 + (v0y * v0y) / (2 * g);

  // Flight time: solve h0 + v0y*t - 0.5*g*t² = 0 using quadratic formula
  // -0.5g*t² + v0y*t + h0 = 0 => t = (v0y + sqrt(v0y² + 2gh0)) / g
  const discriminant = v0y * v0y + 2 * g * h0;
  const flightTime = discriminant >= 0 ? (v0y + Math.sqrt(discriminant)) / g : 0;

  // Range
  const range = v0x * flightTime;

  return { maxHeight, range, flightTime, timeToApex };
}

/**
 * Get analytical position at time t (no drag).
 */
export function analyticalPosition(params: ProjectileParams, t: number): Vec2 {
  const rad = params.angle * DEG_TO_RAD;
  const v0x = params.velocity * Math.cos(rad);
  const v0y = params.velocity * Math.sin(rad);
  const g = params.gravity;

  return {
    x: v0x * t,
    y: params.height + v0y * t - 0.5 * g * t * t,
  };
}

/**
 * Step the projectile forward by dt using Euler integration.
 * For no-drag case, this matches analytical solution within dt tolerance.
 * For drag case, uses simplified quadratic drag model.
 */
export function stepProjectile(
  state: ProjectileState,
  params: ProjectileParams,
  dt: number
): ProjectileState {
  if (state.hasLanded) return state;

  let ax = 0;
  let ay = -params.gravity;

  // Quadratic drag: F = -k*|v|*v (simplified model)
  if (params.dragEnabled && params.mass > 0) {
    const speed = Math.sqrt(
      state.velocity.x * state.velocity.x + state.velocity.y * state.velocity.y
    );
    if (speed > 0) {
      const dragForce = params.dragCoefficient * speed;
      ax -= (dragForce * state.velocity.x) / params.mass;
      ay -= (dragForce * state.velocity.y) / params.mass;
    }
  }

  // Semi-implicit Euler (velocity first, then position)
  const newVx = state.velocity.x + ax * dt;
  const newVy = state.velocity.y + ay * dt;
  const newX = state.position.x + newVx * dt;
  const newY = state.position.y + newVy * dt;

  const newTime = state.time + dt;

  // Ground collision detection
  if (newY <= 0 && state.position.y >= 0) {
    // Linear interpolation to find exact landing time
    const t_ground = state.position.y / (state.position.y - newY) * dt;
    const landX = state.position.x + state.velocity.x * t_ground;
    return {
      position: { x: landX, y: 0 },
      velocity: { x: newVx, y: newVy },
      time: state.time + t_ground,
      hasLanded: true,
    };
  }

  return {
    position: { x: newX, y: Math.max(0, newY) },
    velocity: { x: newVx, y: newVy },
    time: newTime,
    hasLanded: newY < 0,
  };
}

/**
 * Generate the full analytical trajectory curve for preview.
 */
export function generateAnalyticalTrajectory(
  params: ProjectileParams,
  numPoints: number = 100
): Vec2[] {
  const solution = getAnalyticalSolution(params);
  const points: Vec2[] = [];

  for (let i = 0; i <= numPoints; i++) {
    const t = (i / numPoints) * solution.flightTime;
    const pos = analyticalPosition(params, t);
    if (pos.y < 0) break;
    points.push(pos);
  }

  return points;
}
