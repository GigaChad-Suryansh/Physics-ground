/**
 * Newton's Third Law of Motion
 *
 * Concepts:
 * 1. Action and Reaction: Whenever one body exerts a force on a second body,
 *    the second body simultaneously exerts a force equal in magnitude and opposite in direction on the first body.
 *    F_A_on_B = -F_B_on_A
 *
 * 2. Two-Block Contact Force System (1D):
 *    For two masses m1 and m2 pushed together by an external force F_ext applied on m1:
 *    - Common Acceleration: a = F_ext / (m1 + m2)
 *    - Force of m1 on m2: F_12 = m2 * a
 *    - Force of m2 on m1: F_21 = -F_12 = -m2 * a
 *
 * 3. Mutual Recoil / Explosion (Impulse Pair):
 *    - J = integral(F dt)
 *    - v1 = -J / m1
 *    - v2 = J / m2
 *    - Total momentum is conserved: p_total = m1*v1 + m2*v2 = 0
 */

import { Vec2 } from '../vector';

export interface NewtonThirdLawParams {
  m1: number; // Mass of object 1 (kg)
  m2: number; // Mass of object 2 (kg)
  externalForce1: Vec2; // External force applied to mass 1 (N)
  externalForce2: Vec2; // External force applied to mass 2 (N)
  interactionForceMagnitude: number; // Mutual interaction force magnitude (N)
}

export interface NewtonThirdLawState {
  position1: Vec2;
  velocity1: Vec2;
  position2: Vec2;
  velocity2: Vec2;
  force12: Vec2; // Force exerted by mass 1 on mass 2
  force21: Vec2; // Force exerted by mass 2 on mass 1
  time: number;
}

export const DEFAULT_NEWTON_THIRD_LAW_PARAMS: NewtonThirdLawParams = {
  m1: 2,
  m2: 3,
  externalForce1: { x: 10, y: 0 },
  externalForce2: { x: 0, y: 0 },
  interactionForceMagnitude: 0,
};

/**
 * Calculates equal and opposite reaction force vector for a given action force.
 */
export function calculateReactionForce(actionForce: Vec2): Vec2 {
  return {
    x: -actionForce.x,
    y: -actionForce.y,
  };
}

/**
 * Analytical calculation for two contact blocks pushed horizontally by external force F_ext on block 1.
 * Returns common acceleration and contact force F_12 (exerted by block 1 on block 2).
 */
export function calculateContactSystem1D(
  m1: number,
  m2: number,
  fExt1: number
): { acceleration: number; force12: number; force21: number } {
  const totalMass = m1 + m2;
  if (totalMass <= 0) {
    return { acceleration: 0, force12: 0, force21: 0 };
  }
  const acceleration = fExt1 / totalMass;
  const force12 = m2 * acceleration;
  const force21 = -force12;
  return { acceleration, force12, force21 };
}

/**
 * Calculates recoil velocities after an internal impulse (explosion/push-apart) between two masses initially at rest.
 */
export function calculateRecoilVelocities(
  m1: number,
  m2: number,
  impulse: number
): { v1: number; v2: number } {
  if (m1 <= 0 || m2 <= 0) {
    return { v1: 0, v2: 0 };
  }
  return {
    v1: -impulse / m1,
    v2: impulse / m2,
  };
}

/**
 * Advances the 2-body state under external forces and mutual interaction forces (Newton's Third Law pair).
 */
export function stepThirdLawSystem(
  state: NewtonThirdLawState,
  params: NewtonThirdLawParams,
  dt: number
): NewtonThirdLawState {
  if (dt <= 0) return state;

  const { m1, m2, externalForce1, externalForce2, interactionForceMagnitude } = params;

  // Interaction vector points from 1 to 2
  const dx = state.position2.x - state.position1.x;
  const dy = state.position2.y - state.position1.y;
  const dist = Math.hypot(dx, dy);

  let force12: Vec2 = { x: 0, y: 0 };
  if (dist > 1e-6 && interactionForceMagnitude !== 0) {
    const dirX = dx / dist;
    const dirY = dy / dist;
    force12 = {
      x: interactionForceMagnitude * dirX,
      y: interactionForceMagnitude * dirY,
    };
  }

  // Newton's Third Law: F21 = -F12
  const force21 = calculateReactionForce(force12);

  // Net forces
  const netF1: Vec2 = {
    x: externalForce1.x + force21.x,
    y: externalForce1.y + force21.y,
  };

  const netF2: Vec2 = {
    x: externalForce2.x + force12.x,
    y: externalForce2.y + force12.y,
  };

  // Accelerations
  const a1: Vec2 = { x: netF1.x / m1, y: netF1.y / m1 };
  const a2: Vec2 = { x: netF2.x / m2, y: netF2.y / m2 };

  // Euler integration
  const velocity1: Vec2 = {
    x: state.velocity1.x + a1.x * dt,
    y: state.velocity1.y + a1.y * dt,
  };
  const position1: Vec2 = {
    x: state.position1.x + velocity1.x * dt,
    y: state.position1.y + velocity1.y * dt,
  };

  const velocity2: Vec2 = {
    x: state.velocity2.x + a2.x * dt,
    y: state.velocity2.y + a2.y * dt,
  };
  const position2: Vec2 = {
    x: state.position2.x + velocity2.x * dt,
    y: state.position2.y + velocity2.y * dt,
  };

  return {
    position1,
    velocity1,
    position2,
    velocity2,
    force12,
    force21,
    time: state.time + dt,
  };
}
