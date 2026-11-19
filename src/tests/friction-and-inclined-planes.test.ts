import { describe, it, expect } from 'vitest';
import { 
  calculateInclinedPlanePhysics, 
  getAnalyticalState, 
  DEFAULT_INCLINED_PLANE_PARAMS 
} from '../physics/mechanics/friction-and-inclined-planes';
import { g_EARTH } from '../physics/constants';

describe('Inclined Plane with Friction', () => {
  it('should remain stationary if static friction is enough', () => {
    // 10 degrees, muStatic = 0.5. tan(10°) ≈ 0.176 < 0.5, so it shouldn't slide.
    const params = {
      mass: 1.0,
      theta: 10 * Math.PI / 180,
      muStatic: 0.5,
      muKinetic: 0.3
    };
    const physics = calculateInclinedPlanePhysics(params, 0);
    expect(physics.isSliding).toBe(false);
    expect(physics.acceleration).toBe(0);
  });

  it('should slide if angle is steep enough', () => {
    // 45 degrees, muStatic = 0.5. tan(45°) = 1.0 > 0.5, so it should slide.
    const params = {
      mass: 1.0,
      theta: 45 * Math.PI / 180,
      muStatic: 0.5,
      muKinetic: 0.3
    };
    const physics = calculateInclinedPlanePhysics(params, 0);
    expect(physics.isSliding).toBe(true);
    
    // a = g * sin(45°) - muK * g * cos(45°)
    const expectedA = g_EARTH * Math.sin(params.theta) - params.muKinetic * g_EARTH * Math.cos(params.theta);
    expect(physics.acceleration).toBeCloseTo(expectedA);
  });

  it('should decelerate faster if moving upwards', () => {
    // 30 degrees, moving up (negative velocity)
    const params = {
      mass: 1.0,
      theta: 30 * Math.PI / 180,
      muStatic: 0.5,
      muKinetic: 0.3
    };
    // If v < 0, friction force is positive (down-slope)
    const physics = calculateInclinedPlanePhysics(params, -1.0);
    
    const expectedA = g_EARTH * Math.sin(params.theta) + params.muKinetic * g_EARTH * Math.cos(params.theta);
    expect(physics.acceleration).toBeCloseTo(expectedA);
  });

  it('should behave like free fall at 90 degrees', () => {
    const params = {
      mass: 1.0,
      theta: Math.PI / 2,
      muStatic: 0.5,
      muKinetic: 0.3
    };
    const physics = calculateInclinedPlanePhysics(params, 0);
    expect(physics.isSliding).toBe(true);
    // Fn = m*g*cos(90°) = 0, so Ff = 0. a = g * sin(90°) = g.
    expect(physics.acceleration).toBeCloseTo(g_EARTH);
  });

  it('should calculate correct analytical state starting from rest', () => {
    const params = DEFAULT_INCLINED_PLANE_PARAMS;
    const t = 2.0;
    const state = getAnalyticalState(t, params);
    
    const physics = calculateInclinedPlanePhysics(params, 0);
    const expectedV = physics.acceleration * t;
    const expectedX = 0.5 * physics.acceleration * t * t;
    
    expect(state.velocity).toBeCloseTo(expectedV);
    expect(state.displacement).toBeCloseTo(expectedX);
    expect(state.isSliding).toBe(physics.isSliding);
  });
});
