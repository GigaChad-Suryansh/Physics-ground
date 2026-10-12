/**
 * Orbital Mechanics Physics Module
 *
 * Two-body gravitational simulation using Velocity Verlet integration, set up
 * in the centre-of-mass frame (total momentum = 0, COM at the origin), so the
 * pair stays put on screen and angular momentum is measured about the COM.
 *
 * Velocity Verlet is symplectic: energy and angular momentum stay bounded
 * (no secular drift) for any reasonable time step.
 *
 * Limitations:
 * - Point masses only, no extended body effects.
 * - Newtonian gravity only (no relativistic corrections).
 * - Very eccentric orbits need a smaller dt near periapsis.
 */

import { G } from '../constants';
import type { Vec2 } from '../vector';
import { add, sub, scale, magnitude, distance } from '../vector';

export interface OrbitalBody {
  position: Vec2;
  velocity: Vec2;
  mass: number;
  radius: number; // visual radius for rendering and collision
  trail: Vec2[]; // position history
}

export interface OrbitalParams {
  body1Mass: number; // kg
  body2Mass: number; // kg
  body1Radius: number;
  body2Radius: number;
  initialSeparation: number; // m
  body2Speed: number; // m/s (tangential speed of body 2 relative to body 1)
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

/**
 * Defaults chosen so the orbit is bound and clearly elliptical:
 * μ = G·M = 6.674e5 m³/s², v_circ(200 m) ≈ 57.8 m/s, so 45 m/s gives
 * e ≈ 0.39 with a ~13 s period.
 */
export const DEFAULT_ORBITAL_PARAMS: OrbitalParams = {
  body1Mass: 1e16,
  body2Mass: 1,
  body1Radius: 15,
  body2Radius: 5,
  initialSeparation: 200,
  body2Speed: 45,
  gravitationalConstant: G,
  trailLength: 1500,
};

/**
 * Speed of a circular orbit at the given separation:
 * v = √(G·(M + m) / r)   (m defaults to 0 — test-mass limit)
 */
export function circularOrbitSpeed(
  centralMass: number,
  separation: number,
  gConst: number = G,
  orbitingMass: number = 0
): number {
  return Math.sqrt((gConst * (centralMass + orbitingMass)) / separation);
}

export interface OrbitInfo {
  /** Gravitational parameter μ = G·(M + m) */
  mu: number;
  circularSpeed: number;
  escapeSpeed: number;
  /** Specific orbital energy ε = v²/2 − μ/r (J/kg of reduced mass) */
  specificEnergy: number;
  eccentricity: number;
  /** Closest approach (m) */
  periapsis: number;
  /** Farthest distance (m); Infinity for an unbound orbit */
  apoapsis: number;
  /** Semi-major axis (m); Infinity for a parabola, negative for a hyperbola */
  semiMajorAxis: number;
  /** Orbital period (s); Infinity for an unbound orbit */
  period: number;
  bound: boolean;
  /** True when the starting point is the periapsis (v ≥ circular speed). */
  startsAtPeriapsis: boolean;
}

/**
 * Closed-form Kepler orbit for the initial conditions (velocity ⟂ separation).
 * Used for the on-screen reference ellipse and to validate the integrator.
 */
export function getOrbitInfo(params: OrbitalParams): OrbitInfo {
  const mu = params.gravitationalConstant * (params.body1Mass + params.body2Mass);
  const r0 = params.initialSeparation;
  const v0 = params.body2Speed;

  const h = r0 * v0; // specific angular momentum
  const eps = (v0 * v0) / 2 - mu / r0;
  const e = Math.sqrt(Math.max(0, 1 + (2 * eps * h * h) / (mu * mu)));
  const p = (h * h) / mu; // semi-latus rectum
  const periapsis = p / (1 + e);
  const bound = eps < 0;
  const apoapsis = bound ? p / (1 - e) : Infinity;
  const semiMajorAxis = Math.abs(eps) < 1e-12 ? Infinity : -mu / (2 * eps);
  const period = bound ? 2 * Math.PI * Math.sqrt(Math.pow(semiMajorAxis, 3) / mu) : Infinity;

  return {
    mu,
    circularSpeed: Math.sqrt(mu / r0),
    escapeSpeed: Math.sqrt((2 * mu) / r0),
    specificEnergy: eps,
    eccentricity: e,
    periapsis,
    apoapsis,
    semiMajorAxis,
    period,
    bound,
    startsAtPeriapsis: r0 * v0 * v0 >= mu,
  };
}

export function createInitialOrbitalState(params: OrbitalParams): OrbitalState {
  // Centre-of-mass frame: m1·r1 + m2·r2 = 0 and m1·v1 + m2·v2 = 0.
  const totalMass = params.body1Mass + params.body2Mass;
  const f1 = params.body2Mass / totalMass; // body 1's share of the separation
  const f2 = params.body1Mass / totalMass;

  const body1: OrbitalBody = {
    position: { x: -f1 * params.initialSeparation, y: 0 },
    velocity: { x: 0, y: -f1 * params.body2Speed },
    mass: params.body1Mass,
    radius: params.body1Radius,
    trail: [],
  };

  const body2: OrbitalBody = {
    position: { x: f2 * params.initialSeparation, y: 0 },
    velocity: { x: 0, y: f2 * params.body2Speed },
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
    state.body1.position,
    state.body2.position,
    state.body2.mass,
    gConst
  );
  const acc2 = gravitationalAcceleration(
    state.body2.position,
    state.body1.position,
    state.body1.mass,
    gConst
  );

  // Update positions: x += v·dt + ½·a·dt²
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

  // Update velocities: v += ½·(a_old + a_new)·dt
  const newVel1 = add(state.body1.velocity, scale(add(acc1, newAcc1), 0.5 * dt));
  const newVel2 = add(state.body2.velocity, scale(add(acc2, newAcc2), 0.5 * dt));

  // Trail management (record the new position so the trail reaches the body)
  const trail1 = [...state.body1.trail, newPos1];
  if (trail1.length > params.trailLength) trail1.shift();
  const trail2 = [...state.body2.trail, newPos2];
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
  state.potentialEnergy =
    sep > 0 ? -(params.gravitationalConstant * body1.mass * body2.mass) / sep : 0;

  state.totalEnergy = state.kineticEnergy + state.potentialEnergy;

  // Angular momentum about the origin (= the COM): L = Σ m·(x·vy − y·vx)
  const L1 =
    body1.mass * (body1.position.x * body1.velocity.y - body1.position.y * body1.velocity.x);
  const L2 =
    body2.mass * (body2.position.x * body2.velocity.y - body2.position.y * body2.velocity.x);
  state.angularMomentum = L1 + L2;

  state.separation = sep;
}
