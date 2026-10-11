import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PROJECTILE_PARAMS,
  getAnalyticalSolution,
  analyticalPosition,
  stepProjectile,
  createInitialState,
} from '../physics/mechanics/projectile';
import {
  DEFAULT_FORCES_PARAMS,
  calculateForces,
  stepForces,
  createInitialForcesState,
} from '../physics/mechanics/forces';
import {
  seriesResistance,
  parallelResistance,
  analyzeCircuit,
  DEFAULT_SERIES_CIRCUIT,
  DEFAULT_PARALLEL_CIRCUIT,
} from '../physics/electricity/circuits';
import {
  waveSpeed,
  angularFrequency,
  period,
} from '../physics/waves/waves';
import {
  calculateImage,
  DEFAULT_OPTICS_PARAMS,
} from '../physics/optics/optics';

describe('Physics Calculation Verification', () => {
  describe('Module 1: Projectile Motion', () => {
    it('accurately computes analytical max height, flight time, and range (no drag)', () => {
      const params = {
        velocity: 20,
        angle: 45,
        gravity: 9.8,
        height: 0,
        dragEnabled: false,
        dragCoefficient: 0,
        mass: 1,
      };

      const sol = getAnalyticalSolution(params);
      // v0y = 20 * sin(45) = 14.142 m/s
      // t_apex = 14.142 / 9.8 = 1.443 s
      // flightTime = 2 * t_apex = 2.886 s
      // max_height = v0y^2 / (2g) = 200 / 19.6 = 10.204 m
      // range = v0x * t_f = 14.142 * 2.886 = 40.816 m

      expect(sol.maxHeight).toBeCloseTo(10.204, 2);
      expect(sol.flightTime).toBeCloseTo(2.886, 2);
      expect(sol.range).toBeCloseTo(40.816, 2);
    });

    it('numerical integrator matches analytical trajectory within small tolerance', () => {
      const params = { ...DEFAULT_PROJECTILE_PARAMS, dragEnabled: false };
      let state = createInitialState(params);
      const dt = 0.01;

      for (let i = 0; i < 50; i++) {
        state = stepProjectile(state, params, dt);
      }

      const analyticalPos = analyticalPosition(params, state.time);
      expect(state.position.x).toBeCloseTo(analyticalPos.x, 1);
      expect(state.position.y).toBeCloseTo(analyticalPos.y, 1);
    });
  });

  describe("Module 2: Newton's Laws & Friction", () => {
    it('correctly satisfies F_net = m * a and distinguishes static friction', () => {
      // Applied force less than max static friction
      const staticParams = {
        ...DEFAULT_FORCES_PARAMS,
        mass: 10,
        gravity: 10,
        frictionCoeffStatic: 0.5,
        appliedForce: 30, // Max static is 0.5 * 100 = 50 N
        appliedAngle: 0,
      };

      const fStatic = calculateForces(staticParams, 0);
      expect(fStatic.frictionType).toBe('static');
      expect(fStatic.net.x).toBe(0);

      // Applied force exceeding static friction
      const kineticParams = {
        ...staticParams,
        appliedForce: 60,
        frictionCoeffKinetic: 0.3,
      };

      const fKinetic = calculateForces(kineticParams, 0);
      expect(fKinetic.frictionType).toBe('kinetic');
      // Kinetic friction = 0.3 * 100 = 30 N. F_net = 60 - 30 = 30 N
      expect(fKinetic.net.x).toBeCloseTo(30, 2);
    });
  });

  describe('Module 3: Resistor Networks (Circuits)', () => {
    it('computes correct series equivalent resistance', () => {
      expect(seriesResistance([10, 20, 30])).toBe(60);
    });

    it('computes correct parallel equivalent resistance', () => {
      // 1 / (1/100 + 1/100) = 50
      expect(parallelResistance([100, 100])).toBeCloseTo(50, 4);
      // 1 / (1/20 + 1/30 + 1/60) = 1 / (3/60 + 2/60 + 1/60) = 10
      expect(parallelResistance([20, 30, 60])).toBeCloseTo(10, 4);
    });

    it('validates Ohm’s law in series circuit', () => {
      const res = analyzeCircuit(DEFAULT_SERIES_CIRCUIT);
      expect(res.totalResistance).toBe(600); // 100 + 200 + 300
      expect(res.totalCurrent).toBeCloseTo(12 / 600, 4); // 0.02 A
    });
  });

  describe('Module 4: Waves & Oscillations', () => {
    it('satisfies v = f * lambda wave velocity relationship', () => {
      expect(waveSpeed(5, 2)).toBe(10);
      expect(angularFrequency(2)).toBeCloseTo(4 * Math.PI, 4);
      expect(period(4)).toBe(0.25);
    });
  });

  describe('Module 5: Geometric Optics', () => {
    it('verifies thin lens equation for 2F position', () => {
      // Object at 2F (u = 30, f = 15) -> image at 2F (v = 30), magnification = 1, real & inverted
      const opt = calculateImage({
        element: 'converging-lens',
        focalLength: 15,
        objectDistance: 30,
        objectHeight: 5,
      });

      expect(opt.imageDistance).toBeCloseTo(30, 2);
      expect(opt.magnification).toBeCloseTo(1, 2);
      expect(opt.isReal).toBe(true);
      expect(opt.isEnlarged).toBe(false);
    });
  });
});
