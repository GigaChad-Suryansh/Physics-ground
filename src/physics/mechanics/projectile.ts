/**
 * Projectile Motion Physics
 *
 * Analytical solutions for ideal projectile motion (no drag):
 *   x(t) = x₀ + v₀cos(θ)·t
 *   y(t) = y₀ + v₀sin(θ)·t - ½g·t²
 *   vₓ(t) = v₀cos(θ)
 *   vᵧ(t) = v₀sin(θ) - g·t
 *
 * With quadratic drag (optional), a = −(k/m)·|v|·v, there is no closed form,
 * so the state is advanced with classic 4th-order Runge–Kutta. Without drag
 * the acceleration is constant and RK4 reproduces the analytical solution to
 * machine precision at any step size.
 */

import { DEG_TO_RAD } from '../constants';
import type { Vec2 } from '../vector';

export interface ProjectileParams {
  velocity: number; // m/s
  angle: number; // degrees
  gravity: number; // m/s² (positive downward)
  height: number; // initial height in m
  dragEnabled: boolean;
  dragCoefficient: number; // k in F_drag = −k·|v|·v  (kg/m)
  mass: number; // kg
}

export interface ProjectileState {
  position: Vec2;
  velocity: Vec2;
  time: number;
  hasLanded: boolean;
}

export interface ProjectileAnalytical {
  maxHeight: number;
  range: number;
  flightTime: number;
  timeToApex: number;
}

/** Default parameters for projectile simulation */
export const DEFAULT_PROJECTILE_PARAMS: ProjectileParams = {
  velocity: 30,
  angle: 45,
  gravity: 9.81,
  height: 0,
  dragEnabled: false,
  dragCoefficient: 0.01,
  mass: 1,
};

/** Create initial state from parameters */
export function createInitialState(params: ProjectileParams): ProjectileState {
  const rad = params.angle * DEG_TO_RAD;
  return {
    position: { x: 0, y: params.height },
    velocity: {
      x: params.velocity * Math.cos(rad),
      y: params.velocity * Math.sin(rad),
    },
    time: 0,
    hasLanded: false,
  };
}

/**
 * Analytical solutions for ideal projectile (no drag, flat ground).
 * Valid when dragEnabled=false.
 */
export function getAnalyticalSolution(params: ProjectileParams): ProjectileAnalytical {
  const rad = params.angle * DEG_TO_RAD;
  const v0x = params.velocity * Math.cos(rad);
  const v0y = params.velocity * Math.sin(rad);
  const g = params.gravity;
  const h0 = params.height;

  // Time to apex: v0y - g*t = 0
  const timeToApex = v0y / g;

  // Max height: h0 + v0y²/(2g)
  const maxHeight = h0 + (v0y * v0y) / (2 * g);

  // Flight time: solve h0 + v0y*t - 0.5*g*t² = 0 using quadratic formula
  // => t = (v0y + sqrt(v0y² + 2gh0)) / g
  const discriminant = v0y * v0y + 2 * g * h0;
  const flightTime = discriminant >= 0 ? (v0y + Math.sqrt(discriminant)) / g : 0;

  // Range
  const range = v0x * flightTime;

  return { maxHeight, range, flightTime, timeToApex };
}

/**
 * Get analytical position at time t (no drag).
 */
export function analyticalPosition(params: ProjectileParams, t: number): Vec2 {
  const rad = params.angle * DEG_TO_RAD;
  const v0x = params.velocity * Math.cos(rad);
  const v0y = params.velocity * Math.sin(rad);
  const g = params.gravity;

  return {
    x: v0x * t,
    y: params.height + v0y * t - 0.5 * g * t * t,
  };
}

/** Acceleration at velocity (vx, vy): gravity plus optional quadratic drag. */
function acceleration(vx: number, vy: number, params: ProjectileParams): Vec2 {
  let ax = 0;
  let ay = -params.gravity;

  if (params.dragEnabled && params.mass > 0) {
    const speed = Math.hypot(vx, vy);
    const dragOverMass = (params.dragCoefficient * speed) / params.mass;
    ax -= dragOverMass * vx;
    ay -= dragOverMass * vy;
  }
  return { x: ax, y: ay };
}

