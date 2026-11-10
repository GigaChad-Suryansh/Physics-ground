import { describe, it, expect } from 'vitest';
import {
  calculateAcceleration,
  getAnalyticalState,
  stepSimulation,
  DEFAULT_NEWTONS_SECOND_LAW_PARAMS,
  NewtonsSecondLawParams,
} from '../physics/mechanics/newton-s-second-law';

describe("Newton's Second Law Physics Module", () => {
  it('calculates acceleration correctly without friction (a = F / m)', () => {
    const params: NewtonsSecondLawParams = {
      mass: 2.0,
      appliedForce: { x: 10.0, y: 0 },
      frictionCoefficient: 0,
      gravity: 9.81,
    };

    const res = calculateAcceleration(params);
    expect(res.acceleration.x).toBeCloseTo(5.0);
    expect(res.acceleration.y).toBeCloseTo(0);
    expect(res.netForce.x).toBeCloseTo(10.0);
    expect(res.normalForce).toBeCloseTo(19.62);
  });

  it('accounts for kinetic friction reducing net force', () => {
    const params: NewtonsSecondLawParams = {
      mass: 4.0,
      appliedForce: { x: 20.0, y: 0 },
      frictionCoefficient: 0.25,
      gravity: 10.0,
    };

    // Normal force = 40N, Max Friction = 10N
    // Net force x = 20 - 10 = 10N -> acceleration x = 10 / 4 = 2.5 m/s^2
    const res = calculateAcceleration(params, { x: 1.0, y: 0 });
    expect(res.frictionForce.x).toBeCloseTo(-10.0);
    expect(res.netForce.x).toBeCloseTo(10.0);
    expect(res.acceleration.x).toBeCloseTo(2.5);
  });

  it('handles static friction holding block stationary when force is less than maximum friction', () => {
    const params: NewtonsSecondLawParams = {
      mass: 2.0,
      appliedForce: { x: 3.0, y: 0 },
      frictionCoefficient: 0.5,
      gravity: 10.0,
    };

    // Normal force = 20N, Max Friction = 10N
    // Applied force 3N <= 10N friction threshold, so friction resists with -3N and block stays stationary
    const res = calculateAcceleration(params, { x: 0, y: 0 });
    expect(res.frictionForce.x).toBeCloseTo(-3.0);
    expect(res.netForce.x).toBeCloseTo(0);
    expect(res.acceleration.x).toBeCloseTo(0);
  });

  it('computes analytical state correctly over time under constant acceleration', () => {
    const params: NewtonsSecondLawParams = {
      ...DEFAULT_NEWTONS_SECOND_LAW_PARAMS,
      frictionCoefficient: 0,
      mass: 2.0,
      appliedForce: { x: 10.0, y: 0 },
    }; // a = 5 m/s^2

    const t = 2.0;
    const state = getAnalyticalState(t, params, { x: 0, y: 0 }, { x: 0, y: 0 });

    // v = a * t = 5 * 2 = 10
    // x = 0.5 * a * t^2 = 0.5 * 5 * 4 = 10
    expect(state.velocity.x).toBeCloseTo(10.0);
    expect(state.position.x).toBeCloseTo(10.0);
    expect(state.acceleration.x).toBeCloseTo(5.0);
  });

  it('steps simulation correctly using semi-implicit Euler integration', () => {
    const params: NewtonsSecondLawParams = {
      mass: 1.0,
      appliedForce: { x: 4.0, y: 0 },
      frictionCoefficient: 0,
      gravity: 9.81,
    }; // a = 4 m/s^2

    const initialState = getAnalyticalState(0, params);
    const dt = 0.5;

    const nextState = stepSimulation(initialState, params, dt);
    // v_1 = v_0 + a * dt = 0 + 4 * 0.5 = 2 m/s
    // x_1 = x_0 + v_1 * dt = 0 + 2 * 0.5 = 1 m
    expect(nextState.velocity.x).toBeCloseTo(2.0);
    expect(nextState.position.x).toBeCloseTo(1.0);
  });

  it('throws an error if mass is non-positive', () => {
    const invalidParams: NewtonsSecondLawParams = {
      ...DEFAULT_NEWTONS_SECOND_LAW_PARAMS,
      mass: 0,
    };

    expect(() => calculateAcceleration(invalidParams)).toThrow('Mass must be greater than 0');
  });
});
