import { describe, it, expect } from 'vitest';
import {
  calculateRelativeMotion,
  stepRelativeMotion,
  DEFAULT_RELATIVE_MOTION_PARAMS,
  RelativeMotionParams,
} from '../physics/mechanics/relative-motion';

describe('Relative Motion', () => {
  it('calculates 1D relative velocity for objects moving in opposite directions', () => {
    const params: RelativeMotionParams = {
      objectA: { position: { x: 0, y: 0 }, velocity: { x: 15, y: 0 } },
      objectB: { position: { x: 100, y: 0 }, velocity: { x: -10, y: 0 } },
    };

    const res = calculateRelativeMotion(params);

    expect(res.relativePosition).toEqual({ x: -100, y: 0 });
    expect(res.relativeVelocity).toEqual({ x: 25, y: 0 });
    expect(res.relativeDistance).toBeCloseTo(100);
    expect(res.relativeSpeed).toBeCloseTo(25);
    // Time to collision (closest approach = 0 distance) is 100 / 25 = 4 seconds
    expect(res.closestApproachTime).toBeCloseTo(4);
    expect(res.minDistance).toBeCloseTo(0);
  });

  it('calculates 2D perpendicular relative velocity', () => {
    const params: RelativeMotionParams = {
      objectA: { position: { x: 0, y: 0 }, velocity: { x: 3, y: 0 } },
      objectB: { position: { x: 0, y: 0 }, velocity: { x: 0, y: 4 } },
    };

    const res = calculateRelativeMotion(params);

    expect(res.relativeVelocity).toEqual({ x: 3, y: -4 });
    expect(res.relativeSpeed).toBeCloseTo(5); // 3-4-5 triangle
  });

  it('calculates closest approach correctly for offset trajectories', () => {
    const params: RelativeMotionParams = {
      objectA: { position: { x: 0, y: 0 }, velocity: { x: 10, y: 0 } },
      objectB: { position: { x: 10, y: 10 }, velocity: { x: 0, y: 0 } },
    };

    const res = calculateRelativeMotion(params);

    // r_rel = (-10, -10), v_rel = (10, 0)
    // t_min = -(-10 * 10) / 100 = 1s
    expect(res.closestApproachTime).toBeCloseTo(1);
    expect(res.minDistance).toBeCloseTo(10);
  });

  it('handles identical velocities (zero relative velocity)', () => {
    const params: RelativeMotionParams = {
      objectA: { position: { x: 0, y: 0 }, velocity: { x: 20, y: -5 } },
      objectB: { position: { x: 50, y: 50 }, velocity: { x: 20, y: -5 } },
    };

    const res = calculateRelativeMotion(params);

    expect(res.relativeVelocity).toEqual({ x: 0, y: 0 });
    expect(res.relativeSpeed).toBeCloseTo(0);
    expect(res.closestApproachTime).toBeCloseTo(0);
    expect(res.minDistance).toBeCloseTo(Math.hypot(50, 50));
  });

  it('steps motion forward accurately with stepRelativeMotion', () => {
    const params = DEFAULT_RELATIVE_MOTION_PARAMS;
    const dt = 2; // 2 seconds

    const stepped = stepRelativeMotion(params, dt);

    // Object A starts at (0,0) with (10,0) -> at t=2: pos is (20,0)
    expect(stepped.objectA.position.x).toBeCloseTo(20);
    expect(stepped.objectA.position.y).toBeCloseTo(0);

    // Object B starts at (0,10) with (0,-5) -> at t=2: pos is (0,0)
    expect(stepped.objectB.position.x).toBeCloseTo(0);
    expect(stepped.objectB.position.y).toBeCloseTo(0);

    // Relative position at t=2: (20, 0) - (0, 0) = (20, 0)
    expect(stepped.relativeResult.relativePosition.x).toBeCloseTo(20);
    expect(stepped.relativeResult.relativePosition.y).toBeCloseTo(0);
  });
});
