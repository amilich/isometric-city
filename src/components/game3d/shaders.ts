// GLSL (ES 3.0) sources for the 3D city renderer.
//
// Surfaces are shaded from two things baked into each vertex: a surface flag
// (road markings, facade behaviour, ...) and a material layer index into the
// procedurally generated texture array (see textureAtlas.ts). The texture
// supplies detail and a window mask; vertex colour still supplies the palette,
// so one brick or glass layer serves every building tint.

export const SURFACE_LIB = /* glsl */ `
const float SURFACE_PLAIN = 0.0;
const float SURFACE_FACADE = 1.0;
const float SURFACE_ROAD = 2.0;
const float SURFACE_GRASS = 3.0;
const float SURFACE_ROOF = 4.0;
const float SURFACE_CONCRETE = 5.0;

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

// Vertex materials pack the surface flag and texture layer into one float:
//   value = flag + (layer + 1) * MATERIAL_STRIDE
const float MATERIAL_STRIDE = 8.0;

void decodeMaterial(float material, out float flag, out float layer) {
  layer = floor(material / MATERIAL_STRIDE) - 1.0;
  flag = material - (layer + 1.0) * MATERIAL_STRIDE;
}
`;

export const MAIN_VERT = /* glsl */ `#version 300 es
precision highp float;

in vec3 aPos;
in vec3 aNormal;
in vec3 aColor;
in vec2 aUv;
in float aFlag;

uniform mat4 uViewProj;
uniform mat4 uLightViewProj;

${SURFACE_LIB}

out vec3 vWorld;
out vec3 vNormal;
out vec3 vColor;
out vec2 vUv;
flat out float vFlag;
flat out float vLayer;
out vec4 vLightSpace;

void main() {
  vWorld = aPos;
  vNormal = aNormal;
  vColor = aColor;
  vUv = aUv;
  decodeMaterial(aFlag, vFlag, vLayer);
  vLightSpace = uLightViewProj * vec4(aPos, 1.0);
  gl_Position = uViewProj * vec4(aPos, 1.0);
}
`;

export const LIGHTING_LIB = /* glsl */ `
uniform vec3 uSunDir;        // normalized, pointing from surface toward the sun
uniform vec3 uSunColor;
uniform vec3 uSkyColor;
uniform vec3 uGroundColor;
uniform vec3 uFogColor;
uniform vec3 uCameraPos;
uniform float uNight;        // 0 = full day, 1 = full night
uniform float uFogDensity;
uniform sampler2D uShadowMap;

float shadowFactor(vec4 lightSpace, float ndl) {
  vec3 proj = lightSpace.xyz / lightSpace.w;
  proj = proj * 0.5 + 0.5;
  if (proj.z > 1.0 || proj.x < 0.0 || proj.x > 1.0 || proj.y < 0.0 || proj.y > 1.0) return 1.0;
  float bias = max(0.0016 * (1.0 - ndl), 0.0006);
  float shadow = 0.0;
  vec2 texel = 1.0 / vec2(textureSize(uShadowMap, 0));
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      float depth = texture(uShadowMap, proj.xy + vec2(float(x), float(y)) * texel).r;
      shadow += proj.z - bias > depth ? 0.0 : 1.0;
    }
  }
  return shadow / 9.0;
}

vec3 applyLighting(vec3 albedo, vec3 normal, vec3 worldPos, vec4 lightSpace, float shadowStrength) {
  vec3 n = normalize(normal);
  float ndl = max(dot(n, uSunDir), 0.0);
  float shadow = mix(1.0, shadowFactor(lightSpace, ndl), shadowStrength);
  // Hemispheric ambient: sky above, bounced ground light below
  float up = n.y * 0.5 + 0.5;
  vec3 ambient = mix(uGroundColor, uSkyColor, up) * (0.55 - 0.15 * uNight);
  vec3 diffuse = uSunColor * ndl * shadow;
  vec3 color = albedo * (ambient + diffuse);

  // Distance fog blends the city into the sky
  float dist = length(worldPos - uCameraPos);
  float fog = 1.0 - exp(-dist * uFogDensity);
  return mix(color, uFogColor, clamp(fog, 0.0, 0.85));
}
`;

