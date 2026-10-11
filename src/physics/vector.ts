/**
 * Core vector math utilities for 2D physics simulations.
 */

export interface Vec2 {
  x: number;
  y: number;
}

export const vec2 = (x: number, y: number): Vec2 => ({ x, y });

export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });

export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });

export const scale = (v: Vec2, s: number): Vec2 => ({ x: v.x * s, y: v.y * s });

export const magnitude = (v: Vec2): number => Math.sqrt(v.x * v.x + v.y * v.y);

export const normalize = (v: Vec2): Vec2 => {
  const mag = magnitude(v);
  if (mag === 0) return { x: 0, y: 0 };
  return { x: v.x / mag, y: v.y / mag };
};

export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;

export const cross2D = (a: Vec2, b: Vec2): number => a.x * b.y - a.y * b.x;

export const rotate = (v: Vec2, angle: number): Vec2 => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: v.x * cos - v.y * sin, y: v.x * sin + v.y * cos };
};

export const distance = (a: Vec2, b: Vec2): number => magnitude(sub(a, b));

export const lerp = (a: Vec2, b: Vec2, t: number): Vec2 => add(scale(a, 1 - t), scale(b, t));

export const clampMagnitude = (v: Vec2, maxMag: number): Vec2 => {
  const mag = magnitude(v);
  if (mag <= maxMag) return v;
  return scale(normalize(v), maxMag);
};
