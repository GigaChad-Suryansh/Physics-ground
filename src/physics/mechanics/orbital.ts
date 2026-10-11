/**
 * Orbital Mechanics Physics Module
 * 
 * Two-body gravitational simulation using Velocity Verlet integration.
 * 
 * Limitations:
 * - Uses Velocity Verlet, which is symplectic and conserves energy well
 *   for moderate time steps, but can drift for very long integrations
 *   or very eccentric orbits.
 * - Point masses only, no extended body effects.
 * - Newtonian gravity only (no relativistic corrections).
 */

import { G } from '../constants';
import type { Vec2 } from '../vector';
import { add, sub, scale, magnitude, distance } from '../vector';

export interface OrbitalBody {
  position: Vec2;
  velocity: Vec2;
  mass: number;
  radius: number;       // visual radius for rendering and collision
  trail: Vec2[];         // position history
}

export interface OrbitalParams {
  body1Mass: number;     // kg
  body2Mass: number;     // kg
  body1Radius: number;
  body2Radius: number;
  initialSeparation: number;  // m
  body2Speed: number;    // m/s (tangential velocity of body 2)
  gravitationalConstant: number;
  trailLength: number;
}

export interface OrbitalState {
  body1: OrbitalBody;
  body2: OrbitalBody;
  time: number;
  totalEnergy: number;
  kineticEnergy: number;
  potentialEnergy: number;
  angularMomentum: number;
  separation: number;
  hasCollided: boolean;
}

export const DEFAULT_ORBITAL_PARAMS: OrbitalParams = {
  body1Mass: 1e12,
  body2Mass: 1,
  body1Radius: 15,
  body2Radius: 5,
  initialSeparation: 200,
  body2Speed: 55,
  gravitationalConstant: G,
  trailLength: 500,
};

/**
 * Calculate the circular orbit speed for body2 around body1 at given separation.
 * v_circular = sqrt(G * M / r)
 */
export function circularOrbitSpeed(
  centralMass: number,
  separation: number,
  gConst: number = G
): number {
  return Math.sqrt((gConst * centralMass) / separation);
}

export function createInitialOrbitalState(params: OrbitalParams): OrbitalState {
  // Center of mass frame. Body1 at origin (for simplicity with large mass ratios).
  const body1: OrbitalBody = {
    position: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    mass: params.body1Mass,
    radius: params.body1Radius,
    trail: [],
  };

  const body2: OrbitalBody = {
    position: { x: params.initialSeparation, y: 0 },
    velocity: { x: 0, y: params.body2Speed },
    mass: params.body2Mass,
    radius: params.body2Radius,
    trail: [],
  };

  const state: OrbitalState = {
    body1,
    body2,
    time: 0,
    totalEnergy: 0,
    kineticEnergy: 0,
    potentialEnergy: 0,
    angularMomentum: 0,
    separation: params.initialSeparation,
    hasCollided: false,
  };

  updateDerivedQuantities(state, params);
  return state;
}

function gravitationalAcceleration(
  pos: Vec2,
  otherPos: Vec2,
  otherMass: number,
  gConst: number
): Vec2 {
  const r = sub(otherPos, pos);
  const dist = magnitude(r);
  if (dist < 1e-10) return { x: 0, y: 0 };
  
  const forceMag = (gConst * otherMass) / (dist * dist);
  return scale(r, forceMag / dist);
}

/**
 * Step using Velocity Verlet integration (symplectic, good energy conservation).
 */
export function stepOrbital(
  state: OrbitalState,
  params: OrbitalParams,
  dt: number
): OrbitalState {
  if (state.hasCollided) return state;

  const gConst = params.gravitationalConstant;

  // Current accelerations
  const acc1 = gravitationalAcceleration(
    state.body1.position, state.body2.position, state.body2.mass, gConst
  );
  const acc2 = gravitationalAcceleration(
    state.body2.position, state.body1.position, state.body1.mass, gConst
  );

  // Update positions: x += v*dt + 0.5*a*dt²
  const newPos1 = add(
    add(state.body1.position, scale(state.body1.velocity, dt)),
    scale(acc1, 0.5 * dt * dt)
  );
  const newPos2 = add(
    add(state.body2.position, scale(state.body2.velocity, dt)),
    scale(acc2, 0.5 * dt * dt)
  );

  // New accelerations at new positions
  const newAcc1 = gravitationalAcceleration(newPos1, newPos2, state.body2.mass, gConst);
  const newAcc2 = gravitationalAcceleration(newPos2, newPos1, state.body1.mass, gConst);

  // Update velocities: v += 0.5*(a_old + a_new)*dt
  const newVel1 = add(state.body1.velocity, scale(add(acc1, newAcc1), 0.5 * dt));
  const newVel2 = add(state.body2.velocity, scale(add(acc2, newAcc2), 0.5 * dt));

  // Trail management
  const trail1 = [...state.body1.trail, { ...state.body1.position }];
  if (trail1.length > params.trailLength) trail1.shift();
  const trail2 = [...state.body2.trail, { ...state.body2.position }];
  if (trail2.length > params.trailLength) trail2.shift();

  // Collision detection
  const sep = distance(newPos1, newPos2);
  const collisionDist = params.body1Radius + params.body2Radius;

  const newState: OrbitalState = {
    body1: { ...state.body1, position: newPos1, velocity: newVel1, trail: trail1 },
    body2: { ...state.body2, position: newPos2, velocity: newVel2, trail: trail2 },
    time: state.time + dt,
    totalEnergy: 0,
    kineticEnergy: 0,
    potentialEnergy: 0,
    angularMomentum: 0,
    separation: sep,
    hasCollided: sep < collisionDist,
  };

  updateDerivedQuantities(newState, params);
  return newState;
}

function updateDerivedQuantities(state: OrbitalState, params: OrbitalParams) {
  const { body1, body2 } = state;
  
  const v1sq = body1.velocity.x ** 2 + body1.velocity.y ** 2;
  const v2sq = body2.velocity.x ** 2 + body2.velocity.y ** 2;
  
  state.kineticEnergy = 0.5 * body1.mass * v1sq + 0.5 * body2.mass * v2sq;
  
  const sep = distance(body1.position, body2.position);
  state.potentialEnergy = sep > 0
    ? -(params.gravitationalConstant * body1.mass * body2.mass) / sep
    : 0;
  
  state.totalEnergy = state.kineticEnergy + state.potentialEnergy;
  
  // Angular momentum about center of mass (2D: L = m*(x*vy - y*vx))
  const L1 = body1.mass * (body1.position.x * body1.velocity.y - body1.position.y * body1.velocity.x);
  const L2 = body2.mass * (body2.position.x * body2.velocity.y - body2.position.y * body2.velocity.x);
  state.angularMomentum = L1 + L2;
  
  state.separation = sep;
}
