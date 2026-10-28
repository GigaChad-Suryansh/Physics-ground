import { describe, it, expect } from 'vitest';
import {
  getMotionGraphState,
  calculateDisplacement,
  calculateVelocityChange,
  generateMotionGraphData,
  DEFAULT_MOTION_GRAPH_PARAMS,
  MotionGraphParams,
} from '../physics/mechanics/motion-graphs';

describe('Motion Graphs Physics Module', () => {
  it('calculates state correctly for uniform motion', () => {
    const params: MotionGraphParams = {
      type: 'uniform',
      initialPosition: 5,
      initialVelocity: 3,
      acceleration: 0,
      amplitude: 0,
      frequency: 0,
      phase: 0,
    };

    const state = getMotionGraphState(4, params);
    expect(state.time).toBe(4);
    expect(state.position).toBeCloseTo(17); // 5 + 3*4
    expect(state.velocity).toBeCloseTo(3);
    expect(state.acceleration).toBeCloseTo(0);
  });

  it('calculates state correctly for constant acceleration motion', () => {
    const params: MotionGraphParams = {
      type: 'constant-acceleration',
      initialPosition: 10,
      initialVelocity: 5,
      acceleration: -2,
      amplitude: 0,
      frequency: 0,
      phase: 0,
    };

    const state = getMotionGraphState(2, params);
    expect(state.position).toBeCloseTo(16); // 10 + 5*2 + 0.5*(-2)*4
    expect(state.velocity).toBeCloseTo(1);   // 5 + (-2)*2
    expect(state.acceleration).toBeCloseTo(-2);
  });

  it('calculates state correctly for harmonic motion', () => {
    const params: MotionGraphParams = {
      type: 'harmonic',
      initialPosition: 0,
      initialVelocity: 0,
      acceleration: 0,
      amplitude: 2,
      frequency: 0.5, // ω = 2 * π * 0.5 = π
      phase: 0,
    };

    const stateAt0 = getMotionGraphState(0, params);
    expect(stateAt0.position).toBeCloseTo(2);
    expect(stateAt0.velocity).toBeCloseTo(0);
    expect(stateAt0.acceleration).toBeCloseTo(-2 * Math.PI * Math.PI);

    const stateAtHalfPeriod = getMotionGraphState(0.5, params); // wt = π / 2
    expect(stateAtHalfPeriod.position).toBeCloseTo(0);
    expect(stateAtHalfPeriod.velocity).toBeCloseTo(-2 * Math.PI);
    expect(stateAtHalfPeriod.acceleration).toBeCloseTo(0);
  });

  it('calculates displacement and velocity change over a time interval', () => {
    const displacement = calculateDisplacement(1, 3, DEFAULT_MOTION_GRAPH_PARAMS);
    // x(1) = 0 + 5(1) + 0.5(-2)(1) = 4
    // x(3) = 0 + 5(3) + 0.5(-2)(9) = 6
    // Δx = 6 - 4 = 2
    expect(displacement).toBeCloseTo(2);

    const vChange = calculateVelocityChange(1, 3, DEFAULT_MOTION_GRAPH_PARAMS);
    // v(1) = 5 + (-2)(1) = 3
    // v(3) = 5 + (-2)(3) = -1
    // Δv = -1 - 3 = -4
    expect(vChange).toBeCloseTo(-4);
  });

  it('generates motion graph sample data correctly', () => {
    const data = generateMotionGraphData(DEFAULT_MOTION_GRAPH_PARAMS, 10, 11);
    expect(data.length).toBe(11);
    expect(data[0].time).toBeCloseTo(0);
    expect(data[10].time).toBeCloseTo(10);
    expect(data[0].position).toBeCloseTo(0);
  });
});
