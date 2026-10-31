/**
 * Projectile Motion
 *
 * Concepts & Analytical Equations:
 * 1. Initial Velocity Components:
 *    v_0x = v_0 * cos(theta)
 *    v_0y = v_0 * sin(theta)
 *
 * 2. Position at time t:
 *    x(t) = x_0 + v_0x * t
 *    y(t) = y_0 + v_0y * t - 0.5 * g * t^2
 *
 * 3. Velocity at time t:
 *    v_x(t) = v_0x
 *    v_y(t) = v_0y - g * t
 *
 * 4. Time of Flight (ground level y = 0):
 *    y_0 + v_0y * t - 0.5 * g * t^2 = 0 => t_flight = (v_0y + sqrt(v_0y^2 + 2 * g * y_0)) / g
 *
 * 5. Maximum Height:
 *    h_max = y_0 + v_0y^2 / (2 * g)
 *
 * 6. Horizontal Range:
 *    R = x_0 + v_0x * t_flight
 *
 * Assumptions:
 * - Constant vertical gravitational acceleration (g = 9.81 m/s^2 default).
 * - No air resistance (ideal projectile motion).
 */

import { Vec2, magnitude } from '../vector';

export interface ProjectileParams {
  initialSpeed: number; // m/s
  launchAngleDeg: number; // degrees
  initialPosition: Vec2; // m (x0, y0)
  gravity: number; // m/s^2
}

export const DEFAULT_PROJECTILE_PARAMS: ProjectileParams = {
  initialSpeed: 20,
  launchAngleDeg: 45,
  initialPosition: { x: 0, y: 0 },
  gravity: 9.81,
};

export interface ProjectileState {
  position: Vec2;
  velocity: Vec2;
  speed: number;
  time: number;
}

export interface AnalyticalSummary {
  timeOfFlight: number;
  maxHeight: number;
  range: number;
}

/**
 * Calculates position, velocity, and speed at time t.
 */
export function getProjectileState(t: number, params: ProjectileParams = DEFAULT_PROJECTILE_PARAMS): ProjectileState {
  const { initialSpeed, launchAngleDeg, initialPosition, gravity } = params;
  const angleRad = (launchAngleDeg * Math.PI) / 180;
  const v0x = initialSpeed * Math.cos(angleRad);
  const v0y = initialSpeed * Math.sin(angleRad);

  const x = initialPosition.x + v0x * t;
  const y = initialPosition.y + v0y * t - 0.5 * gravity * t * t;

  const vx = v0x;
  const vy = v0y - gravity * t;

  const velocity: Vec2 = { x: vx, y: vy };

  return {
    position: { x, y },
    velocity,
    speed: magnitude(velocity),
    time: t,
  };
}

/**
 * Calculates analytical summary metrics (time of flight, max height, total horizontal range).
 */
export function calculateAnalyticalSummary(params: ProjectileParams = DEFAULT_PROJECTILE_PARAMS): AnalyticalSummary {
  const { initialSpeed, launchAngleDeg, initialPosition, gravity } = params;
  if (gravity <= 0) {
    return { timeOfFlight: Infinity, maxHeight: Infinity, range: Infinity };
  }

  const angleRad = (launchAngleDeg * Math.PI) / 180;
  const v0x = initialSpeed * Math.cos(angleRad);
  const v0y = initialSpeed * Math.sin(angleRad);

  const maxHeight = initialPosition.y + (v0y * v0y) / (2 * gravity);

  const disc = v0y * v0y + 2 * gravity * initialPosition.y;
  let timeOfFlight = 0;
  if (disc >= 0) {
    timeOfFlight = (v0y + Math.sqrt(disc)) / gravity;
  }

  const range = initialPosition.x + v0x * timeOfFlight;

  return {
    timeOfFlight,
    maxHeight,
    range,
  };
}
