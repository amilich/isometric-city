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

// Roughness per material layer (see TEX in textureAtlas.ts): glass and sheet
// metal are polished, masonry and vegetation are not.
float layerRoughness(float layer) {
  if (layer == 2.0) return 0.12;                    // curtain-wall glass
  if (layer == 4.0 || layer == 7.0) return 0.30;    // metal panel / metal roof
  if (layer == 0.0) return 0.62;                    // precast concrete
  if (layer == 8.0 || layer == 10.0) return 0.70;   // asphalt / paving
  if (layer == 9.0) return 0.95;                    // grass
  return 0.85;
}

// Vertex materials pack the surface flag and texture layer into one float:
//   value = flag + (layer + 1) * MATERIAL_STRIDE
const float MATERIAL_STRIDE = 8.0;

void decodeMaterial(float material, out float flag, out float layer) {
  layer = floor(material / MATERIAL_STRIDE) - 1.0;
  flag = material - (layer + 1.0) * MATERIAL_STRIDE;
}
`;

// Colour management: albedo and light colours are authored in sRGB, shading runs
// in linear light, and the result is tonemapped on the way out. Without this the
// image reads flat and poster-like.
export const COLOR_LIB = /* glsl */ `
vec3 srgbToLinear(vec3 c) {
  return pow(max(c, 0.0), vec3(2.2));
}

vec3 linearToSrgb(vec3 c) {
  return pow(max(c, 0.0), vec3(1.0 / 2.2));
}

