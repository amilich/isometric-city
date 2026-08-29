// WebGL2 renderer for the 3D city view.
//
// Passes, in order:
//   1. shadow    - depth-only render of the city from the sun's point of view
//   2. sky       - full-screen gradient with sun disc and stars
//   3. opaque    - terrain, roads, buildings (textured from the material atlas)
//   4. instanced - vehicles
//   5. water     - animated, transparent, sun glitter
//   6. overlay   - tile hover / build footprint highlight

import { Camera3D } from './camera3d';
import { Atmosphere } from './atmosphere';
import { CityMesh, FLOATS_PER_VERTEX } from './meshBuilder';
import { createProgram, ShaderProgram } from './glUtils';
import { Mat4, mat4Create, mat4LookAt, mat4Multiply, mat4Ortho } from './mat4';
import { createMaterialAtlas, WINDOW_GRID } from './textureAtlas';
import {
  DEPTH_FRAG,
  DEPTH_VERT,
  INSTANCED_DEPTH_VERT,
  INSTANCED_FRAG,
  INSTANCED_VERT,
  MAIN_FRAG,
  MAIN_VERT,
  OVERLAY_FRAG,
  OVERLAY_VERT,
  SKY_FRAG,
  SKY_VERT,
  WATER_FRAG,
  WATER_VERT,
} from './shaders';

const SHADOW_SIZE = 2048;
const INSTANCE_FLOATS = 10; // offset(3) scale(3) color(3) yaw(1)
export const MAX_CAR_INSTANCES = 900;

const LIGHTING_UNIFORMS = [
  'uSunDir', 'uSunColor', 'uSkyColor', 'uGroundColor', 'uFogColor',
  'uCameraPos', 'uNight', 'uFogDensity', 'uShadowMap', 'uLightViewProj',
];

/** Unit cube centered on the origin: position + normal per vertex. */
function unitBoxGeometry(): Float32Array {
  const faces: { normal: [number, number, number]; corners: [number, number, number][] }[] = [
    { normal: [0, 0, 1], corners: [[-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5]] },
    { normal: [0, 0, -1], corners: [[0.5, -0.5, -0.5], [-0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5]] },
    { normal: [1, 0, 0], corners: [[0.5, -0.5, 0.5], [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5]] },
    { normal: [-1, 0, 0], corners: [[-0.5, -0.5, -0.5], [-0.5, -0.5, 0.5], [-0.5, 0.5, 0.5], [-0.5, 0.5, -0.5]] },
    { normal: [0, 1, 0], corners: [[-0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5]] },
    { normal: [0, -1, 0], corners: [[-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, 0.5]] },
  ];
  const data: number[] = [];
  for (const face of faces) {
    const [a, b, c, d] = face.corners;
    for (const corner of [a, b, c, a, c, d]) {
      data.push(corner[0], corner[1], corner[2], face.normal[0], face.normal[1], face.normal[2]);
    }
  }
  return new Float32Array(data);
}

export interface HighlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
  color: [number, number, number, number];
}

export interface FrameInput {
  camera: Camera3D;
  atmosphere: Atmosphere;
  time: number;
  carInstances: Float32Array;
  carCount: number;
  highlights: HighlightRect[];
}

export class Renderer3D {
  private readonly gl: WebGL2RenderingContext;
  private readonly mainProgram: ShaderProgram;
  private readonly depthProgram: ShaderProgram;
  private readonly waterProgram: ShaderProgram;
  private readonly skyProgram: ShaderProgram;
  private readonly instancedProgram: ShaderProgram;
  private readonly instancedDepthProgram: ShaderProgram;
  private readonly overlayProgram: ShaderProgram;

  private readonly opaqueBuffer: WebGLBuffer;
  private readonly waterBuffer: WebGLBuffer;
  private readonly boxBuffer: WebGLBuffer;
  private readonly instanceBuffer: WebGLBuffer;
  private readonly skyBuffer: WebGLBuffer;
  private readonly overlayBuffer: WebGLBuffer;

