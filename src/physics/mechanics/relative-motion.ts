/**
 * Relative Motion Physics
 *
 * Concepts:
 * 1. Frame of Reference:
 *    Position, velocity, and acceleration of an object depend on the reference frame from which they are observed.
 *
 * 2. Galilean Relativity (Galilean Transformations):
 *    For frame B moving with velocity v_BA relative to frame A:
 *    - Position relation: r_A = r_B + r_BA
 *    - Relative position: r_AB = r_A - r_B
 *    - Relative velocity: v_AB = v_A - v_B (Velocity of object A relative to object B)
 *    - Alternatively, velocity of object A relative to ground (G): v_A/G = v_A/B + v_B/G
 *
 * 3. Two-Dimensional Relative Motion:
 *    In 2D Cartesian space, relative vectors are calculated component-wise:
 *    - v_rel_x = v1_x - v2_x
 *    - v_rel_y = v1_y - v2_y
 *    - Relative speed = |v_rel| = sqrt(v_rel_x^2 + v_rel_y^2)
 */

import { Vec2, sub, add, scale, magnitude } from '../vector';

export interface ObjectState {
  position: Vec2;
  velocity: Vec2;
}

export interface RelativeMotionParams {
  objectA: ObjectState;
  objectB: ObjectState;
}

export interface RelativeMotionResult {
  relativePosition: Vec2; // Position of A relative to B: r_A - r_B
  relativeVelocity: Vec2; // Velocity of A relative to B: v_A - v_B
  relativeDistance: number; // Magnitude of relative position
  relativeSpeed: number; // Magnitude of relative velocity
  closestApproachTime: number; // Time until minimum distance (if approaching)
  minDistance: number; // Distance at closest approach
}

export const DEFAULT_RELATIVE_MOTION_PARAMS: RelativeMotionParams = {
  objectA: {
    position: { x: 0, y: 0 },
    velocity: { x: 10, y: 0 },
  },
  objectB: {
    position: { x: 0, y: 10 },
    velocity: { x: 0, y: -5 },
  },
};

/**
 * Calculates relative position, relative velocity, relative distance/speed,
 * and time to closest approach between Object A and Object B.
 */
export function calculateRelativeMotion(params: RelativeMotionParams): RelativeMotionResult {
  const { objectA, objectB } = params;

  // Position of A relative to B (r_AB = r_A - r_B)
  const relativePosition = sub(objectA.position, objectB.position);

  // Velocity of A relative to B (v_AB = v_A - v_B)
  const relativeVelocity = sub(objectA.velocity, objectB.velocity);

  const relativeDistance = magnitude(relativePosition);
  const relativeSpeed = magnitude(relativeVelocity);

  // Calculate time to closest approach (t_min)
  // Distance squared r(t)^2 = |r_rel + v_rel * t|^2
  // d/dt (r(t)^2) = 2 * (r_rel + v_rel * t) . v_rel = 0
  // t_min = - (r_rel . v_rel) / |v_rel|^2
  let closestApproachTime = 0;
  let minDistance = relativeDistance;

  if (relativeSpeed > 1e-9) {
    const dotProduct = relativePosition.x * relativeVelocity.x + relativePosition.y * relativeVelocity.y;
    const vSquared = relativeSpeed * relativeSpeed;
    const rawTime = -dotProduct / vSquared;

    // We only consider future time (t >= 0) for closest approach, or t=0 if moving away
    closestApproachTime = Math.max(0, rawTime);

    const closestPos = add(relativePosition, scale(relativeVelocity, closestApproachTime));
    minDistance = magnitude(closestPos);
  }

  return {
    relativePosition,
    relativeVelocity,
    relativeDistance,
    relativeSpeed,
    closestApproachTime,
    minDistance,
  };
}

/**
 * Predicts positions and relative state of two objects after time t.
 */
export function stepRelativeMotion(
  params: RelativeMotionParams,
  t: number
): { objectA: ObjectState; objectB: ObjectState; relativeResult: RelativeMotionResult } {
  const nextA: ObjectState = {
    position: add(params.objectA.position, scale(params.objectA.velocity, t)),
    velocity: params.objectA.velocity,
  };

  const nextB: ObjectState = {
    position: add(params.objectB.position, scale(params.objectB.velocity, t)),
    velocity: params.objectB.velocity,
  };

  const nextParams = { objectA: nextA, objectB: nextB };

  return {
    objectA: nextA,
    objectB: nextB,
    relativeResult: calculateRelativeMotion(nextParams),
  };
}
