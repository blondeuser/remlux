// Pure maths that makes a three.js OrthographicCamera show exactly what the canvas-2D views show.
// App world: x right, y depth (plan y, down on a plan), z up. That is a left-handed set, so the
// three.js scene uses (X, Y, Z) = (x - cx, z - cz, y - cy): Y up, handedness flipped by the swap.
// No three.js import here (the library is loaded lazily elsewhere), so this is unit-testable.
import type { IsoProj, IsoView } from '../iso';

const RAD = Math.PI / 180;

export interface OrthoParams {
  left: number;
  right: number;
  top: number;
  bottom: number;
  /** direction from the scene centre towards the eye, three.js axes (unit) */
  eye: [number, number, number];
  /** camera up vector, three.js axes (unit) */
  up: [number, number, number];
}

/** Frustum and orientation matching the 2D projection: screen X = rx·s + ox, screen Y = (ry·sin p − z·cos p)·s + oy. */
export function orthoParams(view: IsoView, proj: IsoProj, w: number, h: number): OrthoParams {
  const cy = Math.cos(view.yaw * RAD), sy = Math.sin(view.yaw * RAD);
  const cp = Math.cos(view.pitch * RAD), sp = Math.sin(view.pitch * RAD);
  const { s, ox, oy } = proj;
  return {
    left: -ox / s,
    right: (w - ox) / s,
    top: oy / s,
    bottom: -(h - oy) / s,
    // app (x, y, z) -> three (x, z, y)
    eye: [sy * cp, sp, cy * cp],
    up: [-sy * sp, cp, -cy * sp],
  };
}

/** App world point -> three.js position, relative to the view centre `c` (app coordinates). */
export const toThree = (x: number, y: number, z: number, c: readonly [number, number, number]): [number, number, number] =>
  [x - c[0], z - c[2], y - c[1]];
