/**
 * Newton's Second Law of Motion
 *
 * Concepts:
 * 1. Acceleration is directly proportional to net force and inversely proportional to mass:
 *    a = F_net / m  =>  F_net = m * a
 * 2. Normal force on a horizontal plane:
 *    N = max(0, m * g - F_applied,y)
 * 3. Friction force:
 *    - Kinetic friction opposes current velocity: F_k = mu_k * N
 *    - Static friction opposes applied horizontal force when stationary up to mu_k * N
 * 4. Analytical position and velocity under constant acceleration:
 *    x(t) = x_0 + v_0 * t + 0.5 * a * t^2
 *    v(t) = v_0 + a * t
 */

import { Vec2 } from '../vector';

export interface NewtonsSecondLawParams {
  mass: number;
  appliedForce: Vec2;
  frictionCoefficient: number;
  gravity: number;
}

export interface NewtonsSecondLawState {
  position: Vec2;
  velocity: Vec2;
  acceleration: Vec2;
  netForce: Vec2;
  frictionForce: Vec2;
  normalForce: number;
}

export const DEFAULT_NEWTONS_SECOND_LAW_PARAMS: NewtonsSecondLawParams = {
  mass: 2.0,
  appliedForce: { x: 10, y: 0 },
  frictionCoefficient: 0.1,
  gravity: 9.81,
};

/**
 * Calculates net force and acceleration for a block given applied force, gravity, and friction.
 */
export function calculateAcceleration(
  params: NewtonsSecondLawParams,
  velocity: Vec2 = { x: 0, y: 0 }
): { acceleration: Vec2; netForce: Vec2; frictionForce: Vec2; normalForce: number } {
  const { mass, appliedForce, frictionCoefficient, gravity } = params;
  if (mass <= 0) {
    throw new Error('Mass must be greater than 0');
  }

  const normalForce = Math.max(0, mass * gravity - appliedForce.y);
  const speedSq = velocity.x * velocity.x + velocity.y * velocity.y;
  let frictionForce: Vec2 = { x: 0, y: 0 };

  if (frictionCoefficient > 0 && normalForce > 0) {
    const maxFriction = frictionCoefficient * normalForce;
    if (speedSq > 1e-6) {
      const speed = Math.sqrt(speedSq);
      frictionForce = {
        x: -(velocity.x / speed) * maxFriction,
        y: -(velocity.y / speed) * maxFriction,
      };
    } else {
      const appFx = appliedForce.x;
      if (Math.abs(appFx) <= maxFriction) {
        frictionForce = { x: -appFx, y: 0 };
      } else {
        frictionForce = { x: -Math.sign(appFx) * maxFriction, y: 0 };
      }
    }
  }

  const netForce: Vec2 = {
    x: appliedForce.x + frictionForce.x,
    y: appliedForce.y - mass * gravity + normalForce + frictionForce.y,
  };

  const acceleration: Vec2 = {
    x: netForce.x / mass,
    y: netForce.y / mass,
  };

  return { acceleration, netForce, frictionForce, normalForce };
}

/**
 * Computes analytical state at time t for constant acceleration horizontal motion.
 */
export function getAnalyticalState(
  t: number,
  params: NewtonsSecondLawParams,
  initialPosition: Vec2 = { x: 0, y: 0 },
  initialVelocity: Vec2 = { x: 0, y: 0 }
): NewtonsSecondLawState {
  const { acceleration, netForce, frictionForce, normalForce } = calculateAcceleration(params, initialVelocity);

  const position: Vec2 = {
    x: initialPosition.x + initialVelocity.x * t + 0.5 * acceleration.x * t * t,
    y: initialPosition.y + initialVelocity.y * t + 0.5 * acceleration.y * t * t,
  };

  const velocity: Vec2 = {
    x: initialVelocity.x + acceleration.x * t,
    y: initialVelocity.y + acceleration.y * t,
  };

  return {
    position,
    velocity,
    acceleration,
    netForce,
    frictionForce,
    normalForce,
  };
}

/**
 * Steps state forward in time using semi-implicit Euler integration.
 */
export function stepSimulation(
  currentState: NewtonsSecondLawState,
  params: NewtonsSecondLawParams,
  dt: number
): NewtonsSecondLawState {
  const { acceleration, netForce, frictionForce, normalForce } = calculateAcceleration(params, currentState.velocity);

  const velocity: Vec2 = {
    x: currentState.velocity.x + acceleration.x * dt,
    y: currentState.velocity.y + acceleration.y * dt,
  };

  const position: Vec2 = {
    x: currentState.position.x + velocity.x * dt,
    y: currentState.position.y + velocity.y * dt,
  };

  return {
    position,
    velocity,
    acceleration,
    netForce,
    frictionForce,
    normalForce,
  };
}
