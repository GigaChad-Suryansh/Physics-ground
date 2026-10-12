/**
 * Newton's Laws Physics Module
 * 
 * Simulates a block on a surface with applied force, friction, and gravity.
 * Implements:
 *   - F_net = ma (Newton's Second Law)
 *   - Static and kinetic friction
 *   - Normal force calculation
 *   - Free-body diagram data
 */

export interface ForcesParams {
  mass: number;             // kg (must be > 0)
  appliedForce: number;     // N (positive = right)
  appliedAngle: number;     // degrees from horizontal
  frictionCoeffStatic: number;  // μs
  frictionCoeffKinetic: number; // μk
  gravity: number;          // m/s²
  initialVelocity: number;  // m/s
}

export interface ForcesState {
  position: number;         // m
  velocity: number;         // m/s
  acceleration: number;     // m/s²
  time: number;
  isMoving: boolean;
}

export interface ForceBreakdown {
  applied: { x: number; y: number };
  gravity: number;          // downward (positive value)
  normal: number;           // upward (positive value)
  friction: number;         // horizontal (signed)
  net: { x: number; y: number };
  frictionType: 'none' | 'static' | 'kinetic';
}

export const DEFAULT_FORCES_PARAMS: ForcesParams = {
  mass: 5,
  appliedForce: 20,
  appliedAngle: 0,
  frictionCoeffStatic: 0.4,
  frictionCoeffKinetic: 0.3,
  gravity: 9.81,
  initialVelocity: 0,
};

export function createInitialForcesState(params: ForcesParams): ForcesState {
  return {
    position: 0,
    velocity: params.initialVelocity,
    acceleration: 0,
    time: 0,
    isMoving: Math.abs(params.initialVelocity) > 1e-9,
  };
}

/**
 * Calculate all forces on the block.
 * Handles the distinction between static and kinetic friction.
 */
export function calculateForces(params: ForcesParams, velocity: number): ForceBreakdown {
  const angleRad = (params.appliedAngle * Math.PI) / 180;
  const Fx = params.appliedForce * Math.cos(angleRad);
  const Fy = params.appliedForce * Math.sin(angleRad);
  
  const weight = params.mass * params.gravity;
  
  // Normal force: N = mg - Fy (applied force vertical component reduces normal)
  const normal = Math.max(0, weight - Fy);
  
  const isMoving = Math.abs(velocity) > 1e-9;
  let friction = 0;
  let frictionType: 'none' | 'static' | 'kinetic' = 'none';

  if (normal > 0) {
    if (isMoving) {
      // Kinetic friction opposes motion
      friction = -Math.sign(velocity) * params.frictionCoeffKinetic * normal;
      frictionType = 'kinetic';
    } else {
      // Static friction: opposes applied force up to maximum
      const maxStatic = params.frictionCoeffStatic * normal;
      if (Math.abs(Fx) <= maxStatic) {
        // Static friction exactly balances applied force
        friction = -Fx;
        frictionType = 'static';
      } else {
        // Static friction overcome, object starts moving
        friction = -Math.sign(Fx) * params.frictionCoeffKinetic * normal;
        frictionType = 'kinetic';
      }
    }
  }

  const netX = Fx + friction;
  const netY = 0; // constrained to surface

  return {
    applied: { x: Fx, y: Fy },
    gravity: weight,
    normal,
    friction,
    net: { x: netX, y: netY },
    frictionType,
  };
}

/**
 * Step the forces simulation forward by dt.
 *
 * The net force is constant over a step (it only changes when the block
 * starts or stops), so the kinematics are exact:
 *   x += v·dt + ½·a·dt²,   v += a·dt
 * If kinetic friction brings the block to rest part-way through the step, the
 * block travels only until it stops (t = −v/a) and then stays at rest — it
 * never "rolls backwards" or loses that last bit of distance.
 */
export function stepForces(
  state: ForcesState,
  params: ForcesParams,
  dt: number
): ForcesState {
  const forces = calculateForces(params, state.velocity);
  const acceleration = params.mass > 0 ? forces.net.x / params.mass : 0;

  const v0 = state.velocity;
  let newVelocity = v0 + acceleration * dt;
  let displacement: number;

  if (forces.frictionType === 'kinetic' && v0 !== 0 && v0 * newVelocity < 0) {
    // Friction stopped the block mid-step.
    const tStop = -v0 / acceleration;
    displacement = v0 * tStop + 0.5 * acceleration * tStop * tStop;
    newVelocity = 0;
  } else {
    displacement = v0 * dt + 0.5 * acceleration * dt * dt;
  }

  return {
    position: state.position + displacement,
    velocity: newVelocity,
    acceleration,
    time: state.time + dt,
    isMoving: Math.abs(newVelocity) > 1e-9,
  };
}
