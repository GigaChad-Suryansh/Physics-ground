/**
 * Distance versus Displacement
 *
 * Concepts:
 * 1. Distance (d): The total path length traveled by an object.
 *    d = ∫ |v(t)| dt (scalar)
 *
 * 2. Displacement (Δr): The straight-line change in position.
 *    Δr = r_final - r_initial (vector)
 *
 * 3. Magnitude of Displacement |Δr|: The straight-line distance between start and end.
 *    |Δr| = √((x_f - x_i)² + (y_f - y_i)²)
 */

import { sub, magnitude, Vec2 } from '../vector';

export type PathType = 'linear' | 'zigzag' | 'circle' | 'random';

export interface PathParams {
  type: PathType;
  amplitude: number;
}

/**
 * Calculates the position at a given time for various path types.
 */
export function getPathPosition(time: number, params: PathParams): Vec2 {
  const { type, amplitude } = params;
  
  switch (type) {
    case 'linear':
      return { x: time * 2, y: 0 };
    
    case 'zigzag': {
      const period = 2;
      const x = time * 1.5;
      const phase = (time % period) / period;
      const y = phase < 0.5 
        ? amplitude * (4 * phase - 1)
        : amplitude * (1 - 4 * (phase - 0.5));
      return { x, y };
    }
    
    case 'circle': {
      const radius = amplitude || 2;
      return {
        x: radius * Math.cos(time),
        y: radius * Math.sin(time)
      };
    }
    
    case 'random': {
      // Deterministic "random" path using sine waves
      return {
        x: amplitude * Math.sin(time * 0.7) + amplitude * 0.5 * Math.cos(time * 1.3),
        y: amplitude * Math.cos(time * 0.5) + amplitude * 0.5 * Math.sin(time * 1.1)
      };
    }
    
    default:
      return { x: 0, y: 0 };
  }
}

/**
 * Calculates the displacement vector and its magnitude.
 */
export function calculateDisplacement(current: Vec2, initial: Vec2) {
  const vec = sub(current, initial);
  return {
    vec,
    magnitude: magnitude(vec)
  };
}

/**
 * Numerically approximates distance by summing small step lengths.
 * In a real simulation loop, this would be updated per frame.
 */
export function calculateDistanceStep(current: Vec2, previous: Vec2): number {
  return magnitude(sub(current, previous));
}
