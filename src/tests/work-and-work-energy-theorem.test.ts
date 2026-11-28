import { describe, it, expect } from 'vitest';
import {
  calculateWorkEnergyState,
  calculateWorkDotProduct,
  DEFAULT_WORK_ENERGY_PARAMS,
} from '../physics/mechanics/work-and-work-energy-theorem';

describe('Work and Work-Energy Theorem Physics Module', () => {
  it('correctly calculates work via dot product W = F · d', () => {
    const force = { x: 10, y: 5 };
    const displacement = { x: 4, y: 2 };
    const work = calculateWorkDotProduct(force, displacement);
    expect(work).toBeCloseTo(50, 5);
  });

  it('calculates work and final velocity for frictionless horizontal motion from rest', () => {
    const params = {
      mass: 2.0,
      initialVelocity: 0,
      forceMagnitude: 10.0,
      forceAngleDeg: 0,
      frictionCoeff: 0,
      distance: 5.0,
      g: 9.81,
    };

    const state = calculateWorkEnergyState(params);

    expect(state.workApplied).toBeCloseTo(50, 4);
    expect(state.workFriction).toBeCloseTo(0, 4);
    expect(state.workNet).toBeCloseTo(50, 4);
    expect(state.initialKineticEnergy).toBeCloseTo(0, 4);
    expect(state.finalKineticEnergy).toBeCloseTo(50, 4);
    // v_f = sqrt(2 * 50 / 2) = sqrt(50) ≈ 7.0710678
    expect(state.finalVelocity).toBeCloseTo(Math.sqrt(50), 4);
    expect(state.acceleration).toBeCloseTo(5.0, 4);
  });

  it('verifies Work-Energy Theorem ΔK = W_net with friction and non-zero initial velocity', () => {
    const params = {
      mass: 5.0,
      initialVelocity: 2.0,
      forceMagnitude: 20.0,
      forceAngleDeg: 30, // F_x = 20 * cos(30°) = 17.3205, F_y = 10
      frictionCoeff: 0.2,
      distance: 10.0,
      g: 9.81,
    };

    const state = calculateWorkEnergyState(params);

    const deltaK = state.finalKineticEnergy - state.initialKineticEnergy;
    expect(deltaK).toBeCloseTo(state.workNet, 5);

    // Hand calculated:
    // N = 5 * 9.81 - 10 = 39.05 N
    // frictionForce = 0.2 * 39.05 = 7.81 N
    // W_applied = 20 * cos(30°) * 10 ≈ 173.20508 J
    // W_friction = -7.81 * 10 = -78.1 J
    // W_net = 95.10508 J
    // K_i = 0.5 * 5 * 4 = 10 J
    // K_f = 105.10508 J
    expect(state.workApplied).toBeCloseTo(173.20508, 3);
    expect(state.workFriction).toBeCloseTo(-78.1, 3);
    expect(state.workNet).toBeCloseTo(95.10508, 3);
    expect(state.initialKineticEnergy).toBeCloseTo(10, 4);
    expect(state.finalKineticEnergy).toBeCloseTo(105.10508, 3);
  });

  it('returns zero applied work when force is perpendicular to displacement (90 degrees)', () => {
    const params = {
      ...DEFAULT_WORK_ENERGY_PARAMS,
      forceMagnitude: 15.0,
      forceAngleDeg: 90,
      frictionCoeff: 0,
      distance: 8.0,
    };

    const state = calculateWorkEnergyState(params);

    expect(state.workApplied).toBeCloseTo(0, 5);
  });

  it('handles default parameters correctly', () => {
    const state = calculateWorkEnergyState(DEFAULT_WORK_ENERGY_PARAMS);
    expect(state.workApplied).toBeGreaterThan(0);
    expect(state.finalKineticEnergy).toBeCloseTo(state.initialKineticEnergy + state.workNet, 5);
  });
});
