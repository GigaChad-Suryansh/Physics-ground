import { describe, it, expect } from 'vitest';
import {
  calculateReactionForce,
  calculateContactSystem1D,
  calculateRecoilVelocities,
  stepThirdLawSystem,
  DEFAULT_NEWTON_THIRD_LAW_PARAMS,
  NewtonThirdLawState,
} from '../physics/mechanics/newton-s-third-law';

describe("Newton's Third Law Physics", () => {
  it('calculates equal and opposite reaction force', () => {
    const action = { x: 15, y: -7.5 };
    const reaction = calculateReactionForce(action);

    expect(reaction.x).toBeCloseTo(-15);
    expect(reaction.y).toBeCloseTo(7.5);
  });

  it('calculates 1D contact forces and common acceleration correctly', () => {
    // Mass 1 = 4 kg, Mass 2 = 6 kg, External force = 20 N
    const { acceleration, force12, force21 } = calculateContactSystem1D(4, 6, 20);

    expect(acceleration).toBeCloseTo(2.0); // 20 / (4 + 6)
    expect(force12).toBeCloseTo(12.0); // 6 * 2
    expect(force21).toBeCloseTo(-12.0); // Equal and opposite force on mass 1
  });

  it('calculates recoil velocities and conserves momentum', () => {
    const m1 = 2;
    const m2 = 5;
    const impulse = 10;
    const { v1, v2 } = calculateRecoilVelocities(m1, m2, impulse);

    expect(v1).toBeCloseTo(-5.0); // -10 / 2
    expect(v2).toBeCloseTo(2.0); // 10 / 5

    const totalMomentum = m1 * v1 + m2 * v2;
    expect(totalMomentum).toBeCloseTo(0);
  });

  it('maintains action-reaction pair equality in simulation state steps', () => {
    const initialState: NewtonThirdLawState = {
      position1: { x: 0, y: 0 },
      velocity1: { x: 0, y: 0 },
      position2: { x: 4, y: 0 },
      velocity2: { x: 0, y: 0 },
      force12: { x: 0, y: 0 },
      force21: { x: 0, y: 0 },
      time: 0,
    };

    const params = {
      ...DEFAULT_NEWTON_THIRD_LAW_PARAMS,
      interactionForceMagnitude: 12,
    };

    const nextState = stepThirdLawSystem(initialState, params, 0.5);

    expect(nextState.force12.x).toBeCloseTo(12);
    expect(nextState.force21.x).toBeCloseTo(-12);
    expect(nextState.force12.x + nextState.force21.x).toBeCloseTo(0);
    expect(nextState.force12.y + nextState.force21.y).toBeCloseTo(0);
  });

  it('updates position and velocity correctly for coupled motion step', () => {
    const initialState: NewtonThirdLawState = {
      position1: { x: 0, y: 0 },
      velocity1: { x: 0, y: 0 },
      position2: { x: 2, y: 0 },
      velocity2: { x: 0, y: 0 },
      force12: { x: 0, y: 0 },
      force21: { x: 0, y: 0 },
      time: 0,
    };

    const params = {
      m1: 2,
      m2: 4,
      externalForce1: { x: 10, y: 0 },
      externalForce2: { x: 0, y: 0 },
      interactionForceMagnitude: 0,
    };

    // F_net1 = 10 N -> a1 = 5 m/s^2
    // F_net2 = 0 N -> a2 = 0 m/s^2
    const dt = 1.0;
    const nextState = stepThirdLawSystem(initialState, params, dt);

    expect(nextState.velocity1.x).toBeCloseTo(5.0);
    expect(nextState.position1.x).toBeCloseTo(5.0);
    expect(nextState.velocity2.x).toBeCloseTo(0.0);
    expect(nextState.position2.x).toBeCloseTo(2.0);
    expect(nextState.time).toBeCloseTo(1.0);
  });
});
