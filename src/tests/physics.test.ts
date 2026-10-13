import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PROJECTILE_PARAMS,
  getAnalyticalSolution,
  analyticalPosition,
  stepProjectile,
  createInitialState,
  simulateToLanding,
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
  DEFAULT_SERIES_PARALLEL_CIRCUIT,
} from '../physics/electricity/circuits';
import {
  waveSpeed,
  angularFrequency,
  period,
  getSHMState,
  getDampingRegime,
  springConstant,
} from '../physics/waves/waves';
import {
  calculateImage,
  generatePrincipalRays,
  imageX,
  DEFAULT_OPTICS_PARAMS,
  type OpticalElement,
} from '../physics/optics/optics';
import {
  DEFAULT_ORBITAL_PARAMS,
  createInitialOrbitalState,
  stepOrbital,
  getOrbitInfo,
  circularOrbitSpeed,
} from '../physics/mechanics/orbital';
import {
  transformToFrame,
  getPositionAtTime,
  DEFAULT_FRAME_PARAMS,
} from '../physics/mechanics/position-displacement';

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

    it('RK4 lands exactly where theory says, even from a height and with a coarse step', () => {
      const params = { ...DEFAULT_PROJECTILE_PARAMS, height: 25, angle: 30, velocity: 40 };
      const theory = getAnalyticalSolution(params);

      let state = createInitialState(params);
      while (!state.hasLanded) state = stepProjectile(state, params, 1 / 30);

      expect(state.position.y).toBe(0);
      expect(state.time).toBeCloseTo(theory.flightTime, 6);
      expect(state.position.x).toBeCloseTo(theory.range, 6);
      // Impact speed from energy conservation: v² = v0² + 2·g·h0
      const impact = Math.hypot(state.velocity.x, state.velocity.y);
      expect(impact).toBeCloseTo(Math.sqrt(40 * 40 + 2 * 9.81 * 25), 6);
    });

    it('quadratic drag shortens range and apex, and reduces impact speed', () => {
      const ideal = simulateToLanding({ ...DEFAULT_PROJECTILE_PARAMS, dragEnabled: false });
      const drag = simulateToLanding({
        ...DEFAULT_PROJECTILE_PARAMS,
        dragEnabled: true,
        dragCoefficient: 0.02,
      });

      expect(drag.range).toBeLessThan(ideal.range * 0.9);
      expect(drag.maxHeight).toBeLessThan(ideal.maxHeight);
      expect(drag.impactSpeed).toBeLessThan(ideal.impactSpeed);
      // Drag is dissipative and the descent is steeper than the climb.
      expect(drag.flightTime).toBeGreaterThan(0);
    });

    it('a shot straight along flat ground lands immediately instead of tunnelling', () => {
      const params = { ...DEFAULT_PROJECTILE_PARAMS, angle: 0, height: 0 };
      const state = stepProjectile(createInitialState(params), params, 0.01);
      expect(state.hasLanded).toBe(true);
      expect(state.position.y).toBe(0);
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

    it('accelerates with a = (F − μk·N)/m and x = ½at² (exact kinematics)', () => {
      const params = {
        ...DEFAULT_FORCES_PARAMS,
        mass: 10,
        gravity: 10,
        appliedForce: 60,
        frictionCoeffKinetic: 0.3,
        frictionCoeffStatic: 0.5,
      };
      // a = (60 − 30) / 10 = 3 m/s²
      let state = createInitialForcesState(params);
      const dt = 1 / 120;
      for (let i = 0; i < 240; i++) state = stepForces(state, params, dt); // t = 2 s

      expect(state.velocity).toBeCloseTo(6, 6);
      expect(state.position).toBeCloseTo(0.5 * 3 * 2 * 2, 6);
    });

    it('a sliding block stops after v²/(2μg) and stays stopped', () => {
      const params = {
        ...DEFAULT_FORCES_PARAMS,
        appliedForce: 0,
        initialVelocity: 10,
        frictionCoeffKinetic: 0.3,
        frictionCoeffStatic: 0.4,
      };
      let state = createInitialForcesState(params);
      for (let i = 0; i < 120 * 6; i++) state = stepForces(state, params, 1 / 120);

      expect(state.velocity).toBe(0);
      expect(state.position).toBeCloseTo(100 / (2 * 0.3 * 9.81), 6);
    });

    it('a lifting applied angle reduces the normal force: N = mg − F·sinθ', () => {
      const params = { ...DEFAULT_FORCES_PARAMS, mass: 10, gravity: 10, appliedForce: 40, appliedAngle: 30 };
      expect(calculateForces(params, 0).normal).toBeCloseTo(100 - 20, 6);
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

    it('parallel branches share the voltage and their currents add up (KCL)', () => {
      const res = analyzeCircuit(DEFAULT_PARALLEL_CIRCUIT);
      res.resistors.forEach((r) => expect(r.voltageDrop).toBeCloseTo(12, 6));
      const branchSum = res.resistors.reduce((s, r) => s + r.current, 0);
      expect(branchSum).toBeCloseTo(res.totalCurrent, 9);
    });

    it('series-parallel: R1 + (R2‖R3) with Kirchhoff voltage/current/power balance', () => {
      const cfg = DEFAULT_SERIES_PARALLEL_CIRCUIT; // 24 V, r_int 0.5, R1=100, R2=R3=200
      const res = analyzeCircuit(cfg);
      const [r1, r2, r3] = res.resistors;

      expect(res.totalResistance).toBeCloseTo(100 + 100, 9); // external only
      expect(res.totalCurrent).toBeCloseTo(24 / 200.5, 9);
      // KCL at the junction
      expect(r2.current + r3.current).toBeCloseTo(r1.current, 9);
      // KVL around the loop: V = I·r_int + V_R1 + V_(R2‖R3)
      expect(res.totalCurrent * 0.5 + r1.voltageDrop + r2.voltageDrop).toBeCloseTo(24, 9);
      expect(r2.voltageDrop).toBeCloseTo(r3.voltageDrop, 9);
      // Power: source = resistors + internal loss
      const dissipated = res.resistors.reduce((s, r) => s + r.power, 0) + res.internalPower;
      expect(dissipated).toBeCloseTo(res.totalPower, 9);
    });

    it('analysing a circuit does not mutate the config it was given', () => {
      const before = JSON.stringify(DEFAULT_SERIES_PARALLEL_CIRCUIT);
      analyzeCircuit({
        ...DEFAULT_SERIES_PARALLEL_CIRCUIT,
        parallelGroups: [['R3', 'R2']],
      });
      analyzeCircuit(DEFAULT_SERIES_PARALLEL_CIRCUIT);
      expect(JSON.stringify(DEFAULT_SERIES_PARALLEL_CIRCUIT)).toBe(before);
    });

    it('an open switch stops all current', () => {
      const res = analyzeCircuit({ ...DEFAULT_SERIES_CIRCUIT, switches: [{ id: 'S1', closed: false }] });
      expect(res.totalCurrent).toBe(0);
      expect(res.isCircuitComplete).toBe(false);
    });
  });

  describe('Module 4: Waves & Oscillations', () => {
    it('satisfies v = f * lambda wave velocity relationship', () => {
      expect(waveSpeed(5, 2)).toBe(10);
      expect(angularFrequency(2)).toBeCloseTo(4 * Math.PI, 4);
      expect(period(4)).toBe(0.25);
    });

    const regimes = [
      { name: 'undamped', damping: 0 },
      { name: 'underdamped', damping: 1 },
      { name: 'critical', damping: 2 * 1 * (2 * Math.PI * 1) }, // c = 2·m·ω₀
      { name: 'overdamped', damping: 40 },
    ] as const;

    regimes.forEach(({ name, damping }) => {
      const params = { amplitude: 1.5, frequency: 1, mass: 1, damping };

      it(`${name} oscillator is released from rest at x = A`, () => {
        expect(getDampingRegime(params)).toBe(name);
        const s0 = getSHMState(params, 0);
        expect(s0.displacement).toBeCloseTo(1.5, 9);
        expect(s0.velocity).toBeCloseTo(0, 9);
      });

      it(`${name} oscillator obeys m·x'' + c·x' + k·x = 0`, () => {
        const k = springConstant(params.mass, params.frequency);
        const h = 1e-5;
        [0.2, 0.7, 1.3, 2.9].forEach((t) => {
          const s = getSHMState(params, t);
          // velocity must be the derivative of displacement
          const numericV =
            (getSHMState(params, t + h).displacement - getSHMState(params, t - h).displacement) /
            (2 * h);
          expect(s.velocity).toBeCloseTo(numericV, 5);
          // reported acceleration must satisfy the equation of motion
          const residual = params.mass * s.acceleration + damping * s.velocity + k * s.displacement;
          expect(Math.abs(residual)).toBeLessThan(1e-9);
        });
      });
    });

    it('undamped energy is constant ½kA²; damped energy only ever decreases', () => {
      const k = springConstant(1, 1);
      const free = { amplitude: 1, frequency: 1, mass: 1, damping: 0 };
      [0, 0.3, 1.1, 2.4].forEach((t) =>
        expect(getSHMState(free, t).totalEnergy).toBeCloseTo(0.5 * k, 9)
      );

      const damped = { ...free, damping: 1 };
      let last = Infinity;
      for (let t = 0; t < 6; t += 0.05) {
        const e = getSHMState(damped, t).totalEnergy;
        expect(e).toBeLessThanOrEqual(last + 1e-12);
        last = e;
      }
    });
  });

  describe('Module 5: Geometric Optics', () => {
    it('verifies thin lens equation for 2F position', () => {
      // Object at 2F (u = 30, f = 15) -> image at 2F (v = 30), |m| = 1, real & inverted
      const opt = calculateImage({
        element: 'converging-lens',
        focalLength: 15,
        objectDistance: 30,
        objectHeight: 5,
      });

      expect(opt.imageDistance).toBeCloseTo(30, 2);
      expect(opt.magnification).toBeCloseTo(-1, 2);
      expect(opt.imageHeight).toBeCloseTo(-5, 2);
      expect(opt.isReal).toBe(true);
      expect(opt.isInverted).toBe(true);
      expect(opt.isEnlarged).toBe(false);
      expect(opt.nature).toBe('Real, Inverted, Same size');
    });

    it('converging lens: object inside F gives an erect, enlarged, virtual image', () => {
      const opt = calculateImage({ ...DEFAULT_OPTICS_PARAMS, objectDistance: 10 });
      expect(opt.imageDistance).toBeCloseTo(-30, 6);
      expect(opt.magnification).toBeCloseTo(3, 6);
      expect(opt.nature).toBe('Virtual, Erect, Enlarged');
    });

    it('diverging lens always gives a virtual, erect, diminished image', () => {
      const opt = calculateImage({ ...DEFAULT_OPTICS_PARAMS, element: 'diverging-lens' });
      expect(opt.imageDistance).toBeCloseTo(-10, 6);
      expect(opt.magnification).toBeCloseTo(1 / 3, 6);
      expect(opt.nature).toBe('Virtual, Erect, Diminished');
    });

    it('concave mirror: real inverted at 2F, virtual enlarged inside F', () => {
      const at2F = calculateImage({ ...DEFAULT_OPTICS_PARAMS, element: 'concave-mirror' });
      expect(at2F.imageDistance).toBeCloseTo(30, 6);
      expect(at2F.isReal && at2F.isInverted).toBe(true);

      const inside = calculateImage({
        ...DEFAULT_OPTICS_PARAMS,
        element: 'concave-mirror',
        objectDistance: 10,
      });
      expect(inside.nature).toBe('Virtual, Erect, Enlarged');
    });

    it('convex mirror always gives a virtual, erect, diminished image', () => {
      const opt = calculateImage({ ...DEFAULT_OPTICS_PARAMS, element: 'convex-mirror' });
      expect(opt.imageDistance).toBeCloseTo(-10, 6);
      expect(opt.nature).toBe('Virtual, Erect, Diminished');
    });

    it('object exactly at the focal point sends the image to infinity', () => {
      const opt = calculateImage({ ...DEFAULT_OPTICS_PARAMS, objectDistance: 15 });
      expect(opt.imageDistance).toBe(Infinity);
      expect(generatePrincipalRays({ ...DEFAULT_OPTICS_PARAMS, objectDistance: 15 }, opt)).toEqual([]);
    });

    const elements: OpticalElement[] = [
      'converging-lens',
      'diverging-lens',
      'concave-mirror',
      'convex-mirror',
    ];
    elements.forEach((element) => {
      it(`${element}: every principal ray passes through the image tip`, () => {
        [8, 14, 22, 30, 45].forEach((objectDistance) => {
          const params = { element, focalLength: 15, objectDistance, objectHeight: 5 };
          const result = calculateImage(params);
          const rays = generatePrincipalRays(params, result);
          expect(rays).toHaveLength(3);

          const tip = { x: imageX(element, result.imageDistance), y: result.imageHeight };
          rays.forEach((ray) => {
            // The ray leaves the element at points[1] heading toward points[2].
            // Real image: the tip lies on that solid segment.
            // Virtual image: it lies on the dashed back-extension of it.
            const [hit, far] = [ray.points[1], ray.points[2]];
            const dx = far.x - hit.x;
            const dy = far.y - hit.y;
            const cross = (tip.x - hit.x) * dy - (tip.y - hit.y) * dx;
            expect(Math.abs(cross) / Math.hypot(dx, dy)).toBeLessThan(1e-6);
            expect(ray.virtualExtension !== undefined).toBe(!result.isReal);
          });
        });
      });
    });

    it('the three principal rays hit the element at different heights (parallel ≠ focal ray)', () => {
      const params = DEFAULT_OPTICS_PARAMS; // converging lens, u = 30, f = 15
      const rays = generatePrincipalRays(params, calculateImage(params));
      const hitHeights = rays.map((r) => r.points[1].y);
      expect(hitHeights[0]).toBeCloseTo(5, 9); // parallel ray at object height
      expect(hitHeights[1]).toBeCloseTo(0, 9); // central ray through the centre
      expect(hitHeights[2]).toBeCloseTo(-5, 9); // focal ray crosses below the axis
    });
  });

  describe('Module 6: Orbital Mechanics', () => {
    const run = (params = DEFAULT_ORBITAL_PARAMS, seconds = 1, dt = 1 / 120) => {
      let state = createInitialOrbitalState(params);
      const initial = state;
      const steps = Math.round(seconds / dt);
      for (let i = 0; i < steps; i++) state = stepOrbital(state, params, dt);
      return { initial, state };
    };

    it('default setup is a bound, elliptical orbit that does not hit the star', () => {
      const info = getOrbitInfo(DEFAULT_ORBITAL_PARAMS);
      expect(info.bound).toBe(true);
      expect(info.eccentricity).toBeGreaterThan(0.1);
      expect(info.eccentricity).toBeLessThan(0.9);
      expect(info.periapsis).toBeGreaterThan(
        DEFAULT_ORBITAL_PARAMS.body1Radius + DEFAULT_ORBITAL_PARAMS.body2Radius
      );
    });

    it('starts in the centre-of-mass frame (zero total momentum, COM at origin)', () => {
      const params = { ...DEFAULT_ORBITAL_PARAMS, body1Mass: 5e15, body2Mass: 2e15 };
      const s = createInitialOrbitalState(params);
      const px = s.body1.mass * s.body1.velocity.x + s.body2.mass * s.body2.velocity.x;
      const py = s.body1.mass * s.body1.velocity.y + s.body2.mass * s.body2.velocity.y;
      const cx = s.body1.mass * s.body1.position.x + s.body2.mass * s.body2.position.x;
      expect(Math.abs(px)).toBeLessThan(1);
      expect(Math.abs(py)).toBeLessThan(1e3);
      expect(Math.abs(cx)).toBeLessThan(1e3);
      expect(s.separation).toBeCloseTo(params.initialSeparation, 9);
    });

    it('circular-orbit speed keeps the separation constant', () => {
      const p = DEFAULT_ORBITAL_PARAMS;
      const vCirc = circularOrbitSpeed(p.body1Mass, p.initialSeparation, p.gravitationalConstant);
      const params = { ...p, body2Speed: vCirc };
      const T = getOrbitInfo(params).period;

      let state = createInitialOrbitalState(params);
      let minSep = Infinity;
      let maxSep = 0;
      for (let i = 0; i < Math.round(T * 120); i++) {
        state = stepOrbital(state, params, 1 / 120);
        minSep = Math.min(minSep, state.separation);
        maxSep = Math.max(maxSep, state.separation);
      }
      expect(maxSep / minSep).toBeLessThan(1.001);
    });

    it('conserves energy and angular momentum over a full eccentric orbit', () => {
      const info = getOrbitInfo(DEFAULT_ORBITAL_PARAMS);
      const { initial, state } = run(DEFAULT_ORBITAL_PARAMS, info.period, 1 / 240);
      expect(Math.abs(state.totalEnergy / initial.totalEnergy - 1)).toBeLessThan(2e-3);
      expect(Math.abs(state.angularMomentum / initial.angularMomentum - 1)).toBeLessThan(1e-9);
    });

    it('after one Kepler period the body is back where it started', () => {
      const info = getOrbitInfo(DEFAULT_ORBITAL_PARAMS);
      const { initial, state } = run(DEFAULT_ORBITAL_PARAMS, info.period, 1 / 480);
      const miss = Math.hypot(
        state.body2.position.x - initial.body2.position.x,
        state.body2.position.y - initial.body2.position.y
      );
      expect(miss / DEFAULT_ORBITAL_PARAMS.initialSeparation).toBeLessThan(0.01);
    });

    it('simulated closest approach matches the analytical periapsis', () => {
      const info = getOrbitInfo(DEFAULT_ORBITAL_PARAMS);
      let state = createInitialOrbitalState(DEFAULT_ORBITAL_PARAMS);
      let minSep = Infinity;
      for (let i = 0; i < Math.round(info.period * 480); i++) {
        state = stepOrbital(state, DEFAULT_ORBITAL_PARAMS, 1 / 480);
        minSep = Math.min(minSep, state.separation);
      }
      expect(minSep).toBeCloseTo(info.periapsis, 0);
    });

    it('a fast launch is unbound (E > 0) and flies away', () => {
      const params = { ...DEFAULT_ORBITAL_PARAMS, body2Speed: 90 };
      expect(getOrbitInfo(params).bound).toBe(false);
      expect(run(params, 5).initial.totalEnergy).toBeGreaterThan(0);
    });
  });

  describe('Module 7: Position, Displacement & Reference Frames', () => {
    it('correctly calculates vector displacement independently of coordinate origin', () => {
      const r_i = { x: 2, y: 3 };
      const r_f = { x: 5, y: 7 };
      const shift = { x: 10, y: 10 };
      const r_i_shifted = { x: r_i.x + shift.x, y: r_i.y + shift.y };
      const r_f_shifted = { x: r_f.x + shift.x, y: r_f.y + shift.y };

      const delta1 = { x: r_f.x - r_i.x, y: r_f.y - r_i.y };
      const delta2 = { x: r_f_shifted.x - r_i_shifted.x, y: r_f_shifted.y - r_i_shifted.y };

      expect(delta2.x).toBe(delta1.x);
      expect(delta2.y).toBe(delta1.y);
      expect(delta1.x).toBe(3);
      expect(delta1.y).toBe(4);
    });

    it('transforms coordinates correctly under frame translation and rotation', () => {
      const frame = { originB: { x: 2, y: 2 }, rotationB: 0 };
      const currentA = { x: 5, y: 6 };
      const initialA = { x: 2, y: 2 };

      const res = transformToFrame(currentA, initialA, frame);
      expect(res.positionInB.x).toBe(3);
      expect(res.positionInB.y).toBe(4);
      expect(res.displacementInA.x).toBe(3);
      expect(res.displacementInA.y).toBe(4);
      expect(res.displacementInB.x).toBe(3);
      expect(res.displacementInB.y).toBe(4);
    });

    it('generates expected trajectory coordinates at time t', () => {
      const posCircle = getPositionAtTime(0, 'circle');
      expect(posCircle.x).toBe(4);
      expect(posCircle.y).toBe(0);

      const posLinear = getPositionAtTime(2, 'linear');
      expect(posLinear.x).toBe(-3);
      expect(posLinear.y).toBe(-1);
    });
  });
});
