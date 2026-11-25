/**
 * Centripetal Force and Banked Roads
 *
 * Physics Concepts:
 * 1. Centripetal Force (F_c):
 *    The net force directed toward the center of curvature required to keep an object
 *    moving in a circular path of radius R at speed v:
 *    F_c = m * v^2 / R = m * a_c
 *
 * 2. Banked Incline / Road Geometry:
 *    A road banked at angle θ (measured from the horizontal) allows a vehicle to negotiate a curve
 *    without relying entirely on friction.
 *
 * 3. Ideal (Design) Speed (v_ideal):
 *    The speed at which no friction is required to stay on the circular path:
 *    N * sin(θ) = m * v^2 / R
 *    N * cos(θ) = m * g
 *    => tan(θ) = v_ideal^2 / (g * R)
 *    => v_ideal = sqrt(g * R * tan(θ))
 *
 * 4. Force Components along and perpendicular to the inclined road surface:
 *    - Perpendicular (Normal) axis:
 *      N = m * g * cos(θ) + m * a_c * sin(θ)
 *    - Parallel axis (up the slope):
 *      F_parallel_needed = m * a_c * cos(θ) - m * g * sin(θ)
 *      If F_parallel_needed > 0 (v > v_ideal), the vehicle tends to slide outward/upward,
 *      so static friction acts down the slope: f_s = F_parallel_needed.
 *      If F_parallel_needed < 0 (v < v_ideal), the vehicle tends to slide inward/downward,
 *      so static friction acts up the slope: f_s = -F_parallel_needed.
 *      Maximum available static friction: f_max = μ_s * N.
 *
 * 5. Minimum and Maximum Safe Speeds (without sliding):
 *    - Maximum speed (v_max):
 *      v_max = sqrt(g * R * (tan(θ) + μ_s) / (1 - μ_s * tan(θ)))   [for μ_s * tan(θ) < 1]
 *    - Minimum speed (v_min):
 *      v_min = sqrt(g * R * (tan(θ) - μ_s) / (1 + μ_s * tan(θ)))   [for tan(θ) > μ_s, else 0]
 */

import { g_EARTH } from '../constants';

export interface BankedRoadParams {
  mass: number;       // kg, vehicle mass
  radius: number;     // m, radius of curve
  bankAngleDeg: number; // degrees, angle of banking from horizontal
  speed: number;      // m/s, vehicle speed
  frictionCoeff: number; // μ_s, coefficient of static friction
  gravity?: number;   // m/s^2, optional custom gravity (defaults to standard G)
}

export interface BankedRoadState {
  bankAngleRad: number;
  centripetalAccel: number; // m/s^2
  centripetalForce: number; // N
  idealSpeed: number;       // m/s
  normalForce: number;      // N
  requiredFrictionForce: number; // N (magnitude of static friction needed)
  maxFrictionForce: number; // N (maximum available static friction)
  requiredFrictionCoeff: number; // μ_req needed to avoid sliding
  minSpeed: number;         // m/s (0 if no lower limit)
  maxSpeed: number;         // m/s (Infinity if no upper limit due to banking)
  isSliding: boolean;       // true if required friction exceeds max friction
  slideDirection: 'none' | 'outward' | 'inward';
}

export const DEFAULT_BANKED_ROAD_PARAMS: BankedRoadParams = {
  mass: 1200,          // 1200 kg car
  radius: 100,         // 100 m radius turn
  bankAngleDeg: 15,    // 15 degree bank
  speed: 20,           // 20 m/s (~72 km/h)
  frictionCoeff: 0.3,  // moderately slippery or dry road
};

/**
 * Calculates the ideal speed for a banked road given radius, bank angle in degrees, and gravity.
 */