// Filmic tonemap (Narkowicz ACES fit): rolls off highlights instead of clipping
vec3 tonemap(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

/** Exposure chosen so a white facade in full sun sits just below clipping. */
const float EXPOSURE = 0.55;

vec3 present(vec3 hdr) {
  return linearToSrgb(tonemap(hdr * EXPOSURE));
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

// 5x5 PCF over a jittered kernel: soft edges rather than a stair-stepped border.
float shadowFactor(vec4 lightSpace, float ndl) {
  vec3 proj = lightSpace.xyz / lightSpace.w;
  proj = proj * 0.5 + 0.5;
  if (proj.z > 1.0 || proj.x < 0.0 || proj.x > 1.0 || proj.y < 0.0 || proj.y > 1.0) return 1.0;
  float bias = max(0.0018 * (1.0 - ndl), 0.0007);
  vec2 texel = 1.0 / vec2(textureSize(uShadowMap, 0));
  float angle = hash21(floor(proj.xy * 2048.0)) * 6.2831853;
  vec2 rot = vec2(cos(angle), sin(angle));
  float shadow = 0.0;
  for (int y = -2; y <= 2; y++) {
    for (int x = -2; x <= 2; x++) {
      vec2 tap = vec2(float(x), float(y));
      tap = vec2(tap.x * rot.x - tap.y * rot.y, tap.x * rot.y + tap.y * rot.x);
      float depth = texture(uShadowMap, proj.xy + tap * texel * 1.35).r;
      shadow += proj.z - bias > depth ? 0.0 : 1.0;
    }
  }
  return shadow / 25.0;
}

/**
 * Physically-flavoured shading: linear-light hemispheric ambient, sun diffuse,
 * a GGX highlight and a cheap sky reflection. Returns linear HDR radiance, so
 * callers must run it through present() before writing to the framebuffer.
 */
vec3 shade(
  vec3 albedoSrgb,
  vec3 normal,
  vec3 worldPos,
  vec4 lightSpace,
  float shadowStrength,
  float ao,
  float roughness,
  float reflectance
) {
  vec3 albedo = srgbToLinear(albedoSrgb);
  vec3 sun = srgbToLinear(uSunColor) * 3.4;
  vec3 sky = srgbToLinear(uSkyColor);
  vec3 ground = srgbToLinear(uGroundColor);

  vec3 n = normalize(normal);
  vec3 view = normalize(uCameraPos - worldPos);
  float ndl = max(dot(n, uSunDir), 0.0);
  float shadow = mix(1.0, shadowFactor(lightSpace, ndl), shadowStrength);

  // Hemispheric ambient: sky above, bounced ground light below
  float up = n.y * 0.5 + 0.5;
  vec3 ambient = mix(ground, sky, up) * (0.55 - 0.14 * uNight) * ao;
  vec3 diffuse = sun * ndl * shadow;

  // GGX specular lobe
  float alpha = max(0.02, roughness * roughness);
  vec3 halfVec = normalize(view + uSunDir);
  float ndh = max(dot(n, halfVec), 0.0);
  float denom = ndh * ndh * (alpha * alpha - 1.0) + 1.0;
  float distribution = (alpha * alpha) / (3.14159265 * denom * denom);
  float fresnel = reflectance + (1.0 - reflectance) * pow(1.0 - max(dot(view, n), 0.0), 5.0);
  vec3 specular = sun * shadow * ndl * distribution * fresnel;

  // Sky/ground reflection stands in for an environment probe
  vec3 bounce = mix(ground, sky, clamp(reflect(-view, n).y * 0.5 + 0.5, 0.0, 1.0));
  vec3 reflection = bounce * fresnel * ao * (1.0 - roughness) * 0.9;

  vec3 color = albedo * (ambient + diffuse) + specular + reflection;

  // Distance fog blends the city into the sky
  float dist = length(worldPos - uCameraPos);
  float fog = 1.0 - exp(-dist * uFogDensity);
  return mix(color, srgbToLinear(uFogColor), clamp(fog, 0.0, 0.82));
}

vec3 applyLighting(vec3 albedo, vec3 normal, vec3 worldPos, vec4 lightSpace, float shadowStrength) {
  return shade(albedo, normal, worldPos, lightSpace, shadowStrength, 1.0, 0.8, 0.04);
}

/** Perturb a normal from a height field sampled in screen space. */
vec3 bumpNormal(vec3 normal, vec3 worldPos, float height) {
  vec3 dpdx = dFdx(worldPos);
  vec3 dpdy = dFdy(worldPos);
  vec3 n = normalize(normal);
  vec3 r1 = cross(dpdy, n);
  vec3 r2 = cross(n, dpdx);
  float det = dot(dpdx, r1);
  if (abs(det) < 1e-8) return n;
  vec3 gradient = sign(det) * (dFdx(height) * r1 + dFdy(height) * r2);
  return normalize(abs(det) * n - gradient);
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
${COLOR_LIB}
${LIGHTING_LIB}

uniform sampler2DArray uAtlas;
uniform float uWindowGrid;   // window cells per world unit in the wall textures

// Textured facade: the atlas supplies brick / glass / panel detail plus a
// window mask, and windows light up individually at night.
vec3 facade(vec3 base, vec3 detail, float windowMask, vec2 uv, out float emissive) {
  emissive = 0.0;
  // Vertical grime: walls are dirtier and darker near their base
  float grime = mix(0.86, 1.0, smoothstep(0.0, 1.6, uv.y));
  vec3 wall = base * detail * grime;
  if (windowMask < 0.02) return wall;

  vec2 cell = floor(uv * uWindowGrid);
  vec2 seed = cell + floor(vWorld.xz * 3.17);
  float lit = hash21(seed);
  // Panes mirror the sky towards the top and show the dark interior lower down,
  // and no two are dressed alike
  float skyView = smoothstep(0.15, 0.95, fract(uv.y * uWindowGrid));
  vec3 interior = base * 0.08 + uSkyColor * 0.06 * (0.6 + hash21(seed + 7.3) * 0.8);
  vec3 glassDay = mix(interior, uSkyColor * 0.45, skyView);
  vec3 glassNight = mix(vec3(1.0, 0.84, 0.56), vec3(0.78, 0.86, 1.0), hash21(seed + 3.1) * 0.5);
  float litAtNight = step(0.52, lit) * uNight * windowMask * (0.55 + hash21(seed + 1.7) * 0.45);
  emissive = litAtNight;
  return mix(wall, mix(glassDay, glassNight, litAtNight), windowMask);
}

// Road surface: centre dashes plus solid edge lines, both worn by traffic.
vec3 road(vec3 base, vec3 detail, vec2 uv) {
  base *= detail;
  float centre = 1.0 - smoothstep(0.02, 0.035, abs(uv.x - 0.5));
  float dash = step(0.5, fract(uv.y * 3.0));
  float edges = 1.0 - smoothstep(0.03, 0.045, min(uv.x, 1.0 - uv.x));
  float wear = 0.55 + hash21(floor(vWorld.xz * 26.0)) * 0.45;
  float paint = clamp(centre * dash + edges * 0.7, 0.0, 1.0) * wear;
  // Polished wheel tracks either side of the centre line
  float tracks = smoothstep(0.16, 0.06, abs(abs(uv.x - 0.5) - 0.26));
  return mix(base * (1.0 - tracks * 0.12), vec3(0.74, 0.72, 0.63), paint);
}

void main() {
  vec4 material = vLayer >= 0.0 ? texture(uAtlas, vec3(vUv, vLayer)) : vec4(0.5, 0.5, 0.5, 0.0);
  vec3 detail = material.rgb * 2.0;
  float windowMask = material.a;

  vec3 albedo = vColor;
  float emissive = 0.0;
  float ao = 1.0;
  float roughness = layerRoughness(vLayer);
  float reflectance = 0.04;

  if (vFlag == SURFACE_FACADE) {
    albedo = facade(albedo, detail, windowMask, vUv, emissive);
    // Contact shading where the wall meets the ground
    ao = mix(0.62, 1.0, smoothstep(0.0, 0.6, vUv.y));
    roughness = mix(roughness, 0.06, windowMask);
    reflectance = mix(reflectance, 0.45, windowMask);
  } else if (vFlag == SURFACE_ROAD) {
    albedo = road(albedo, detail, vUv);
  } else {
    albedo *= detail;
    if (vLayer < 0.0) {
      // Untextured props still get a little per-tile variation
      albedo *= 0.94 + hash21(floor(vWorld.xz * 10.0)) * 0.12;
    }
  }

  // Texture detail doubles as a height field so surfaces catch light in relief
  float relief = windowMask > 0.5 ? 0.0 : dot(material.rgb, vec3(0.33)) * 0.02;
  vec3 normal = bumpNormal(vNormal, vWorld, relief);

  vec3 lit = shade(albedo, normal, vWorld, vLightSpace, 1.0, ao, roughness, reflectance);
  // Lit windows glow regardless of shadowing
  lit += srgbToLinear(albedo) * emissive * 2.4;
  fragColor = vec4(present(lit), 1.0);
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
${COLOR_LIB}
${LIGHTING_LIB}

void main() {
  vec3 viewDir = normalize(uCameraPos - vWorld);
  float fresnel = pow(1.0 - max(dot(viewDir, vWaveNormal), 0.0), 5.0);
  vec3 base = mix(vColor, uSkyColor * 0.75, 0.12 + fresnel * 0.6);

  // Specular sun glitter
  vec3 halfVec = normalize(viewDir + uSunDir);
  float spec = pow(max(dot(vWaveNormal, halfVec), 0.0), 220.0);

  vec3 lit = shade(base, vWaveNormal, vWorld, vec4(0.0), 0.0, 1.0, 0.08, 0.02);
  lit += srgbToLinear(uSunColor) * spec * 6.0 * (1.0 - uNight);
  fragColor = vec4(present(lit), 0.94);
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

${COLOR_LIB}

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
  float height = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 sky = mix(srgbToLinear(uHorizonColor), srgbToLinear(uZenithColor), pow(height, 0.55));

  // Aerial haze thickens towards the horizon
  float haze = pow(1.0 - clamp(dir.y, 0.0, 1.0), 6.0);
  sky = mix(sky, srgbToLinear(uHorizonColor) * 1.06, haze * 0.55);

  // Sun disc plus forward-scattering halo
  vec3 sun = srgbToLinear(uSunColor);
  float sunDot = max(dot(dir, uSunDir), 0.0);
  sky += sun * pow(sunDot, 1600.0) * 26.0;
  sky += sun * pow(sunDot, 12.0) * 0.35;

  // Stars at night, above the horizon only
  if (uNight > 0.05 && dir.y > 0.0) {
    vec3 cell = floor(dir * 240.0);
    float star = step(0.9985, hash31(cell));
    sky += vec3(star) * uNight * (0.35 + 0.65 * hash31(cell + 1.0));
  }

  fragColor = vec4(present(sky), 1.0);
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
${COLOR_LIB}
${LIGHTING_LIB}

void main() {
  // Car paint: smooth clearcoat, so it picks up sky reflections and a highlight
  vec3 lit = shade(vColor, vNormal, vWorld, vLightSpace, 1.0, 1.0, 0.22, 0.06);
  fragColor = vec4(present(lit), 1.0);
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
