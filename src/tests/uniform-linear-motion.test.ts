import { describe, it, expect } from 'vitest';
import {
  getUniformLinearState,
  calculatePosition1D,
  calculateDisplacement1D,
  calculateTimeToReach,
} from '../physics/mechanics/uniform-linear-motion';

describe('Uniform Linear Motion', () => {
  const params = {
    initialPosition: { x: 10, y: -5 },
    velocity: { x: 2, y: 3 },
  };

  it('should return initial state at t = 0', () => {
    const state = getUniformLinearState(0, params);
    expect(state.time).toBe(0);
    expect(state.position.x).toBe(10);
    expect(state.position.y).toBe(-5);
    expect(state.velocity).toEqual(params.velocity);
    expect(state.acceleration).toEqual({ x: 0, y: 0 });
    expect(state.displacement).toEqual({ x: 0, y: 0 });
    expect(state.distanceTraveled).toBe(0);
  });

  it('should calculate correct state at t > 0', () => {
    const t = 5;
    const state = getUniformLinearState(t, params);
    // x = 10 + 2*5 = 20
    // y = -5 + 3*5 = 10
    expect(state.time).toBe(t);
    expect(state.position.x).toBeCloseTo(20);
    expect(state.position.y).toBeCloseTo(10);
    expect(state.displacement.x).toBeCloseTo(10);
    expect(state.displacement.y).toBeCloseTo(15);
    // dist = sqrt(10^2 + 15^2) = sqrt(100 + 225) = sqrt(325) ≈ 18.0277
    expect(state.distanceTraveled).toBeCloseTo(Math.sqrt(325));
  });

  it('should handle negative time by treating it as 0', () => {
    const state = getUniformLinearState(-10, params);
    expect(state.time).toBe(0);
    expect(state.position).toEqual(params.initialPosition);
  });

  it('should correctly calculate 1D position', () => {
    expect(calculatePosition1D(5, 2, 3)).toBe(11);
    expect(calculatePosition1D(5, 2, -1)).toBe(5);
  });

  it('should correctly calculate 1D displacement', () => {
    expect(calculateDisplacement1D(10, 2)).toBe(20);
    expect(calculateDisplacement1D(10, -5)).toBe(0);
  });

  it('should correctly calculate time to reach distance', () => {
    expect(calculateTimeToReach(100, 20)).toBe(5);
    expect(calculateTimeToReach(100, 0)).toBe(Infinity);
    expect(calculateTimeToReach(0, 20)).toBe(0);
    expect(calculateTimeToReach(-10, 20)).toBe(0);
  });
});