export const MAIN_FRAG = /* glsl */ `#version 300 es
precision highp float;
precision highp sampler2DArray;

in vec3 vWorld;
in vec3 vNormal;
in vec3 vColor;
in vec2 vUv;
flat in float vFlag;
flat in float vLayer;
in vec4 vLightSpace;

out vec4 fragColor;

${SURFACE_LIB}
${LIGHTING_LIB}

uniform sampler2DArray uAtlas;
uniform float uWindowGrid;   // window cells per world unit in the wall textures

// Textured facade: the atlas supplies brick / glass / panel detail plus a
// window mask, and windows light up individually at night.
vec3 facade(vec3 base, vec3 detail, float windowMask, vec2 uv, out float emissive) {
  emissive = 0.0;
  vec3 wall = base * detail;
  if (windowMask < 0.02) return wall;

  vec2 cell = floor(uv * uWindowGrid);
  float lit = hash21(cell + floor(vWorld.xz * 3.17));
  vec3 glassDay = base * 0.28 + vec3(0.10, 0.13, 0.17);
  vec3 glassNight = vec3(1.0, 0.86, 0.6);
  float litAtNight = step(0.45, lit) * uNight * windowMask;
  emissive = litAtNight;
  return mix(wall, mix(glassDay, glassNight, litAtNight), windowMask);
}

// Road surface: centre dashes plus solid edge lines.
vec3 road(vec3 base, vec3 detail, vec2 uv) {
  base *= detail;
  float centre = 1.0 - smoothstep(0.02, 0.035, abs(uv.x - 0.5));
  float dash = step(0.5, fract(uv.y * 3.0));
  float edges = 1.0 - smoothstep(0.03, 0.045, min(uv.x, 1.0 - uv.x));
  float paint = clamp(centre * dash + edges * 0.7, 0.0, 1.0);
  float wear = hash21(floor(vWorld.xz * 8.0)) * 0.06;
  return mix(base + wear, vec3(0.86, 0.84, 0.7), paint);
}

void main() {
  vec4 material = vLayer >= 0.0 ? texture(uAtlas, vec3(vUv, vLayer)) : vec4(0.5, 0.5, 0.5, 0.0);
  vec3 detail = material.rgb * 2.0;
  float windowMask = material.a;

  vec3 albedo = vColor;
  float emissive = 0.0;

  if (vFlag == SURFACE_FACADE) {
    albedo = facade(albedo, detail, windowMask, vUv, emissive);
  } else if (vFlag == SURFACE_ROAD) {
    albedo = road(albedo, detail, vUv);
  } else {
    albedo *= detail;
    if (vLayer < 0.0) {
      // Untextured props still get a little per-tile variation
      albedo *= 0.94 + hash21(floor(vWorld.xz * 10.0)) * 0.12;
    }
  }

  vec3 lit = applyLighting(albedo, vNormal, vWorld, vLightSpace, 1.0);
  // Lit windows keep their glow regardless of shadowing
  lit = mix(lit, albedo * 1.15, emissive * 0.85);
  fragColor = vec4(lit, 1.0);
}
`;

export const DEPTH_VERT = /* glsl */ `#version 300 es
precision highp float;
in vec3 aPos;
uniform mat4 uLightViewProj;
void main() {
  gl_Position = uLightViewProj * vec4(aPos, 1.0);
}
`;

export const DEPTH_FRAG = /* glsl */ `#version 300 es
precision highp float;
out vec4 fragColor;
void main() {
  fragColor = vec4(1.0);
}
`;

export const WATER_VERT = /* glsl */ `#version 300 es
precision highp float;

in vec3 aPos;
in vec3 aColor;

uniform mat4 uViewProj;
uniform float uTime;

out vec3 vWorld;
out vec3 vColor;
out vec3 vWaveNormal;

void main() {
  vec3 pos = aPos;
  float w1 = sin(pos.x * 2.1 + uTime * 1.1) * 0.028;
  float w2 = sin(pos.z * 1.7 - uTime * 0.9) * 0.026;
  float w3 = sin((pos.x + pos.z) * 3.3 + uTime * 1.7) * 0.012;
  pos.y += w1 + w2 + w3;

  // Analytic normal from the same wave sum
  float dx = cos(pos.x * 2.1 + uTime * 1.1) * 0.028 * 2.1 + cos((pos.x + pos.z) * 3.3 + uTime * 1.7) * 0.012 * 3.3;
  float dz = cos(pos.z * 1.7 - uTime * 0.9) * 0.026 * 1.7 + cos((pos.x + pos.z) * 3.3 + uTime * 1.7) * 0.012 * 3.3;
  vWaveNormal = normalize(vec3(-dx, 1.0, -dz));

  vWorld = pos;
  vColor = aColor;
  gl_Position = uViewProj * vec4(pos, 1.0);
}
`;

export const WATER_FRAG = /* glsl */ `#version 300 es
precision highp float;

in vec3 vWorld;
in vec3 vColor;
in vec3 vWaveNormal;

out vec4 fragColor;

${SURFACE_LIB}
${LIGHTING_LIB}

void main() {
  vec3 viewDir = normalize(uCameraPos - vWorld);
  float fresnel = pow(1.0 - max(dot(viewDir, vWaveNormal), 0.0), 3.0);
  vec3 base = mix(vColor, uSkyColor, 0.25 + fresnel * 0.55);

  // Specular sun glitter
  vec3 halfVec = normalize(viewDir + uSunDir);
  float spec = pow(max(dot(vWaveNormal, halfVec), 0.0), 120.0);

  vec3 lit = applyLighting(base, vWaveNormal, vWorld, vec4(0.0), 0.0);
  lit += uSunColor * spec * 1.4 * (1.0 - uNight);
  fragColor = vec4(lit, 0.92);
}
`;

