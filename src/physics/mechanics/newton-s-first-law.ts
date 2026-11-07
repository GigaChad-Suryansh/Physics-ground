/**
 * Newton's First Law of Motion (Law of Inertia)
 *
 * Concepts:
 * 1. Law of Inertia: An object at rest stays at rest, and an object in motion continues
 *    in motion with constant velocity (constant speed and direction) unless acted upon
 *    by a net external force (ΣF = 0).
 *
 * 2. Equilibrium (ΣF = 0):
 *    a = ΣF / m = 0  =>  v(t) = v0 (constant),  r(t) = r0 + v0 * t
 *
 * 3. External Force & Friction (ΣF ≠ 0):
 *    F_friction = μ * m * g (opposing motion velocity vector).
 *    Stopping time: t_stop = v0 / (μ * g)
 *    Stopping distance: d_stop = v0^2 / (2 * μ * g)
 */

import { Vec2, add, scale, magnitude, normalize } from '../vector';

export interface NewtonsFirstLawParams {
  mass: number;
  initialVelocity: Vec2;
  initialPosition: Vec2;
  appliedForce: Vec2;
  frictionCoefficient: number;
  gravity: number;
}

export const DEFAULT_NEWTONS_FIRST_LAW_PARAMS: NewtonsFirstLawParams = {
  mass: 1.0,
  initialVelocity: { x: 5, y: 0 },
  initialPosition: { x: 0, y: 0 },
  appliedForce: { x: 0, y: 0 },
  frictionCoefficient: 0.0,
  gravity: 9.81,
};

export interface NewtonsFirstLawState {
  position: Vec2;
  velocity: Vec2;
  acceleration: Vec2;
  netForce: Vec2;
  frictionForce: Vec2;
  isAtRest: boolean;
}

/**
 * Calculates net force acting on an object given current velocity and parameters.
 */
export function calculateNetForce(velocity: Vec2, params: NewtonsFirstLawParams): { netForce: Vec2; frictionForce: Vec2 } {
  const vMag = magnitude(velocity);
  let frictionForce: Vec2 = { x: 0, y: 0 };

  if (vMag > 1e-6 && params.frictionCoefficient > 0) {
    const vHat = normalize(velocity);
    const fMag = params.frictionCoefficient * params.mass * params.gravity;
    frictionForce = scale(vHat, -fMag);
  }

  const netForce = add(params.appliedForce, frictionForce);
  return { netForce, frictionForce };
}

/**
 * Analytical solution when net force is constant (e.g. zero friction case).
 * Position: r(t) = r0 + v0*t + 0.5*a*t^2
 * Velocity: v(t) = v0 + a*t
 */
export function getAnalyticalState(t: number, params: NewtonsFirstLawParams): NewtonsFirstLawState {
  const { mass, initialVelocity, initialPosition, appliedForce } = params;
  const acceleration = scale(appliedForce, 1 / mass);
  const velocity = add(initialVelocity, scale(acceleration, t));
  const position = add(
    initialPosition,
    add(scale(initialVelocity, t), scale(acceleration, 0.5 * t * t))
  );

  return {
    position,
    velocity,
    acceleration,
    netForce: appliedForce,
    frictionForce: { x: 0, y: 0 },
    isAtRest: magnitude(velocity) < 1e-6,
  };
}

/**
 * Calculates theoretical stopping time and distance for 1D sliding with friction and zero applied force.
 */
export function getFrictionalStoppingInfo(v0: number, mu: number, g: number = 9.81): { stopTime: number; stopDistance: number } {
  if (mu <= 0 || v0 <= 0) {
    return { stopTime: Infinity, stopDistance: Infinity };
  }
  const stopTime = v0 / (mu * g);
  const stopDistance = (v0 * v0) / (2 * mu * g);
  return { stopTime, stopDistance };
}

/**
 * Numerical integration step for dynamic physics simulation.
 */
export function stepSimulation(
  currentState: NewtonsFirstLawState,
  params: NewtonsFirstLawParams,
  dt: number
): NewtonsFirstLawState {
  if (dt <= 0) return currentState;

  if (currentState.isAtRest && magnitude(params.appliedForce) <= magnitude(currentState.frictionForce)) {
    // Static friction holding object at rest unless applied force exceeds friction limit
    return {
      ...currentState,
      acceleration: { x: 0, y: 0 },
      netForce: { x: 0, y: 0 },
    };
  }

  const { netForce, frictionForce } = calculateNetForce(currentState.velocity, params);
  const acceleration = scale(netForce, 1 / params.mass);

  let newVelocity = add(currentState.velocity, scale(acceleration, dt));

  // Prevent velocity overshoot due to friction stopping the object
  if (params.appliedForce.x === 0 && params.appliedForce.y === 0 && params.frictionCoefficient > 0) {
    const dotProd = currentState.velocity.x * newVelocity.x + currentState.velocity.y * newVelocity.y;
    if (dotProd < 0) {
      newVelocity = { x: 0, y: 0 };
    }
  }

  const isResting = magnitude(newVelocity) < 1e-6;
  if (isResting) {
    newVelocity = { x: 0, y: 0 };
  }

  const newPosition = add(currentState.position, scale(newVelocity, dt));

  return {
    position: newPosition,
    velocity: newVelocity,
    acceleration: isResting ? { x: 0, y: 0 } : acceleration,
    netForce: isResting ? { x: 0, y: 0 } : netForce,
    frictionForce: isResting ? { x: 0, y: 0 } : frictionForce,
    isAtRest: isResting,
  };
}
