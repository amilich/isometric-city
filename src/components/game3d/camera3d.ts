// Perspective orbit camera for the 3D city view.
//
// Unlike the isometric projection (fixed 2:1 screen skew) this is a real camera:
// it has a field of view, can be rotated to any yaw, tilted from a near-top-down
// view down to street level, and produces genuine perspective foreshortening.

import { Mat4, Vec3, mat4Create, mat4Invert, mat4LookAt, mat4Multiply, mat4Perspective, transformPoint } from './mat4';

export const MIN_PITCH = 0.08;          // radians above the horizon (street level)
export const MAX_PITCH = 1.45;          // near top-down
export const MIN_DISTANCE = 3;
export const MAX_DISTANCE = 220;
export const FIELD_OF_VIEW = (55 * Math.PI) / 180;

export class Camera3D {
  /** Look-at target on the ground plane (world units == tiles). */
  targetX: number;
  targetZ: number;
  targetY = 0;
  yaw: number;
  pitch: number;
  distance: number;

  private readonly view = mat4Create();
  private readonly proj = mat4Create();
  private readonly viewProj = mat4Create();
  private readonly invViewProj = mat4Create();
  private readonly eyePos: Vec3 = [0, 0, 0];

  constructor(targetX: number, targetZ: number, distance = 40, yaw = Math.PI * 0.75, pitch = 0.72) {
    this.targetX = targetX;
    this.targetZ = targetZ;
    this.distance = distance;
    this.yaw = yaw;
    this.pitch = pitch;
  }

  clampToGrid(gridSize: number): void {
    const margin = gridSize * 0.35;
    this.targetX = Math.min(gridSize + margin, Math.max(-margin, this.targetX));
    this.targetZ = Math.min(gridSize + margin, Math.max(-margin, this.targetZ));
    this.distance = Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, this.distance));
    this.pitch = Math.min(MAX_PITCH, Math.max(MIN_PITCH, this.pitch));
  }

  eye(): Vec3 {
    const horizontal = Math.cos(this.pitch) * this.distance;
    this.eyePos[0] = this.targetX + Math.cos(this.yaw) * horizontal;
    this.eyePos[1] = this.targetY + Math.sin(this.pitch) * this.distance;
    this.eyePos[2] = this.targetZ + Math.sin(this.yaw) * horizontal;
    return this.eyePos;
  }

  /** Recompute matrices for the given viewport aspect ratio. */
  update(aspect: number): void {
    const eye = this.eye();
    mat4LookAt(this.view, eye, [this.targetX, this.targetY, this.targetZ], [0, 1, 0]);
    const far = Math.max(400, this.distance * 12);
    mat4Perspective(this.proj, FIELD_OF_VIEW, aspect, 0.1, far);
    mat4Multiply(this.viewProj, this.proj, this.view);
    mat4Invert(this.invViewProj, this.viewProj);
  }

  viewProjMatrix(): Mat4 {
    return this.viewProj;
  }

  invViewProjMatrix(): Mat4 {
    return this.invViewProj;
  }

  /** Pan in the camera's own screen plane (drag-to-move the ground). */
  pan(dxScreen: number, dzScreen: number): void {
    const forwardX = Math.cos(this.yaw + Math.PI);
    const forwardZ = Math.sin(this.yaw + Math.PI);
    const rightX = -forwardZ;
    const rightZ = forwardX;
    this.targetX += rightX * dxScreen + forwardX * dzScreen;
    this.targetZ += rightZ * dxScreen + forwardZ * dzScreen;
  }

  /**
   * Convert normalized device coordinates to the point where the view ray meets
   * the ground plane at height `planeY`. Returns null when the ray points away
   * from the plane (e.g. towards the sky).
   */
  screenToGround(ndcX: number, ndcY: number, planeY = 0): { x: number; z: number } | null {
    const near: Vec3 = [0, 0, 0];
    const far: Vec3 = [0, 0, 0];
    transformPoint(near, this.invViewProj, ndcX, ndcY, -1);
    transformPoint(far, this.invViewProj, ndcX, ndcY, 1);
    const dirY = far[1] - near[1];
    if (Math.abs(dirY) < 1e-6) return null;
    const travel = (planeY - near[1]) / dirY;
    if (travel < 0 || travel > 1) return null;
    return {
      x: near[0] + (far[0] - near[0]) * travel,
      z: near[2] + (far[2] - near[2]) * travel,
    };
  }
}
