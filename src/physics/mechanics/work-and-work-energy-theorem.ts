/**
 * Work and Work-Energy Theorem
 *
 * Concepts & Physics Equations:
 * 1. Work done by a constant force:
 *    W = F · d = |F| |d| cos(θ)
 *    where F is the applied force vector, d is the displacement vector, and θ is the angle between F and d.
 *
 * 2. Work-Energy Theorem:
 *    W_net = ΔK = K_final - K_initial
 *    where Kinetic Energy K = 0.5 * m * v^2
 *
 * 3. Net force with friction on a horizontal plane:
 *    F_friction = μ * m * g
 *    F_net_x = F * cos(θ) - F_friction (if moving or pushed beyond static friction threshold)
 *    F_net_y = N + F * sin(θ) - m * g = 0  => N = m * g - F * sin(θ)
 *
 * Assumptions:
 * - 1D translational motion along horizontal surface x-axis (x >= 0).
 * - Constant applied force magnitude and angle, or constant net work calculations.
 * - Standard gravitational acceleration g = 9.81 m/s^2.
 */

export interface WorkEnergyParams {
  mass: number; // kg (> 0)
  initialVelocity: number; // m/s
  forceMagnitude: number; // N (>= 0)
  forceAngleDeg: number; // degrees relative to direction of motion (+x)
  frictionCoeff: number; // μ (>= 0)
  distance: number; // m displacement (> 0)
  g: number; // m/s^2 (default 9.81)
}

export const DEFAULT_WORK_ENERGY_PARAMS: WorkEnergyParams = {
  mass: 2.0,
  initialVelocity: 0,
  forceMagnitude: 10.0,
  forceAngleDeg: 0,
  frictionCoeff: 0.1,
  distance: 5.0,
  g: 9.81,
};

export interface WorkEnergyState {
  workApplied: number; // Work done by applied force W_F (Joules)
  workFriction: number; // Work done by friction force W_f (Joules, typically <= 0)
  workNet: number; // Total net work W_net (Joules)
  initialKineticEnergy: number; // K_i (Joules)
  finalKineticEnergy: number; // K_f (Joules)
  finalVelocity: number; // v_f (m/s)
  acceleration: number; // a (m/s^2)
}

/**
 * Calculates work done by individual forces and the resulting state change
 * according to the Work-Energy Theorem.
 */
export function calculateWorkEnergyState(params: WorkEnergyParams): WorkEnergyState {
  const { mass, initialVelocity, forceMagnitude, forceAngleDeg, frictionCoeff, distance, g } = params;

  const angleRad = (forceAngleDeg * Math.PI) / 180;

  // Applied force components
  const F_x = forceMagnitude * Math.cos(angleRad);
  const F_y = forceMagnitude * Math.sin(angleRad);

  // Normal force N = m*g - F_y (clamped to >= 0 if normal force loses contact)
  const normalForce = Math.max(0, mass * g - F_y);

  // Friction force opposing motion along +x
  const frictionForce = frictionCoeff * normalForce;

  // Work done by applied force: W_applied = F_x * distance = forceMagnitude * distance * cos(theta)
  const workApplied = F_x * distance;

  // Work done by friction: W_friction = -f * distance
  const workFriction = -frictionForce * distance;

  // Net work
  const workNet = workApplied + workFriction;

  // Initial kinetic energy K_i = 0.5 * m * v_i^2
  const initialKineticEnergy = 0.5 * mass * Math.pow(initialVelocity, 2);

  // Final kinetic energy K_f = K_i + W_net (clamped to >= 0 if object comes to rest)
  const finalKineticEnergy = Math.max(0, initialKineticEnergy + workNet);

  // Final velocity v_f = sqrt(2 * K_f / m)
  const finalVelocity = Math.sqrt((2 * finalKineticEnergy) / mass);

  // Acceleration a = F_net_x / m
  const F_net_x = F_x - frictionForce;
  const acceleration = F_net_x / mass;

  return {
    workApplied,
    workFriction,
    workNet,
    initialKineticEnergy,
    finalKineticEnergy,
    finalVelocity,
    acceleration,
  };
}

/**
 * Calculates work done given force vector and displacement vector.
 * W = F · d
 */
export function calculateWorkDotProduct(force: { x: number; y: number }, displacement: { x: number; y: number }): number {
  return force.x * displacement.x + force.y * displacement.y;
}
