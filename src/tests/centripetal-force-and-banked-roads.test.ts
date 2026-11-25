import { describe, it, expect } from 'vitest';
import {
  calculateIdealSpeed,
  calculateMaxSpeed,
  calculateMinSpeed,
  calculateBankedRoadState,
} from '../physics/mechanics/centripetal-force-and-banked-roads';

describe('Centripetal Force and Banked Roads', () => {
  const g = 9.81;
  const radius = 100;
  const bankAngleDeg = 15;
  const mass = 1200;

  it('calculates the correct ideal speed', () => {
    // v_ideal = sqrt(g * R * tan(theta))
    // sqrt(9.81 * 100 * tan(15deg)) ≈ 16.213
    const idealSpeed = calculateIdealSpeed(radius, bankAngleDeg, g);
    expect(idealSpeed).toBeCloseTo(16.213, 3);
  });

  it('calculates the correct maximum speed before sliding', () => {
    // v_max = sqrt(g * R * (tan(theta) + mu) / (1 - mu * tan(theta)))
    // For mu = 0.3: sqrt(981 * (0.2679 + 0.3) / (1 - 0.3 * 0.2679)) ≈ 24.614
    const maxSpeed = calculateMaxSpeed(radius, bankAngleDeg, 0.3, g);
    expect(maxSpeed).toBeCloseTo(24.614, 3);
  });

  it('calculates the correct minimum speed before sliding', () => {
    // If tan(theta) <= mu, min speed is 0
    expect(calculateMinSpeed(radius, bankAngleDeg, 0.3, g)).toBe(0);

    // For mu = 0.1: sqrt(g * R * (tan(theta) - mu) / (1 + mu * tan(theta)))
    // sqrt(981 * (0.2679 - 0.1) / (1 + 0.1 * 0.2679)) ≈ 12.667
    const minSpeed = calculateMinSpeed(radius, bankAngleDeg, 0.1, g);
    expect(minSpeed).toBeCloseTo(12.667, 3);
  });

  it('calculates complete state correctly for speed above ideal', () => {
    const params = {
      mass,
      radius,
      bankAngleDeg,
      speed: 20, // > ideal (16.213)
      frictionCoeff: 0.3,
      gravity: g,
    };
    const state = calculateBankedRoadState(params);

    expect(state.centripetalAccel).toBeCloseTo(4.0, 1); // 20^2 / 100
    expect(state.isSliding).toBe(false);
    expect(state.slideDirection).toBe('none');
    // Normal force ≈ 12613 N
    expect(state.normalForce).toBeCloseTo(12613, 0);
    // Required friction ≈ 1590 N
    expect(state.requiredFrictionForce).toBeCloseTo(1590, 0);
  });

  it('detects sliding when speed exceeds maximum', () => {
    const params = {
      mass,
      radius,
      bankAngleDeg,
      speed: 30, // > maxSpeed (24.614)
      frictionCoeff: 0.3,
      gravity: g,
    };
    const state = calculateBankedRoadState(params);
    expect(state.isSliding).toBe(true);
    expect(state.slideDirection).toBe('outward');
  });

  it('detects sliding when speed is below minimum', () => {
    const params = {
      mass,
      radius,
      bankAngleDeg,
      speed: 5, // < minSpeed (12.667 for mu=0.1)
      frictionCoeff: 0.1,
      gravity: g,
    };
    const state = calculateBankedRoadState(params);
    expect(state.isSliding).toBe(true);
    expect(state.slideDirection).toBe('inward');
  });
});