  private readonly opaqueVao: WebGLVertexArrayObject;
  private readonly opaqueDepthVao: WebGLVertexArrayObject;
  private readonly waterVao: WebGLVertexArrayObject;
  private readonly instancedVao: WebGLVertexArrayObject;
  private readonly instancedDepthVao: WebGLVertexArrayObject;
  private readonly skyVao: WebGLVertexArrayObject;
  private readonly overlayVao: WebGLVertexArrayObject;

  private readonly shadowFbo: WebGLFramebuffer;
  private readonly shadowTexture: WebGLTexture;
  private readonly atlasTexture: WebGLTexture;

  private readonly lightView = mat4Create();
  private readonly lightProj = mat4Create();
  private readonly lightViewProj = mat4Create();

  private opaqueVertexCount = 0;
  private waterVertexCount = 0;
  private width = 1;
  private height = 1;

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      antialias: true,
      alpha: false,
      depth: true,
      powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('WebGL2 is not available');
    this.gl = gl;

    const mainAttribs = ['aPos', 'aNormal', 'aColor', 'aUv', 'aFlag'];
    this.mainProgram = createProgram(
      gl, MAIN_VERT, MAIN_FRAG,
      ['uViewProj', 'uAtlas', 'uWindowGrid', ...LIGHTING_UNIFORMS],
      mainAttribs
    );
    this.depthProgram = createProgram(gl, DEPTH_VERT, DEPTH_FRAG, ['uLightViewProj'], ['aPos']);
    this.waterProgram = createProgram(gl, WATER_VERT, WATER_FRAG, ['uViewProj', 'uTime', ...LIGHTING_UNIFORMS], ['aPos', 'aColor']);
    this.skyProgram = createProgram(
      gl, SKY_VERT, SKY_FRAG,
      ['uInvViewProj', 'uSunDir', 'uZenithColor', 'uHorizonColor', 'uSunColor', 'uNight'],
      ['aPos']
    );
    this.instancedProgram = createProgram(
      gl, INSTANCED_VERT, INSTANCED_FRAG,
      ['uViewProj', ...LIGHTING_UNIFORMS],
      ['aPos', 'aNormal', 'aOffset', 'aScale', 'aInstanceColor', 'aYaw']
    );
    this.instancedDepthProgram = createProgram(
      gl, INSTANCED_DEPTH_VERT, DEPTH_FRAG, ['uLightViewProj'], ['aPos', 'aOffset', 'aScale', 'aYaw']
    );
    this.overlayProgram = createProgram(gl, OVERLAY_VERT, OVERLAY_FRAG, ['uViewProj', 'uColor'], ['aPos']);

