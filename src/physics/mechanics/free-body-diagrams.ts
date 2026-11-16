/**
 * Free-Body Diagrams (FBD) Physics Module
 *
 * Concepts:
 * 1. Free-Body Diagram: A vector representation of forces acting on a body.
 *
 * 2. Incline Coordinate System (+x up incline, +y perpendicular outward):
 *    - F_gravity = (-m * g * sin(θ), -m * g * cos(θ))
 *    - F_applied = (F_app * cos(α), F_app * sin(α))
 *    - F_normal = (0, max(0, -F_gravity_y - F_applied_y))
 *    - F_friction = static balance or kinetic friction opposing motion/tendency
 *
 * 3. Net force and acceleration:
 *    - F_net = F_gravity + F_applied + F_normal + F_friction
 *    - a = F_net / m
 */

import { Vec2 } from '../vector';

export interface ForceVector {
  id: string;
  name: string;
  vector: Vec2;
  magnitude: number;
}

export interface FBDParams {
  mass: number; // kg (> 0)
  gravity: number; // m/s^2 (>= 0)
  inclineAngle: number; // rad
  appliedForce: number; // N
  appliedAngle: number; // rad relative to incline surface (0 = parallel to incline, pointing up)
  muS: number; // Coefficient of static friction (>= 0)
  muK: number; // Coefficient of kinetic friction (>= 0, <= muS)
}

export const DEFAULT_FBD_PARAMS: FBDParams = {
  mass: 5.0,
  gravity: 9.81,
  inclineAngle: Math.PI / 6, // 30 degrees
  appliedForce: 0,
  appliedAngle: 0,
  muS: 0.4,
  muK: 0.3,
};

export interface FBDState {
  forces: ForceVector[];
  netForce: Vec2;
  netForceMagnitude: number;
  normalForce: number;
  frictionForce: number;
  acceleration: Vec2;
  accelerationMagnitude: number;
  isEquilibrium: boolean;
}

/**
 * Calculates individual force vectors, net force, normal force, friction, and acceleration.
 */
export function calculateFBDState(params: FBDParams, velocity: number = 0): FBDState {
  const { mass, gravity, inclineAngle, appliedForce, appliedAngle, muS, muK } = params;

  if (mass <= 0) {
    throw new Error('Mass must be greater than zero.');
  }

  const fGravityX = -mass * gravity * Math.sin(inclineAngle);
  const fGravityY = -mass * gravity * Math.cos(inclineAngle);

  const fAppliedX = appliedForce * Math.cos(appliedAngle);
  const fAppliedY = appliedForce * Math.sin(appliedAngle);

  const normalForceMagnitude = Math.max(0, -fGravityY - fAppliedY);
  const fNormalY = normalForceMagnitude;

  const fParallelRaw = fAppliedX + fGravityX;

  let fFrictionX = 0;
  const maxStaticFriction = muS * normalForceMagnitude;
  const kineticFriction = muK * normalForceMagnitude;

  if (Math.abs(velocity) < 1e-6) {
    if (Math.abs(fParallelRaw) <= maxStaticFriction) {
      fFrictionX = -fParallelRaw;
    } else {
      fFrictionX = -Math.sign(fParallelRaw) * kineticFriction;
    }
  } else {
    fFrictionX = -Math.sign(velocity) * kineticFriction;
  }

  const fNetX = fParallelRaw + fFrictionX;
  const fNetY = Math.max(0, fGravityY + fAppliedY + fNormalY);

  const netForce: Vec2 = { x: fNetX, y: fNetY };
  const netForceMagnitude = Math.hypot(fNetX, fNetY);

  const acceleration: Vec2 = {
    x: fNetX / mass,
    y: fNetY / mass,
  };
  const accelerationMagnitude = Math.hypot(acceleration.x, acceleration.y);

  const forces: ForceVector[] = [
    {
      id: 'gravity',
      name: 'Gravity (Fg)',
      vector: { x: fGravityX, y: fGravityY },
      magnitude: mass * gravity,
    },
    {
      id: 'normal',
      name: 'Normal Force (Fn)',
      vector: { x: 0, y: fNormalY },
      magnitude: normalForceMagnitude,
    },
  ];

  if (appliedForce > 0) {
    forces.push({
      id: 'applied',
      name: 'Applied Force (Fapp)',
      vector: { x: fAppliedX, y: fAppliedY },
      magnitude: appliedForce,
    });
  }

  if (Math.abs(fFrictionX) > 1e-6) {
    forces.push({
      id: 'friction',
      name: 'Friction Force (Ff)',
      vector: { x: fFrictionX, y: 0 },
      magnitude: Math.abs(fFrictionX),
    });
  }

  const isEquilibrium = netForceMagnitude < 1e-6;

  return {
    forces,
    netForce,
    netForceMagnitude,
    normalForce: normalForceMagnitude,
    frictionForce: Math.abs(fFrictionX),
    acceleration,
    accelerationMagnitude,
    isEquilibrium,
  };
}

/**
 * Calculates step integration for velocity and position along incline.
 */
export function stepFBDMotion(
  currentPos: number,
  currentVel: number,
  params: FBDParams,
  dt: number
): { position: number; velocity: number; state: FBDState } {
  const state = calculateFBDState(params, currentVel);
  let nextVel = currentVel + state.acceleration.x * dt;

  if (currentVel !== 0 && Math.sign(currentVel) !== Math.sign(nextVel) && Math.abs(state.acceleration.x * dt) > Math.abs(currentVel)) {
    nextVel = 0;
  }

  const nextPos = currentPos + 0.5 * (currentVel + nextVel) * dt;

  return {
    position: nextPos,
    velocity: nextVel,
    state,
  };
}
