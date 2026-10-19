/**
 * Uniformly Accelerated Motion (UAM) Physics Model
 *
 * Kinematic Equations (SUVAT):
 * 1. v(t) = v_0 + a * t
 * 2. x(t) = x_0 + v_0 * t + 0.5 * a * t^2
 * 3. v^2 = v_0^2 + 2 * a * (x - x_0)
 * 4. Δx = ((v_0 + v) / 2) * t
 *
 * Scenarios:
 * - Horizontal Track: Constant linear acceleration along x-axis.
 * - Free Fall: Constant gravitational acceleration along y-axis (a_y = -g).
 * - Inclined Ramp: Motion along incline with angle θ and friction coefficient μ.
 *   a_ramp = g * (sin θ - μ * cos θ)
 */

import { Vec2, magnitude } from '../vector';

export type MotionScenario = 'horizontal' | 'freefall' | 'ramp';

export interface UAMParams {
  scenario: MotionScenario;
  initialPosition: number; // x0, y0, or s0 (m)
  initialVelocity: number; // v0 (m/s)
  acceleration: number; // a (m/s^2) for horizontal
  gravity: number; // g (m/s^2) for freefall/ramp
  rampAngle: number; // degrees for ramp
  frictionCoeff: number; // friction coefficient μ
}

export const DEFAULT_UAM_PARAMS: UAMParams = {
  scenario: 'horizontal',
  initialPosition: 0,
  initialVelocity: 2,
  acceleration: 1.5,
  gravity: 9.81,
  rampAngle: 30,
  frictionCoeff: 0.1,
};

export interface UAMState {
  position: Vec2;
  velocity: Vec2;
  acceleration: Vec2;
  speed: number;
  displacement: number;
  effectiveAccel: number;
  vSquaredDiff: number; // Verification of v^2 = v0^2 + 2 a Δx
  avgVelocity: number;
}

/**
 * Calculates effective acceleration magnitude based on scenario and parameters.
 */
export function getEffectiveAcceleration(params: UAMParams): number {
  const { scenario, acceleration, gravity, rampAngle, frictionCoeff } = params;

  switch (scenario) {
    case 'horizontal':
      return acceleration;

    case 'freefall':
      return -gravity;

    case 'ramp': {
      const rad = (rampAngle * Math.PI) / 180;
      const sinTheta = Math.sin(rad);
      const cosTheta = Math.cos(rad);
      const netCoeff = sinTheta - frictionCoeff * cosTheta;
      return netCoeff > 0 ? gravity * netCoeff : 0;
    }
  }
}

/**
 * Computes state at time t for uniformly accelerated motion.
 */
export function getUAMState(t: number, params: UAMParams): UAMState {
  const { scenario, initialPosition, initialVelocity, rampAngle } = params;
  const a = getEffectiveAcceleration(params);

  let pos: Vec2 = { x: 0, y: 0 };
  let vel: Vec2 = { x: 0, y: 0 };
  let accel: Vec2 = { x: 0, y: 0 };
  let disp = 0;

  switch (scenario) {
    case 'horizontal': {
      disp = initialVelocity * t + 0.5 * a * t * t;
      const currentX = initialPosition + disp;
      const currentVx = initialVelocity + a * t;

      pos = { x: currentX, y: 0 };
      vel = { x: currentVx, y: 0 };
      accel = { x: a, y: 0 };
      break;
    }

    case 'freefall': {
      // a is -g
      disp = initialVelocity * t + 0.5 * a * t * t;
      const rawY = initialPosition + disp;
      const currentY = Math.max(0, rawY);
      const currentVy = currentY > 0 ? initialVelocity + a * t : 0;

      pos = { x: 0, y: currentY };
      vel = { x: 0, y: currentVy };
      accel = { x: 0, y: currentY > 0 ? a : 0 };
      disp = currentY - initialPosition;
      break;
    }

    case 'ramp': {
      const rad = (rampAngle * Math.PI) / 180;
      const sDisp = initialVelocity * t + 0.5 * a * t * t;
      const s = initialPosition + sDisp;
      const vRamp = initialVelocity + a * t;

      pos = { x: s * Math.cos(rad), y: s * Math.sin(rad) };
      vel = { x: vRamp * Math.cos(rad), y: vRamp * Math.sin(rad) };
      accel = { x: a * Math.cos(rad), y: a * Math.sin(rad) };
      disp = s - initialPosition;
      break;
    }
  }

  const speed = magnitude(vel);
  const currentScalarV = scenario === 'freefall' ? vel.y : (scenario === 'ramp' ? magnitude(vel) : vel.x);
  const scalarV0 = initialVelocity;
  
  // Timeless equation check: v^2 - (v0^2 + 2 * a * Δx)
  const vSquaredDiff = Math.pow(currentScalarV, 2) - (Math.pow(scalarV0, 2) + 2 * a * disp);

  // Average velocity: Δx / t (or (v0 + v)/2 for constant a)
  const avgVelocity = t > 0 ? disp / t : initialVelocity;

  return {
    position: pos,
    velocity: vel,
    acceleration: accel,
    speed,
    displacement: disp,
    effectiveAccel: a,
    vSquaredDiff,
    avgVelocity,
  };
}

/**
 * Calculates timeless velocity for a given displacement: v = sqrt(v0^2 + 2 a Δx).
 */
export function calculateTimelessVelocity(v0: number, a: number, dx: number): number {
  const vSquared = v0 * v0 + 2 * a * dx;
  return vSquared >= 0 ? Math.sqrt(vSquared) : 0;
}
