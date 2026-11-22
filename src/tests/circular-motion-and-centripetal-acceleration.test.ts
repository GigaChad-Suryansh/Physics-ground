import { describe, it, expect } from 'vitest';
import {
  calculatePeriod,
  calculateFrequency,
  calculateCentripetalAcceleration,
  calculateCentripetalForce,
  getCircularMotionState,
  stepCircularMotion,
  DEFAULT_CIRCULAR_MOTION_PARAMS,
} from '../physics/mechanics/circular-motion-and-centripetal-acceleration';

describe('Circular Motion and Centripetal Acceleration', () => {
  it('calculates scalar period, frequency, acceleration, and force correctly', () => {
    const radius = 4;
    const omega = 3; // rad/s
    const mass = 2; // kg

    const period = calculatePeriod(omega);
    const frequency = calculateFrequency(omega);
    const ac = calculateCentripetalAcceleration(radius, omega);
    const fc = calculateCentripetalForce(mass, radius, omega);

    expect(period).toBeCloseTo((2 * Math.PI) / 3, 5);
    expect(frequency).toBeCloseTo(3 / (2 * Math.PI), 5);
    expect(ac).toBeCloseTo(4 * 3 * 3, 5); // 36 m/s^2
    expect(fc).toBeCloseTo(2 * 36, 5); // 72 N
  });

  it('computes correct initial state at t = 0', () => {
    const params = {
      radius: 10,
      angularVelocity: 2,
      mass: 5,
      initialAngle: 0,
      center: { x: 0, y: 0 },
    };

    const state = getCircularMotionState(0, params);

    expect(state.angle).toBeCloseTo(0, 5);
    expect(state.position.x).toBeCloseTo(10, 5);
    expect(state.position.y).toBeCloseTo(0, 5);
    expect(state.velocity.x).toBeCloseTo(0, 5);
    expect(state.velocity.y).toBeCloseTo(20, 5); // v_y = r * omega = 20
    expect(state.acceleration.x).toBeCloseTo(-40, 5); // a_x = -r * omega^2 = -40
    expect(state.acceleration.y).toBeCloseTo(0, 5);
    expect(state.speed).toBeCloseTo(20, 5);
    expect(state.centripetalAccelMag).toBeCloseTo(40, 5);
    expect(state.centripetalForceMag).toBeCloseTo(200, 5);
  });

  it('computes state correctly at quarter period t = T/4', () => {
    const params = {
      radius: 5,
      angularVelocity: Math.PI, // 180 deg/s
      mass: 1,
    };
    const period = calculatePeriod(params.angularVelocity); // 2s
    const state = getCircularMotionState(period / 4, params); // t = 0.5s, angle = PI/2

    expect(state.angle).toBeCloseTo(Math.PI / 2, 5);
    expect(state.position.x).toBeCloseTo(0, 5);
    expect(state.position.y).toBeCloseTo(5, 5);
    expect(state.velocity.x).toBeCloseTo(-5 * Math.PI, 5);
    expect(state.velocity.y).toBeCloseTo(0, 5);
    expect(state.acceleration.x).toBeCloseTo(0, 5);
    expect(state.acceleration.y).toBeCloseTo(-5 * Math.PI * Math.PI, 5);
  });

  it('maintains orthogonality of velocity and position vectors and antiparallel acceleration', () => {
    const state = getCircularMotionState(1.23, DEFAULT_CIRCULAR_MOTION_PARAMS);

    // Position vector relative to center: r
    // Dot product r · v should be 0
    const dotProduct = state.position.x * state.velocity.x + state.position.y * state.velocity.y;
    expect(dotProduct).toBeCloseTo(0, 5);

    // Acceleration a = -omega^2 * r
    const omega = DEFAULT_CIRCULAR_MOTION_PARAMS.angularVelocity;
    expect(state.acceleration.x).toBeCloseTo(-omega * omega * state.position.x, 5);
    expect(state.acceleration.y).toBeCloseTo(-omega * omega * state.position.y, 5);
  });

  it('steps motion correctly forward in time', () => {
    const state0 = getCircularMotionState(0, DEFAULT_CIRCULAR_MOTION_PARAMS);
    const dt = 0.5;
    const state1 = stepCircularMotion(state0, dt, DEFAULT_CIRCULAR_MOTION_PARAMS);

    expect(state1.time).toBeCloseTo(0.5, 5);
    const stateExpected = getCircularMotionState(0.5, DEFAULT_CIRCULAR_MOTION_PARAMS);
    expect(state1.position.x).toBeCloseTo(stateExpected.position.x, 5);
    expect(state1.position.y).toBeCloseTo(stateExpected.position.y, 5);
  });
});