interface Kinematics {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/** One classic RK4 step of size h on (x, y, vx, vy). Acceleration depends on velocity only. */
function rk4(s: Kinematics, params: ProjectileParams, h: number): Kinematics {
  const k1a = acceleration(s.vx, s.vy, params);
  const k1v = { x: s.vx, y: s.vy };

  const k2v = { x: s.vx + 0.5 * h * k1a.x, y: s.vy + 0.5 * h * k1a.y };
  const k2a = acceleration(k2v.x, k2v.y, params);

  const k3v = { x: s.vx + 0.5 * h * k2a.x, y: s.vy + 0.5 * h * k2a.y };
  const k3a = acceleration(k3v.x, k3v.y, params);

  const k4v = { x: s.vx + h * k3a.x, y: s.vy + h * k3a.y };
  const k4a = acceleration(k4v.x, k4v.y, params);

  return {
    x: s.x + (h / 6) * (k1v.x + 2 * k2v.x + 2 * k3v.x + k4v.x),
    y: s.y + (h / 6) * (k1v.y + 2 * k2v.y + 2 * k3v.y + k4v.y),
    vx: s.vx + (h / 6) * (k1a.x + 2 * k2a.x + 2 * k3a.x + k4a.x),
    vy: s.vy + (h / 6) * (k1a.y + 2 * k2a.y + 2 * k3a.y + k4a.y),
  };
}

/**
 * Find τ ∈ [0, dt] at which the projectile reaches y = 0, by root-finding on
 * the same RK4 step (regula falsi on a bracket). The result is exact to
 * numerical precision whatever the step size, with or without drag.
 */
function findGroundContact(start: Kinematics, params: ProjectileParams, dt: number, endY: number): number {
  let lo = 0;
  let hi = dt;
  let fLo = start.y; // ≥ 0
  let fHi = endY; // ≤ 0
  let tau = fLo - fHi > 0 ? (dt * fLo) / (fLo - fHi) : 0;

  for (let i = 0; i < 40; i++) {
    const f = rk4(start, params, tau).y;
    if (Math.abs(f) < 1e-12) break;
    if (f > 0) {
      lo = tau;
      fLo = f;
    } else {
      hi = tau;
      fHi = f;
    }
    if (fLo - fHi <= 0) break;
    tau = lo + ((hi - lo) * fLo) / (fLo - fHi);
  }
  return tau;
}

/**
 * Step the projectile forward by dt using classic RK4.
 * When the step would cross y = 0 the ground-contact instant is solved for
 * exactly, so the landing position, velocity and time are precise and the
 * state is flagged as landed.
 */
export function stepProjectile(
  state: ProjectileState,
  params: ProjectileParams,
  dt: number
): ProjectileState {
  if (state.hasLanded) return state;

  const start: Kinematics = {
    x: state.position.x,
    y: state.position.y,
    vx: state.velocity.x,
    vy: state.velocity.y,
  };
  const next = rk4(start, params, dt);

  // Ground contact: crossed (or touched) y = 0 on the way down.
  const justLaunchedFromGround = start.y === 0 && start.vy > 0;
  if (next.y <= 0 && start.y >= 0 && !justLaunchedFromGround) {
    const tau = findGroundContact(start, params, dt, next.y);
    const land = rk4(start, params, tau);
    return {
      position: { x: land.x, y: 0 },
      velocity: { x: land.vx, y: land.vy },
      time: state.time + tau,
      hasLanded: true,
    };
  }

  return {
    position: { x: next.x, y: next.y },
    velocity: { x: next.vx, y: next.vy },
    time: state.time + dt,
    hasLanded: false,
  };
}

export interface ProjectileFlight {
  /** Sampled path from launch to landing (inclusive). */
  path: Vec2[];
  range: number;
  flightTime: number;
  maxHeight: number;
  /** Speed at ground contact (m/s). */
  impactSpeed: number;
}

/**
 * Integrate the whole flight (with or without drag) in one go.
 * Used for previews and to compare the simulation against theory.
 */
export function simulateToLanding(
  params: ProjectileParams,
  dt: number = 1 / 240,
  maxTime: number = 600
): ProjectileFlight {
  let state = createInitialState(params);
  const path: Vec2[] = [{ ...state.position }];
  let maxHeight = state.position.y;
  const stride = 4; // keep the preview light

  let i = 0;
  while (!state.hasLanded && state.time < maxTime) {
    state = stepProjectile(state, params, dt);
    maxHeight = Math.max(maxHeight, state.position.y);
    if (state.hasLanded || ++i % stride === 0) path.push({ ...state.position });
  }

  return {
    path,
    range: state.position.x,
    flightTime: state.time,
    maxHeight,
    impactSpeed: Math.hypot(state.velocity.x, state.velocity.y),
  };
}

/**
 * Generate the full analytical trajectory curve for preview.
 */
export function generateAnalyticalTrajectory(
  params: ProjectileParams,
  numPoints: number = 100
): Vec2[] {
  const solution = getAnalyticalSolution(params);
  const points: Vec2[] = [];

  for (let i = 0; i <= numPoints; i++) {
    const t = (i / numPoints) * solution.flightTime;
    const pos = analyticalPosition(params, t);
    points.push({ x: pos.x, y: Math.max(0, pos.y) });
  }

  return points;
}
