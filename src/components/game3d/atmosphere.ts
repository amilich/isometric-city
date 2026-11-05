// Time-of-day lighting for the 3D view: sun position, light colors, sky
// gradient and fog, all derived from the game's visual hour.

export interface Atmosphere {
  /** Direction from the surface toward the sun (normalized). */
  sunDir: [number, number, number];
  sunColor: [number, number, number];
  skyColor: [number, number, number];
  groundColor: [number, number, number];
  zenithColor: [number, number, number];
  horizonColor: [number, number, number];
  fogColor: [number, number, number];
  /** 0 at midday, 1 in the middle of the night. */
  night: number;
}

type RGB = [number, number, number];

const mix = (a: RGB, b: RGB, t: number): RGB => {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
};

const DAY_SUN: RGB = [1.0, 0.96, 0.88];
const GOLDEN_SUN: RGB = [1.0, 0.66, 0.36];
const NIGHT_SUN: RGB = [0.16, 0.2, 0.34];

const DAY_ZENITH: RGB = [0.29, 0.55, 0.9];
const DAY_HORIZON: RGB = [0.72, 0.84, 0.95];
const DUSK_ZENITH: RGB = [0.22, 0.26, 0.52];
const DUSK_HORIZON: RGB = [0.95, 0.55, 0.35];
const NIGHT_ZENITH: RGB = [0.02, 0.03, 0.09];
const NIGHT_HORIZON: RGB = [0.08, 0.1, 0.2];

/**
 * Sun elevation over the day: below the horizon before 6am / after 8pm,
 * peaking around 1pm.
 */
export const computeAtmosphere = (hour: number): Atmosphere => {
  const dayProgress = (hour - 6) / 14; // 6am..8pm maps to 0..1
  const elevation = Math.sin(Math.PI * Math.min(1.4, Math.max(-0.4, dayProgress)));
  const azimuth = Math.PI * (0.25 + dayProgress);

  const horizontal = Math.max(0.12, Math.cos(Math.asin(Math.max(-1, Math.min(1, elevation)))));
  const sunDir: RGB = [Math.cos(azimuth) * horizontal, Math.max(-0.2, elevation), Math.sin(azimuth) * horizontal];
  const length = Math.hypot(sunDir[0], sunDir[1], sunDir[2]) || 1;
  sunDir[0] /= length;
  sunDir[1] /= length;
  sunDir[2] /= length;

  // 0 = broad daylight, 1 = deep night
  const night = 1 - Math.min(1, Math.max(0, (elevation + 0.12) / 0.42));
  // Warm light near sunrise/sunset
  const golden = Math.min(1, Math.max(0, 1 - Math.abs(elevation) / 0.35)) * (1 - night);

  const sunColor = mix(mix(DAY_SUN, GOLDEN_SUN, golden), NIGHT_SUN, night);
  const zenithColor = night > 0.5
    ? mix(DUSK_ZENITH, NIGHT_ZENITH, (night - 0.5) * 2)
    : mix(DAY_ZENITH, DUSK_ZENITH, night * 2);
  const horizonColor = night > 0.5
    ? mix(DUSK_HORIZON, NIGHT_HORIZON, (night - 0.5) * 2)
    : mix(DAY_HORIZON, DUSK_HORIZON, Math.max(golden, night * 2) * 0.8);

  return {
    sunDir,
    sunColor: [sunColor[0] * (1 - night * 0.75), sunColor[1] * (1 - night * 0.75), sunColor[2] * (1 - night * 0.6)],
    skyColor: mix(zenithColor, horizonColor, 0.5),
    groundColor: mix([0.32, 0.3, 0.26], [0.05, 0.06, 0.1], night),
    zenithColor,
    horizonColor,
    fogColor: mix(horizonColor, zenithColor, 0.25),
    night,
  };
};
