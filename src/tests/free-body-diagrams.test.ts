import { describe, it, expect } from 'vitest';
import { calculateFBDState, stepFBDMotion, FBDParams, DEFAULT_FBD_PARAMS } from '../physics/mechanics/free-body-diagrams';

describe('Free-Body Diagrams (FBD) Physics Module', () => {
  it('calculates zero net force in equilibrium on horizontal plane with no applied force', () => {
    const params: FBDParams = {
      mass: 10,
      gravity: 9.81,
      inclineAngle: 0,
      appliedForce: 0,
      appliedAngle: 0,
      muS: 0.5,
      muK: 0.3,
    };

    const state = calculateFBDState(params);

    expect(state.normalForce).toBeCloseTo(98.1, 4);
    expect(state.frictionForce).toBeCloseTo(0, 4);
    expect(state.netForce.x).toBeCloseTo(0, 4);
    expect(state.netForce.y).toBeCloseTo(0, 4);
    expect(state.accelerationMagnitude).toBeCloseTo(0, 4);
    expect(state.isEquilibrium).toBe(true);
  });

  it('holds block in static equilibrium on an incline when static friction is sufficient', () => {
    const params: FBDParams = {
      mass: 10,
      gravity: 10,
      inclineAngle: Math.PI / 6, // 30 degrees
      appliedForce: 0,
      appliedAngle: 0,
      muS: 0.6, // max static friction = 0.6 * 100 * cos(30) ≈ 51.96 N > 50 N gravity parallel
      muK: 0.4,
    };

    const state = calculateFBDState(params);

    const normalTheoretical = 100 * Math.cos(Math.PI / 6); // 86.6025
    expect(state.normalForce).toBeCloseTo(normalTheoretical, 4);
    expect(state.frictionForce).toBeCloseTo(50, 4); // Static friction balances gravity component (50 N)
    expect(state.netForce.x).toBeCloseTo(0, 4);
    expect(state.netForce.y).toBeCloseTo(0, 4);
    expect(state.isEquilibrium).toBe(true);
  });

  it('accelerates down incline when static friction threshold is exceeded', () => {
    const params: FBDParams = {
      mass: 10,
      gravity: 10,
      inclineAngle: Math.PI / 6, // 30 degrees
      appliedForce: 0,
      appliedAngle: 0,
      muS: 0.4, // max static friction = 0.4 * 86.6025 ≈ 34.64 N < 50 N gravity parallel
      muK: 0.3, // kinetic friction = 0.3 * 86.6025 ≈ 25.98 N
    };

    const state = calculateFBDState(params, 0);

    const kineticFriction = 0.3 * 100 * Math.cos(Math.PI / 6); // 25.98076
    const expectedNetFx = -50 + kineticFriction; // -24.01924
    const expectedAccelX = expectedNetFx / 10; // -2.401924

    expect(state.frictionForce).toBeCloseTo(kineticFriction, 4);
    expect(state.netForce.x).toBeCloseTo(expectedNetFx, 4);
    expect(state.acceleration.x).toBeCloseTo(expectedAccelX, 4);
    expect(state.isEquilibrium).toBe(false);
  });

  it('calculates forces with an angled applied force lifting off surface', () => {
    const params: FBDParams = {
      mass: 5,
      gravity: 9.81,
      inclineAngle: 0,
      appliedForce: 50,
      appliedAngle: Math.PI / 6, // 30 degrees lifting force
      muS: 0.3,
      muK: 0.2,
    };

    const state = calculateFBDState(params, 2.0); // Moving forward at 2 m/s

    const fAppliedY = 50 * Math.sin(Math.PI / 6); // 25 N
    const fGravityY = -5 * 9.81; // -49.05 N
    const normalTheoretical = 49.05 - 25; // 24.05 N
    const fKineticFriction = 0.2 * 24.05; // 4.81 N
    const fAppliedX = 50 * Math.cos(Math.PI / 6); // 43.30127 N
    const expectedNetX = fAppliedX - fKineticFriction; // 38.49127 N

    expect(state.normalForce).toBeCloseTo(normalTheoretical, 4);
    expect(state.frictionForce).toBeCloseTo(fKineticFriction, 4);
    expect(state.netForce.x).toBeCloseTo(expectedNetX, 4);
    expect(state.acceleration.x).toBeCloseTo(expectedNetX / 5, 4);
  });

  it('throws an error if mass is non-positive', () => {
    const params: FBDParams = {
      ...DEFAULT_FBD_PARAMS,
      mass: 0,
    };
    expect(() => calculateFBDState(params)).toThrow('Mass must be greater than zero.');
  });

  it('steps FBD motion forward correctly using stepFBDMotion', () => {
    const params: FBDParams = {
      mass: 2,
      gravity: 10,
      inclineAngle: 0,
      appliedForce: 20,
      appliedAngle: 0,
      muS: 0.1,
      muK: 0.1,
    };

    // fAppliedX = 20, friction = 0.1 * 20 = 2 N -> Net force = 18 N -> accel = 9 m/s^2
    const result = stepFBDMotion(0, 0, params, 0.5); // dt = 0.5 s

    expect(result.state.acceleration.x).toBeCloseTo(9, 4);
    expect(result.velocity).toBeCloseTo(4.5, 4);
    expect(result.position).toBeCloseTo(1.125, 4);
  });
});