export function calculateIdealSpeed(radius: number, bankAngleDeg: number, gravity = g_EARTH): number {
  if (radius <= 0 || gravity <= 0) return 0;
  const angleRad = (bankAngleDeg * Math.PI) / 180;
  const tanTheta = Math.tan(angleRad);
  if (tanTheta <= 0) return 0;
  return Math.sqrt(gravity * radius * tanTheta);
}

/**
 * Calculates maximum speed before sliding outward on a banked road.
 * Returns Infinity if banking angle and friction provide unlimited hold against outward sliding.
 */
export function calculateMaxSpeed(
  radius: number,
  bankAngleDeg: number,
  frictionCoeff: number,
  gravity = g_EARTH
): number {
  if (radius <= 0 || gravity <= 0) return 0;
  const angleRad = (bankAngleDeg * Math.PI) / 180;
  const tanTheta = Math.tan(angleRad);
  const denom = 1 - frictionCoeff * tanTheta;
  if (denom <= 0) return Infinity; // Angle is steep enough that friction prevents outward slip at any speed
  const num = gravity * radius * (tanTheta + frictionCoeff);
  return Math.sqrt(num / denom);
}

/**
 * Calculates minimum speed before sliding inward on a banked road.
 * Returns 0 if gravity force down incline is less than or equal to max static friction at rest.
 */
export function calculateMinSpeed(
  radius: number,
  bankAngleDeg: number,
  frictionCoeff: number,
  gravity = g_EARTH
): number {
  if (radius <= 0 || gravity <= 0) return 0;
  const angleRad = (bankAngleDeg * Math.PI) / 180;
  const tanTheta = Math.tan(angleRad);
  if (tanTheta <= frictionCoeff) return 0; // Friction can hold vehicle at rest / low speed
  const num = gravity * radius * (tanTheta - frictionCoeff);
  const denom = 1 + frictionCoeff * tanTheta;
  return Math.sqrt(num / denom);
}

/**
 * Analyzes complete dynamics for a vehicle on a banked road.
 */
export function calculateBankedRoadState(params: BankedRoadParams): BankedRoadState {
  const g = params.gravity ?? g_EARTH;
  const { mass, radius, bankAngleDeg, speed, frictionCoeff } = params;

  const bankAngleRad = (bankAngleDeg * Math.PI) / 180;
  const sinTheta = Math.sin(bankAngleRad);
  const cosTheta = Math.cos(bankAngleRad);

  const centripetalAccel = radius > 0 ? (speed * speed) / radius : 0;
  const centripetalForce = mass * centripetalAccel;

  const idealSpeed = calculateIdealSpeed(radius, bankAngleDeg, g);
  const minSpeed = calculateMinSpeed(radius, bankAngleDeg, frictionCoeff, g);
  const maxSpeed = calculateMaxSpeed(radius, bankAngleDeg, frictionCoeff, g);

  // Normal force: perpendicular to slope
  const normalForce = mass * g * cosTheta + mass * centripetalAccel * sinTheta;

  // Net force along slope required for circular motion:
  // Component of centripetal force along slope minus gravity component down slope
  const slopeParallelDiff = mass * centripetalAccel * cosTheta - mass * g * sinTheta;

  const requiredFrictionForce = Math.abs(slopeParallelDiff);
  const maxFrictionForce = Math.max(0, frictionCoeff * normalForce);

  const requiredFrictionCoeff = normalForce > 0 ? requiredFrictionForce / normalForce : 0;

  let slideDirection: 'none' | 'outward' | 'inward' = 'none';
  const isSliding = requiredFrictionForce > maxFrictionForce + 1e-9;

  if (isSliding) {
    if (slopeParallelDiff > 0) {
      slideDirection = 'outward';
    } else {
      slideDirection = 'inward';
    }
  }

  return {
    bankAngleRad,
    centripetalAccel,
    centripetalForce,
    idealSpeed,
    normalForce,
    requiredFrictionForce,
    maxFrictionForce,
    requiredFrictionCoeff,
    minSpeed,
    maxSpeed,
    isSliding,
    slideDirection,
  };
}