    this.opaqueBuffer = this.createBuffer();
    this.waterBuffer = this.createBuffer();
    this.boxBuffer = this.createBuffer();
    this.instanceBuffer = this.createBuffer();
    this.skyBuffer = this.createBuffer();
    this.overlayBuffer = this.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, this.boxBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, unitBoxGeometry(), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, MAX_CAR_INSTANCES * INSTANCE_FLOATS * 4, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.skyBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.overlayBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, 4096 * 4, gl.DYNAMIC_DRAW);

    this.opaqueVao = this.createMeshVao(this.mainProgram, this.opaqueBuffer, true);
    this.opaqueDepthVao = this.createMeshVao(this.depthProgram, this.opaqueBuffer, false);
    this.waterVao = this.createWaterVao();
    this.instancedVao = this.createInstancedVao(this.instancedProgram, true);
    this.instancedDepthVao = this.createInstancedVao(this.instancedDepthProgram, false);
    this.skyVao = this.createSimpleVao(this.skyProgram.attribs.aPos, 2);
    this.overlayVao = this.createSimpleVao(this.overlayProgram.attribs.aPos, 3, this.overlayBuffer);

    const shadow = this.createShadowTarget();
    this.shadowFbo = shadow.fbo;
    this.shadowTexture = shadow.texture;
    this.atlasTexture = createMaterialAtlas(gl);

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
  }

  private createBuffer(): WebGLBuffer {
    const buffer = this.gl.createBuffer();
    if (!buffer) throw new Error('Failed to create buffer');
    return buffer;
  }

  private createVao(): WebGLVertexArrayObject {
    const vao = this.gl.createVertexArray();
    if (!vao) throw new Error('Failed to create VAO');
    return vao;
  }

  private createMeshVao(program: ShaderProgram, buffer: WebGLBuffer, full: boolean): WebGLVertexArrayObject {
    const gl = this.gl;
    const vao = this.createVao();
    const stride = FLOATS_PER_VERTEX * 4;
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    const enable = (location: number, size: number, offset: number) => {
      if (location < 0) return;
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride, offset);
    };
    enable(program.attribs.aPos, 3, 0);
    if (full) {
      enable(program.attribs.aNormal, 3, 12);
      enable(program.attribs.aColor, 3, 24);
      enable(program.attribs.aUv, 2, 36);
      enable(program.attribs.aFlag, 1, 44);
    }
    gl.bindVertexArray(null);
    return vao;
  }

  private createWaterVao(): WebGLVertexArrayObject {
    const gl = this.gl;
    const vao = this.createVao();
    const stride = FLOATS_PER_VERTEX * 4;
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.waterBuffer);
    gl.enableVertexAttribArray(this.waterProgram.attribs.aPos);
    gl.vertexAttribPointer(this.waterProgram.attribs.aPos, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(this.waterProgram.attribs.aColor);
    gl.vertexAttribPointer(this.waterProgram.attribs.aColor, 3, gl.FLOAT, false, stride, 24);
    gl.bindVertexArray(null);
    return vao;
  }

  private createInstancedVao(program: ShaderProgram, withShading: boolean): WebGLVertexArrayObject {
    const gl = this.gl;
    const vao = this.createVao();
    gl.bindVertexArray(vao);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.boxBuffer);
    gl.enableVertexAttribArray(program.attribs.aPos);
    gl.vertexAttribPointer(program.attribs.aPos, 3, gl.FLOAT, false, 24, 0);
    if (withShading && program.attribs.aNormal >= 0) {
      gl.enableVertexAttribArray(program.attribs.aNormal);
      gl.vertexAttribPointer(program.attribs.aNormal, 3, gl.FLOAT, false, 24, 12);
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
    const stride = INSTANCE_FLOATS * 4;
    const instanceAttrib = (location: number, size: number, offset: number) => {
      if (location < 0) return;
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride, offset);
      gl.vertexAttribDivisor(location, 1);
    };
    instanceAttrib(program.attribs.aOffset, 3, 0);
    instanceAttrib(program.attribs.aScale, 3, 12);
    if (withShading) instanceAttrib(program.attribs.aInstanceColor, 3, 24);
    instanceAttrib(program.attribs.aYaw, 1, 36);

    gl.bindVertexArray(null);
    return vao;
  }

  private createSimpleVao(location: number, size: number, buffer: WebGLBuffer = this.skyBuffer): WebGLVertexArrayObject {
    const gl = this.gl;
    const vao = this.createVao();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    return vao;
  }

  private createShadowTarget(): { fbo: WebGLFramebuffer; texture: WebGLTexture } {
    const gl = this.gl;
    const texture = gl.createTexture();
    const fbo = gl.createFramebuffer();
    if (!texture || !fbo) throw new Error('Failed to create shadow target');
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, SHADOW_SIZE, SHADOW_SIZE, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, texture, 0);
    gl.drawBuffers([gl.NONE]);
    gl.readBuffer(gl.NONE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fbo, texture };
  }

  setMesh(mesh: CityMesh): void {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.opaqueBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.opaque, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.waterBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.water, gl.STATIC_DRAW);
    this.opaqueVertexCount = mesh.opaqueVertices;
    this.waterVertexCount = mesh.waterVertices;
  }

  resize(width: number, height: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
  }

  private updateLightMatrix(camera: Camera3D, atmosphere: Atmosphere): void {
    const radius = Math.min(110, Math.max(24, camera.distance * 1.1));
    const distance = 180;
    const [sx, sy, sz] = atmosphere.sunDir;
    const eye: [number, number, number] = [
      camera.targetX + sx * distance,
      Math.max(8, sy * distance),
      camera.targetZ + sz * distance,
    ];
    const up: [number, number, number] = Math.abs(sy) > 0.98 ? [0, 0, 1] : [0, 1, 0];
    mat4LookAt(this.lightView, eye, [camera.targetX, 0, camera.targetZ], up);
    mat4Ortho(this.lightProj, -radius, radius, -radius, radius, 1, distance * 2.2);
    mat4Multiply(this.lightViewProj, this.lightProj, this.lightView);
  }

  private setLightingUniforms(program: ShaderProgram, camera: Camera3D, atmosphere: Atmosphere): void {
    const gl = this.gl;
    const eye = camera.eye();
    gl.uniform3fv(program.uniforms.uSunDir, atmosphere.sunDir);
    gl.uniform3fv(program.uniforms.uSunColor, atmosphere.sunColor);
    gl.uniform3fv(program.uniforms.uSkyColor, atmosphere.skyColor);
    gl.uniform3fv(program.uniforms.uGroundColor, atmosphere.groundColor);
    gl.uniform3fv(program.uniforms.uFogColor, atmosphere.fogColor);
    gl.uniform3fv(program.uniforms.uCameraPos, new Float32Array(eye));
    gl.uniform1f(program.uniforms.uNight, atmosphere.night);
    gl.uniform1f(program.uniforms.uFogDensity, 0.0032);
    gl.uniformMatrix4fv(program.uniforms.uLightViewProj, false, this.lightViewProj);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.shadowTexture);
    gl.uniform1i(program.uniforms.uShadowMap, 0);
  }

  render(frame: FrameInput): void {
    const gl = this.gl;
    const { camera, atmosphere } = frame;
    camera.update(this.width / this.height);
    this.updateLightMatrix(camera, atmosphere);

    const viewProj: Mat4 = camera.viewProjMatrix();
    const hasCars = frame.carCount > 0;

    if (hasCars) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, frame.carInstances.subarray(0, frame.carCount * INSTANCE_FLOATS));
    }

    // ---- 1. Shadow pass ---------------------------------------------------
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo);
    gl.viewport(0, 0, SHADOW_SIZE, SHADOW_SIZE);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.disable(gl.CULL_FACE);

    gl.useProgram(this.depthProgram.program);
    gl.uniformMatrix4fv(this.depthProgram.uniforms.uLightViewProj, false, this.lightViewProj);
    gl.bindVertexArray(this.opaqueDepthVao);
    gl.drawArrays(gl.TRIANGLES, 0, this.opaqueVertexCount);

    if (hasCars) {
      gl.useProgram(this.instancedDepthProgram.program);
      gl.uniformMatrix4fv(this.instancedDepthProgram.uniforms.uLightViewProj, false, this.lightViewProj);
      gl.bindVertexArray(this.instancedDepthVao);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 36, frame.carCount);
    }

    // ---- Main pass setup --------------------------------------------------
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.width, this.height);
    gl.clearColor(atmosphere.horizonColor[0], atmosphere.horizonColor[1], atmosphere.horizonColor[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.CULL_FACE);

    // ---- 2. Sky -----------------------------------------------------------
    gl.depthMask(false);
    gl.useProgram(this.skyProgram.program);
    gl.uniformMatrix4fv(this.skyProgram.uniforms.uInvViewProj, false, camera.invViewProjMatrix());
    gl.uniform3fv(this.skyProgram.uniforms.uSunDir, atmosphere.sunDir);
    gl.uniform3fv(this.skyProgram.uniforms.uZenithColor, atmosphere.zenithColor);
    gl.uniform3fv(this.skyProgram.uniforms.uHorizonColor, atmosphere.horizonColor);
    gl.uniform3fv(this.skyProgram.uniforms.uSunColor, atmosphere.sunColor);
    gl.uniform1f(this.skyProgram.uniforms.uNight, atmosphere.night);
    gl.bindVertexArray(this.skyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.depthMask(true);

    // ---- 3. Opaque city ---------------------------------------------------
    gl.useProgram(this.mainProgram.program);
    gl.uniformMatrix4fv(this.mainProgram.uniforms.uViewProj, false, viewProj);
    this.setLightingUniforms(this.mainProgram, camera, atmosphere);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.atlasTexture);
    gl.uniform1i(this.mainProgram.uniforms.uAtlas, 1);
    gl.uniform1f(this.mainProgram.uniforms.uWindowGrid, WINDOW_GRID);
    gl.bindVertexArray(this.opaqueVao);
    gl.drawArrays(gl.TRIANGLES, 0, this.opaqueVertexCount);

    // ---- 4. Vehicles ------------------------------------------------------
    if (hasCars) {
      gl.useProgram(this.instancedProgram.program);
      gl.uniformMatrix4fv(this.instancedProgram.uniforms.uViewProj, false, viewProj);
      this.setLightingUniforms(this.instancedProgram, camera, atmosphere);
      gl.bindVertexArray(this.instancedVao);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 36, frame.carCount);
    }

    // ---- 5. Water ---------------------------------------------------------
    if (this.waterVertexCount > 0) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(this.waterProgram.program);
      gl.uniformMatrix4fv(this.waterProgram.uniforms.uViewProj, false, viewProj);
      gl.uniform1f(this.waterProgram.uniforms.uTime, frame.time);
      this.setLightingUniforms(this.waterProgram, camera, atmosphere);
      gl.bindVertexArray(this.waterVao);
      gl.drawArrays(gl.TRIANGLES, 0, this.waterVertexCount);
      gl.disable(gl.BLEND);
    }

    // ---- 6. Highlights ----------------------------------------------------
    if (frame.highlights.length > 0) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.disable(gl.CULL_FACE);
      gl.useProgram(this.overlayProgram.program);
      gl.uniformMatrix4fv(this.overlayProgram.uniforms.uViewProj, false, viewProj);
      gl.bindVertexArray(this.overlayVao);
      for (const rect of frame.highlights) {
        const y = 0.09;
        const x0 = rect.x;
        const x1 = rect.x + rect.width;
        const z0 = rect.y;
        const z1 = rect.y + rect.height;
        const quad = new Float32Array([
          x0, y, z1, x1, y, z1, x1, y, z0,
          x0, y, z1, x1, y, z0, x0, y, z0,
        ]);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.overlayBuffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, quad);
        gl.uniform4fv(this.overlayProgram.uniforms.uColor, rect.color);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }
      gl.enable(gl.CULL_FACE);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }

    gl.bindVertexArray(null);
  }

  dispose(): void {
    const gl = this.gl;
    for (const buffer of [this.opaqueBuffer, this.waterBuffer, this.boxBuffer, this.instanceBuffer, this.skyBuffer, this.overlayBuffer]) {
      gl.deleteBuffer(buffer);
    }
    for (const vao of [this.opaqueVao, this.opaqueDepthVao, this.waterVao, this.instancedVao, this.instancedDepthVao, this.skyVao, this.overlayVao]) {
      gl.deleteVertexArray(vao);
    }
    for (const program of [this.mainProgram, this.depthProgram, this.waterProgram, this.skyProgram, this.instancedProgram, this.instancedDepthProgram, this.overlayProgram]) {
      gl.deleteProgram(program.program);
    }
    gl.deleteFramebuffer(this.shadowFbo);
    gl.deleteTexture(this.shadowTexture);
    gl.deleteTexture(this.atlasTexture);
  }
}
