/**
 * Speed and Velocity
 *
 * Concepts:
 * 1. Instantaneous Velocity (v): The rate of change of position with respect to time.
 *    v = dr / dt = (dx/dt, dy/dt)
 *
 * 2. Instantaneous Speed (s): The magnitude of the instantaneous velocity vector.
 *    s = |v| = sqrt((dx/dt)^2 + (dy/dt)^2)
 *
 * 3. Average Velocity (v_avg): The displacement divided by the time interval.
 *    v_avg = Δr / Δt
 *
 * 4. Average Speed (s_avg): The total distance traveled divided by the time interval.
 *    s_avg = distance / Δt
 */

import { Vec2, magnitude, sub } from '../vector';

export type TrajectoryType = 'linear' | 'circular' | 'sinusoidal';

export interface MotionParams {
  type: TrajectoryType;
  amplitude: number;
  frequency: number; // For circular/sinusoidal
  speed: number;    // For linear
}

export interface MotionState {
  position: Vec2;
  velocity: Vec2;
  speed: number;
}

/**
 * Calculates position and instantaneous velocity at time t for a given trajectory.
 */
export function getMotionState(t: number, params: MotionParams): MotionState {
  const { type, amplitude, frequency, speed } = params;
  let position: Vec2 = { x: 0, y: 0 };
  let velocity: Vec2 = { x: 0, y: 0 };

  switch (type) {
    case 'linear':
      // v = (speed, 0)
      // r = (speed * t, 0)
      position = { x: speed * t - 5, y: 0 }; // Start at x = -5
      velocity = { x: speed, y: 0 };
      break;
    case 'circular':
      // r = (R cos(ωt), R sin(ωt))
      // v = (-Rω sin(ωt), Rω cos(ωt))
      const omega = 2 * Math.PI * frequency;
      position = {
        x: amplitude * Math.cos(omega * t),
        y: amplitude * Math.sin(omega * t),
      };
      velocity = {
        x: -amplitude * omega * Math.sin(omega * t),
        y: amplitude * omega * Math.cos(omega * t),
      };
      break;
    case 'sinusoidal':
      // r = (t - 5, A sin(ωt))
      // v = (1, Aω cos(ωt))
      const w = 2 * Math.PI * frequency;
      position = {
        x: t - 5,
        y: amplitude * Math.sin(w * t),
      };
      velocity = {
        x: 1,
        y: amplitude * w * Math.cos(w * t),
      };
      break;
  }

  return {
    position,
    velocity,
    speed: magnitude(velocity),
  };
}

export interface Averages {
  averageSpeed: number;
  averageVelocity: Vec2;
}

/**
 * Calculates average speed and average velocity given total distance, displacement, and time.
 */
export function calculateAverages(distance: number, displacement: Vec2, totalTime: number): Averages {
  if (totalTime <= 0) {
    return {
      averageSpeed: 0,
      averageVelocity: { x: 0, y: 0 },
    };
  }

  return {
    averageSpeed: distance / totalTime,
    averageVelocity: {
      x: displacement.x / totalTime,
      y: displacement.y / totalTime,
    },
  };
}
