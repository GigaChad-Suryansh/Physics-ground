/**
 * Acceleration Physics Model
 *
 * Concepts:
 * 1. Instantaneous Acceleration (a): Rate of change of velocity with respect to time.
 *    a = dv/dt = d^2r/dt^2 = (dx^2/dt^2, dy^2/dt^2)
 *
 * 2. Uniformly Accelerated Linear Motion:
 *    v(t) = v_0 + at
 *    x(t) = x_0 + v_0 t + 0.5 at^2
 *
 * 3. Free Fall (Constant gravity g):
 *    y(t) = y_0 + v_0 t - 0.5 gt^2
 *    v_y(t) = v_0 - gt
 *
 * 4. Centripetal Acceleration (Uniform Circular Motion):
 *    a_c = v^2 / R = omega^2 R (directed toward center)
 */

import { Vec2, magnitude } from '../vector';

export type AccelerationMode = 'linear' | 'freefall' | 'circular';

export interface AccelerationParams {
  mode: AccelerationMode;
  initialVelocity: number;
  acceleration: number;
  gravity: number;
  amplitude: number;
  frequency: number;
}

export const DEFAULT_ACCELERATION_PARAMS: AccelerationParams = {
  mode: 'linear',
  initialVelocity: 1,
  acceleration: 2,
  gravity: 9.81,
  amplitude: 3,
  frequency: 0.2,
};

export interface AccelerationState {
  position: Vec2;
  velocity: Vec2;
  acceleration: Vec2;
  speed: number;
}

export function getAccelerationState(t: number, params: AccelerationParams): AccelerationState {
  const { mode, initialVelocity, acceleration, gravity, amplitude, frequency } = params;
  let position: Vec2 = { x: 0, y: 0 };
  let velocity: Vec2 = { x: 0, y: 0 };
  let accel: Vec2 = { x: 0, y: 0 };

  switch (mode) {
    case 'linear':
      position = {
        x: -5 + initialVelocity * t + 0.5 * acceleration * t * t,
        y: 0,
      };
      velocity = {
        x: initialVelocity + acceleration * t,
        y: 0,
      };
      accel = {
        x: acceleration,
        y: 0,
      };
      break;

    case 'freefall':
      const startY = 12;
      position = {
        x: 0,
        y: Math.max(0, startY + initialVelocity * t - 0.5 * gravity * t * t),
      };
      velocity = {
        x: 0,
        y: initialVelocity - gravity * t,
      };
      accel = {
        x: 0,
        y: -gravity,
      };
      break;

    case 'circular':
      const omega = 2 * Math.PI * frequency;
      const vMag = amplitude * omega;
      position = {
        x: amplitude * Math.cos(omega * t),
        y: amplitude * Math.sin(omega * t),
      };
      velocity = {
        x: -vMag * Math.sin(omega * t),
        y: vMag * Math.cos(omega * t),
      };
      const aMag = omega * omega * amplitude;
      accel = {
        x: -aMag * Math.cos(omega * t),
        y: -aMag * Math.sin(omega * t),
      };
      break;
  }

  return {
    position,
    velocity,
    acceleration: accel,
    speed: magnitude(velocity),
  };
}
