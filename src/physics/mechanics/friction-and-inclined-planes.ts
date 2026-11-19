/**
 * Friction and Inclined Planes
 *
 * Concepts:
 * 1. Normal Force (Fn): The force perpendicular to the surface.
 *    Fn = m * g * cos(θ)
 *
 * 2. Parallel Gravity (Fg_||): The component of gravity parallel to the plane.
 *    Fg_|| = m * g * sin(θ)
 *
 * 3. Friction Force (Ff):
 *    - Static: Fs <= μs * Fn (opposes impending motion)
 *    - Kinetic: Fk = μk * Fn (opposes actual motion)
 *
 * 4. Net Force (Fnet):
 *    Fnet = Fg_|| + Ff_vector
 *    (where Ff_vector opposes velocity or impending motion)
 *
 * 5. Acceleration (a):
 *    a = Fnet / m
 *
 * Assumptions:
 * - Downward along the plane is the positive direction for displacement, velocity, and acceleration.
 * - The angle θ is between 0 and π/2 radians.
 */

import { g_EARTH } from '../constants';

export interface InclinedPlaneParams {
  mass: number;
  theta: number; // inclination angle in radians
  muStatic: number;
  muKinetic: number;
}

export interface InclinedPlaneState {
  displacement: number; // distance along the plane (positive is down-slope)
  velocity: number;     // velocity along the plane (positive is down-slope)
  acceleration: number; // acceleration along the plane (positive is down-slope)
  speed: number;        // magnitude of velocity
  isSliding: boolean;
}

export const DEFAULT_INCLINED_PLANE_PARAMS: InclinedPlaneParams = {
  mass: 1.0,
  theta: Math.PI / 6, // 30 degrees
  muStatic: 0.5,
  muKinetic: 0.3,
};

/**
 * Calculates the current acceleration and sliding state based on current velocity.
 */
export function calculateInclinedPlanePhysics(
  params: InclinedPlaneParams,
  velocity: number
): { acceleration: number; isSliding: boolean } {
  const { mass, theta, muStatic, muKinetic } = params;

  // Normal force: Fn = m * g * cos(theta)
  const fn = mass * g_EARTH * Math.cos(theta);
  // Gravity component parallel to the plane: Fg_|| = m * g * sin(theta)
  const fgParallel = mass * g_EARTH * Math.sin(theta);

  const epsilon = 1e-10;

  // Case: Stationary or nearly stationary
  if (Math.abs(velocity) < epsilon) {
    const fsMax = muStatic * fn;
    // Static friction counteracts gravity up to fsMax
    if (Math.abs(fgParallel) <= fsMax + epsilon) {
      return { acceleration: 0, isSliding: false };
    }
    // Static friction exceeded; starts sliding down or up depending on gravity
    const frictionForce = -Math.sign(fgParallel) * muKinetic * fn;
    return {
      acceleration: (fgParallel + frictionForce) / mass,
      isSliding: true,
    };
  }

  // Case: Moving
  // Kinetic friction opposes the direction of actual motion
  const frictionForce = -Math.sign(velocity) * muKinetic * fn;
  const fNet = fgParallel + frictionForce;

  return {
    acceleration: fNet / mass,
    isSliding: true,
  };
}

/**
 * Analytical solution for state at time t, assuming starting from rest at x=0.
 * Equation: s(t) = 1/2 * a * t^2, v(t) = a * t
 */
export function getAnalyticalState(t: number, params: InclinedPlaneParams): InclinedPlaneState {
  const { acceleration, isSliding } = calculateInclinedPlanePhysics(params, 0);

  if (!isSliding) {
    return { 
      displacement: 0, 
      velocity: 0, 
      acceleration: 0, 
      speed: 0,
      isSliding: false 
    };
  }

  const v = acceleration * t;
  return {
    displacement: 0.5 * acceleration * t * t,
    velocity: v,
    acceleration,
    speed: Math.abs(v),
    isSliding,
  };
}

/**
 * Updates the state for a time step dt using semi-implicit Euler integration.
 */
export function stepInclinedPlane(
  dt: number,
  params: InclinedPlaneParams,
  currentState: InclinedPlaneState
): InclinedPlaneState {
  const physics = calculateInclinedPlanePhysics(params, currentState.velocity);
  
  let acceleration = physics.acceleration;
  let isSliding = physics.isSliding;
  let velocity = currentState.velocity + acceleration * dt;

  // If the object was moving but friction should have stopped it during this time step:
  if (currentState.isSliding && Math.sign(velocity) !== Math.sign(currentState.velocity) && currentState.velocity !== 0) {
    // Re-check physics at v=0 to see if it stays stationary
    const staticPhysics = calculateInclinedPlanePhysics(params, 0);
    if (!staticPhysics.isSliding) {
      velocity = 0;
      acceleration = 0;
      isSliding = false;
    }
  }

  return {
    displacement: currentState.displacement + velocity * dt,
    velocity,
    acceleration,
    speed: Math.abs(velocity),
    isSliding,
  };
}
