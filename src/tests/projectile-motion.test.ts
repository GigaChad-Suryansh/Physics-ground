import { describe, it, expect } from 'vitest';
import {
  getProjectileState,
  calculateAnalyticalSummary,
  DEFAULT_PROJECTILE_PARAMS,
  ProjectileParams,
} from '../physics/mechanics/projectile-motion';

describe('Projectile Motion Physics Engine', () => {
  it('calculates initial state correctly at t = 0', () => {
    const params: ProjectileParams = {
      initialSpeed: 10,
      launchAngleDeg: 30,
      initialPosition: { x: 5, y: 10 },
      gravity: 9.81,
    };

    const state = getProjectileState(0, params);
    expect(state.position.x).toBeCloseTo(5, 5);
    expect(state.position.y).toBeCloseTo(10, 5);
    expect(state.velocity.x).toBeCloseTo(10 * Math.cos(Math.PI / 6), 5);
    expect(state.velocity.y).toBeCloseTo(10 * Math.sin(Math.PI / 6), 5);
    expect(state.speed).toBeCloseTo(10, 5);
  });

  it('reaches zero vertical velocity at maximum height time', () => {
    const params: ProjectileParams = {
      initialSpeed: 20,
      launchAngleDeg: 60,
      initialPosition: { x: 0, y: 0 },
      gravity: 10,
    };

    const summary = calculateAnalyticalSummary(params);
    const v0y = 20 * Math.sin(Math.PI / 3);
    const tPeak = v0y / 10;

    const stateAtPeak = getProjectileState(tPeak, params);
    expect(stateAtPeak.velocity.y).toBeCloseTo(0, 5);
    expect(stateAtPeak.position.y).toBeCloseTo(summary.maxHeight, 5);
  });

  it('calculates analytical summary for standard 45 degree launch on flat ground', () => {
    const params: ProjectileParams = {
      initialSpeed: 20,
      launchAngleDeg: 45,
      initialPosition: { x: 0, y: 0 },
      gravity: 9.81,
    };

    const summary = calculateAnalyticalSummary(params);
    const v0 = 20;
    const g = 9.81;
    const expectedTimeOfFlight = (2 * v0 * Math.sin(Math.PI / 4)) / g;
    const expectedMaxHeight = Math.pow(v0 * Math.sin(Math.PI / 4), 2) / (2 * g);
    const expectedRange = (v0 * v0 * Math.sin(Math.PI / 2)) / g;

    expect(summary.timeOfFlight).toBeCloseTo(expectedTimeOfFlight, 4);
    expect(summary.maxHeight).toBeCloseTo(expectedMaxHeight, 4);
    expect(summary.range).toBeCloseTo(expectedRange, 4);
  });

  it('handles horizontal launch from elevated position (0 degrees angle)', () => {
    const params: ProjectileParams = {
      initialSpeed: 15,
      launchAngleDeg: 0,
      initialPosition: { x: 0, y: 20 },
      gravity: 9.81,
    };

    const summary = calculateAnalyticalSummary(params);
    // 20 - 0.5 * 9.81 * t^2 = 0 => t = sqrt(40 / 9.81)
    const expectedT = Math.sqrt(40 / 9.81);
    const expectedRange = 15 * expectedT;

    expect(summary.maxHeight).toBeCloseTo(20, 5);
    expect(summary.timeOfFlight).toBeCloseTo(expectedT, 4);
    expect(summary.range).toBeCloseTo(expectedRange, 4);
  });

  it('handles pure vertical motion (90 degrees angle)', () => {
    const params: ProjectileParams = {
      initialSpeed: 10,
      launchAngleDeg: 90,
      initialPosition: { x: 2, y: 0 },
      gravity: 10,
    };

    const summary = calculateAnalyticalSummary(params);
    expect(summary.range).toBeCloseTo(2, 5);
    expect(summary.timeOfFlight).toBeCloseTo(2, 5); // 2 * 10 / 10 = 2
    expect(summary.maxHeight).toBeCloseTo(5, 5); // 10^2 / 20 = 5

    const stateAtFlightEnd = getProjectileState(summary.timeOfFlight, params);
    expect(stateAtFlightEnd.position.x).toBeCloseTo(2, 5);
    expect(stateAtFlightEnd.position.y).toBeCloseTo(0, 5);
  });
});
