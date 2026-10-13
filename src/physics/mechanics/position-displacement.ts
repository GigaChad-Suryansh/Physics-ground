/**
 * Position, Displacement, and Reference Frames
 *
 * Concepts:
 * 1. Position (r): The location of an object relative to an origin.
 *    In 2D: r = (x, y)
 *
 * 2. Displacement (Δr): The change in position of an object.
 *    Δr = r_final - r_initial = (x_f - x_i, y_f - y_i)
 *    Displacement is a vector and is independent of the origin of the coordinate system,
 *    but its components depend on the orientation of the axes.
 *
 * 3. Reference Frames:
 *    A coordinate system used to measure position and motion.
 *    Given a Global Frame (A) and a Local Frame (B):
 *    - Origin of B in A: O_B
 *    - Rotation of B axes relative to A: θ
 *
 *    Transformation from A to B:
 *    r_B = R(-θ) * (r_A - O_B)
 *    x_B = (x_A - x_O)cosθ + (y_A - y_O)sinθ
 *    y_B = -(x_A - x_O)sinθ + (y_A - y_O)cosθ
 */

import { rotate, sub, Vec2 } from '../vector';
import { DEG_TO_RAD } from '../constants';

export interface ReferenceFrameParams {
  originB: Vec2;
  rotationB: number; // in degrees
}

export interface PositionState {
  globalPosition: Vec2;
  initialGlobalPosition: Vec2;
  time: number;
}

export interface TransformationResult {
  positionInA: Vec2;
  positionInB: Vec2;
  displacementInA: Vec2;
  displacementInB: Vec2;
}

export const DEFAULT_FRAME_PARAMS: ReferenceFrameParams = {
  originB: { x: 2, y: 2 },
  rotationB: 0,
};

/**
 * Transforms position and displacement from Global Frame A to Local Frame B.
 */
export function transformToFrame(
  currentA: Vec2,
  initialA: Vec2,
  frame: ReferenceFrameParams
): TransformationResult {
  const thetaRad = frame.rotationB * DEG_TO_RAD;

  // Position in B
  const relativePos = sub(currentA, frame.originB);
  const positionInB = rotate(relativePos, -thetaRad);

  // Displacement in A
  const displacementInA = sub(currentA, initialA);

  // Displacement in B
  // Displacement is the difference between two positions in the SAME frame.
  const relativeInitialPos = sub(initialA, frame.originB);
  const initialPosInB = rotate(relativeInitialPos, -thetaRad);
  const displacementInB = sub(positionInB, initialPosInB);

  return {
    positionInA: currentA,
    positionInB,
    displacementInA,
    displacementInB,
  };
}

/**
 * Generates a path for the object to follow.
 * type: 'circle', 'linear', 'oscillation'
 */
export function getPositionAtTime(time: number, type: 'circle' | 'linear' | 'oscillation'): Vec2 {
  switch (type) {
    case 'circle':
      return {
        x: 4 * Math.cos(time * 0.5),
        y: 4 * Math.sin(time * 0.5),
      };
    case 'linear':
      return {
        x: -5 + time,
        y: -2 + 0.5 * time,
      };
    case 'oscillation':
      return {
        x: 5 * Math.sin(time),
        y: 0,
      };
    default:
      return { x: 0, y: 0 };
  }
}