export const SKY_VERT = /* glsl */ `#version 300 es
precision highp float;
in vec2 aPos;
uniform mat4 uInvViewProj;
out vec3 vRay;
void main() {
  vec4 near = uInvViewProj * vec4(aPos, -1.0, 1.0);
  vec4 far = uInvViewProj * vec4(aPos, 1.0, 1.0);
  vRay = (far.xyz / far.w) - (near.xyz / near.w);
  gl_Position = vec4(aPos, 0.9999, 1.0);
}
`;

export const SKY_FRAG = /* glsl */ `#version 300 es
precision highp float;

in vec3 vRay;
out vec4 fragColor;

uniform vec3 uSunDir;
uniform vec3 uZenithColor;
uniform vec3 uHorizonColor;
uniform vec3 uSunColor;
uniform float uNight;

float hash31(vec3 p) {
  return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
}

void main() {
  vec3 dir = normalize(vRay);
  float h = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 sky = mix(uHorizonColor, uZenithColor, pow(h, 0.65));

  // Sun disc plus halo
  float sunDot = max(dot(dir, uSunDir), 0.0);
  sky += uSunColor * pow(sunDot, 900.0) * 3.0;
  sky += uSunColor * pow(sunDot, 22.0) * 0.28;

  // Stars at night, above the horizon only
  if (uNight > 0.05 && dir.y > 0.0) {
    vec3 cell = floor(dir * 240.0);
    float star = step(0.9985, hash31(cell));
    sky += vec3(star) * uNight * (0.35 + 0.65 * hash31(cell + 1.0));
  }

  fragColor = vec4(sky, 1.0);
}
`;

/** Instanced geometry (vehicles): unit box transformed per instance. */
export const INSTANCED_VERT = /* glsl */ `#version 300 es
precision highp float;

in vec3 aPos;
in vec3 aNormal;
in vec3 aOffset;
in vec3 aScale;
in vec3 aInstanceColor;
in float aYaw;

uniform mat4 uViewProj;
uniform mat4 uLightViewProj;

out vec3 vWorld;
out vec3 vNormal;
out vec3 vColor;
out vec4 vLightSpace;

void main() {
  float s = sin(aYaw);
  float c = cos(aYaw);
  vec3 scaled = aPos * aScale;
  vec3 rotated = vec3(scaled.x * c - scaled.z * s, scaled.y, scaled.x * s + scaled.z * c);
  vec3 world = rotated + aOffset;
  vec3 n = vec3(aNormal.x * c - aNormal.z * s, aNormal.y, aNormal.x * s + aNormal.z * c);

  vWorld = world;
  vNormal = n;
  vColor = aInstanceColor;
  vLightSpace = uLightViewProj * vec4(world, 1.0);
  gl_Position = uViewProj * vec4(world, 1.0);
}
`;

export const INSTANCED_FRAG = /* glsl */ `#version 300 es
precision highp float;

in vec3 vWorld;
in vec3 vNormal;
in vec3 vColor;
in vec4 vLightSpace;

out vec4 fragColor;

${SURFACE_LIB}
${LIGHTING_LIB}

void main() {
  vec3 lit = applyLighting(vColor, vNormal, vWorld, vLightSpace, 1.0);
  fragColor = vec4(lit, 1.0);
}
`;

export const INSTANCED_DEPTH_VERT = /* glsl */ `#version 300 es
precision highp float;
in vec3 aPos;
in vec3 aOffset;
in vec3 aScale;
in float aYaw;
uniform mat4 uLightViewProj;
void main() {
  float s = sin(aYaw);
  float c = cos(aYaw);
  vec3 scaled = aPos * aScale;
  vec3 rotated = vec3(scaled.x * c - scaled.z * s, scaled.y, scaled.x * s + scaled.z * c);
  gl_Position = uLightViewProj * vec4(rotated + aOffset, 1.0);
}
`;

/** Tile highlight / build preview quads. */
export const OVERLAY_VERT = /* glsl */ `#version 300 es
precision highp float;
in vec3 aPos;
uniform mat4 uViewProj;
void main() {
  gl_Position = uViewProj * vec4(aPos, 1.0);
}
`;

export const OVERLAY_FRAG = /* glsl */ `#version 300 es
precision highp float;
uniform vec4 uColor;
out vec4 fragColor;
void main() {
  fragColor = uColor;
}
`;
