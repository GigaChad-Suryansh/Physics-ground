import { describe, it, expect } from 'vitest';
import {
  DEFAULT_NEWTONS_FIRST_LAW_PARAMS,
  calculateNetForce,
  getAnalyticalState,
  getFrictionalStoppingInfo,
  stepSimulation,
  NewtonsFirstLawState,
} from '../physics/mechanics/newton-s-first-law';

describe("Newton's First Law physics module", () => {
  it('maintains constant velocity when net force is zero (Law of Inertia)', () => {
    const params = {
      ...DEFAULT_NEWTONS_FIRST_LAW_PARAMS,
      initialVelocity: { x: 10, y: -4 },
      initialPosition: { x: 2, y: 5 },
      appliedForce: { x: 0, y: 0 },
      frictionCoefficient: 0.0,
    };

    const state = getAnalyticalState(3.5, params);

    expect(state.velocity.x).toBeCloseTo(10);
    expect(state.velocity.y).toBeCloseTo(-4);
    expect(state.acceleration.x).toBeCloseTo(0);
    expect(state.acceleration.y).toBeCloseTo(0);
    expect(state.position.x).toBeCloseTo(2 + 10 * 3.5); // 37
    expect(state.position.y).toBeCloseTo(5 - 4 * 3.5); // -9
  });

  it('accelerates properly when an external net force is applied', () => {
    const params = {
      ...DEFAULT_NEWTONS_FIRST_LAW_PARAMS,
      mass: 2.0,
      initialVelocity: { x: 3, y: 0 },
      initialPosition: { x: 0, y: 0 },
      appliedForce: { x: 6, y: -4 }, // a = (3, -2)
      frictionCoefficient: 0.0,
    };

    const state = getAnalyticalState(2.0, params);

    expect(state.acceleration.x).toBeCloseTo(3);
    expect(state.acceleration.y).toBeCloseTo(-2);
    expect(state.velocity.x).toBeCloseTo(3 + 3 * 2.0); // 9
    expect(state.velocity.y).toBeCloseTo(0 - 2 * 2.0); // -4
    expect(state.position.x).toBeCloseTo(3 * 2.0 + 0.5 * 3 * 4.0); // 12
    expect(state.position.y).toBeCloseTo(0 * 2.0 + 0.5 * (-2) * 4.0); // -4
  });

  it('calculates frictional stopping time and stopping distance correctly', () => {
    const v0 = 10;
    const mu = 0.2;
    const g = 9.81;

    const info = getFrictionalStoppingInfo(v0, mu, g);

    // t_stop = 10 / (0.2 * 9.81) = 5.0968399...
    // d_stop = 100 / (2 * 0.2 * 9.81) = 25.484199...
    expect(info.stopTime).toBeCloseTo(10 / (0.2 * 9.81), 4);
    expect(info.stopDistance).toBeCloseTo(100 / (2 * 0.2 * 9.81), 4);
  });

  it('preserves constant velocity step-by-step when friction and applied force are zero', () => {
    const params = {
      ...DEFAULT_NEWTONS_FIRST_LAW_PARAMS,
      initialVelocity: { x: 8, y: 0 },
      initialPosition: { x: 0, y: 0 },
      frictionCoefficient: 0,
      appliedForce: { x: 0, y: 0 },
    };

    let state: NewtonsFirstLawState = {
      position: params.initialPosition,
      velocity: params.initialVelocity,
      acceleration: { x: 0, y: 0 },
      netForce: { x: 0, y: 0 },
      frictionForce: { x: 0, y: 0 },
      isAtRest: false,
    };

    const dt = 0.1;
    for (let step = 0; step < 50; step++) {
      state = stepSimulation(state, params, dt);
    }

    // After 5 seconds (50 * 0.1s), position should be x = 40, velocity x = 8
    expect(state.position.x).toBeCloseTo(40, 4);
    expect(state.velocity.x).toBeCloseTo(8, 4);
    expect(state.isAtRest).toBe(false);
  });

  it('decelerates to rest under friction without velocity inversion', () => {
    const params = {
      ...DEFAULT_NEWTONS_FIRST_LAW_PARAMS,
      mass: 1.0,
      initialVelocity: { x: 2, y: 0 },
      initialPosition: { x: 0, y: 0 },
      appliedForce: { x: 0, y: 0 },
      frictionCoefficient: 0.5,
      gravity: 9.81,
    };

    let state: NewtonsFirstLawState = {
      position: params.initialPosition,
      velocity: params.initialVelocity,
      acceleration: { x: 0, y: 0 },
      netForce: { x: 0, y: 0 },
      frictionForce: { x: 0, y: 0 },
      isAtRest: false,
    };

    const dt = 0.1;
    // t_stop = 2 / (0.5 * 9.81) = ~0.4077s
    for (let step = 0; step < 10; step++) {
      state = stepSimulation(state, params, dt);
    }

    expect(state.velocity.x).toBeCloseTo(0, 4);
    expect(state.velocity.y).toBeCloseTo(0, 4);
    expect(state.isAtRest).toBe(true);
  });
});
