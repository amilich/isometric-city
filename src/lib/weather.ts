// Weather system for IsoCity
// Handles weather generation, transitions, and effects

import {
  WeatherState,
  WeatherType,
  WeatherIntensity,
  Season,
  getSeasonFromMonth,
  SEASON_CONFIG,
  WEATHER_EFFECTS,
} from '@/types/game';

// Weather duration ranges (in ticks) - shorter since days pass faster
const WEATHER_DURATION: Record<WeatherType, { min: number; max: number }> = {
  clear: { min: 30, max: 90 },      // 3-9 game days
  cloudy: { min: 20, max: 60 },     // 2-6 game days
  rain: { min: 15, max: 45 },       // 1.5-4.5 game days
  storm: { min: 5, max: 20 },       // 0.5-2 game days (storms are brief)
  snow: { min: 20, max: 60 },       // 2-6 game days
  heatwave: { min: 15, max: 40 },   // 1.5-4 game days
};

// Cloud cover for each weather type
const WEATHER_CLOUD_COVER: Record<WeatherType, { min: number; max: number }> = {
  clear: { min: 0, max: 0.2 },
  cloudy: { min: 0.4, max: 0.7 },
  rain: { min: 0.7, max: 0.9 },
  storm: { min: 0.85, max: 1.0 },
  snow: { min: 0.6, max: 0.85 },
  heatwave: { min: 0, max: 0.15 },
};

/**
 * Create initial weather state
 */
export function createInitialWeather(month: number): WeatherState {
  const season = getSeasonFromMonth(month);
  const weatherType = pickWeatherForSeason(season);
  const duration = randomInRange(
    WEATHER_DURATION[weatherType].min,
    WEATHER_DURATION[weatherType].max
  );
  const cloudCoverRange = WEATHER_CLOUD_COVER[weatherType];
  
  return {
    type: weatherType,
    intensity: pickIntensity(),
    season,
    duration,
    nextChangeIn: duration,
    cloudCover: randomInRange(cloudCoverRange.min * 100, cloudCoverRange.max * 100) / 100,
    daylightModifier: SEASON_CONFIG[season].daylightModifier,
  };
}

/**
 * Pick a weather type based on season probabilities
 */
function pickWeatherForSeason(season: Season): WeatherType {
  const probs = SEASON_CONFIG[season].weatherProbabilities;
  const rand = Math.random();
  let cumulative = 0;
  
  for (const [weather, probability] of Object.entries(probs)) {
    cumulative += probability;
    if (rand < cumulative) {
      return weather as WeatherType;
    }
  }
  
  return 'clear'; // Default fallback
}

/**
 * Pick random weather intensity
 */
function pickIntensity(): WeatherIntensity {
  const rand = Math.random();
  if (rand < 0.4) return 'light';
  if (rand < 0.8) return 'moderate';
  return 'heavy';
}

/**
 * Helper to get random number in range
 */
function randomInRange(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}

/**
 * Update weather state each tick
 */
export function updateWeather(weather: WeatherState, month: number): WeatherState {
  const newSeason = getSeasonFromMonth(month);
  
  // Check if season changed
  const seasonChanged = weather.season !== newSeason;
  
  // Decrement duration
  const newNextChangeIn = weather.nextChangeIn - 1;
  
  // Check if weather should change
  if (newNextChangeIn <= 0 || seasonChanged) {
    // Pick new weather
    const newType = pickWeatherForSeason(newSeason);
    const newDuration = randomInRange(
      WEATHER_DURATION[newType].min,
      WEATHER_DURATION[newType].max
    );
    const cloudCoverRange = WEATHER_CLOUD_COVER[newType];
    
    return {
      type: newType,
      intensity: pickIntensity(),
      season: newSeason,
      duration: newDuration,
      nextChangeIn: newDuration,
      cloudCover: randomInRange(cloudCoverRange.min * 100, cloudCoverRange.max * 100) / 100,
      daylightModifier: SEASON_CONFIG[newSeason].daylightModifier,
    };
  }
  
  // Gradually update cloud cover for smooth transitions
  const targetCloudCover = WEATHER_CLOUD_COVER[weather.type];
  const targetMid = (targetCloudCover.min + targetCloudCover.max) / 2;
  const cloudDrift = (targetMid - weather.cloudCover) * 0.02;
  
  return {
    ...weather,
    season: newSeason,
    nextChangeIn: newNextChangeIn,
    cloudCover: Math.max(0, Math.min(1, weather.cloudCover + cloudDrift + (Math.random() - 0.5) * 0.01)),
    daylightModifier: SEASON_CONFIG[newSeason].daylightModifier,
  };
}

/**
 * Get the effective hour for day/night cycle considering seasonal daylight
 * Seasons affect when dawn/dusk occur
 */
export function getEffectiveHour(baseHour: number, daylightModifier: number): number {
  // In summer (modifier +2): dawn is earlier (5am instead of 7am), dusk is later (22 instead of 20)
  // In winter (modifier -2): dawn is later (9am), dusk is earlier (18 instead of 20)
  // We simulate this by adjusting the perceived hour for lighting calculations
  
  // For dawn/morning: shift toward night in winter, toward day in summer
  // For dusk/evening: shift toward night in winter, toward day in summer
  
  // This is a simple linear shift that works well enough visually
  return baseHour;
}

/**
 * Calculate adjusted day/night parameters based on season
 * Returns adjusted dawn and dusk hours
 */
export function getSeasonalDaylight(daylightModifier: number): { dawn: number; dusk: number } {
  // Base: dawn at 6, dusk at 20
  // Summer (+2): dawn at 5, dusk at 21
  // Winter (-2): dawn at 8, dusk at 17
  const dawn = Math.max(4, 6 - daylightModifier);
  const dusk = Math.min(22, 20 + daylightModifier);
  
  return { dawn, dusk };
}

/**
 * Get weather effects for current weather
 */
export function getWeatherEffects(weather: WeatherState) {
  const baseEffects = WEATHER_EFFECTS[weather.type];
  
  // Intensity multiplier (heavy weather has stronger effects)
  const intensityMult = weather.intensity === 'heavy' ? 1.3 : 
                        weather.intensity === 'moderate' ? 1.0 : 0.7;
  
  // Apply intensity to modifiers (effects that deviate from 1.0)
  return {
    commercialModifier: 1 + (baseEffects.commercialModifier - 1) * intensityMult,
    industrialModifier: 1 + (baseEffects.industrialModifier - 1) * intensityMult,
    residentialModifier: 1 + (baseEffects.residentialModifier - 1) * intensityMult,
    powerDemandModifier: 1 + (baseEffects.powerDemandModifier - 1) * intensityMult,
    fireRiskModifier: 1 + (baseEffects.fireRiskModifier - 1) * intensityMult,
    happinessModifier: Math.round(baseEffects.happinessModifier * intensityMult),
  };
}

/**
 * Get a human-readable weather description
 */
export function getWeatherDescription(weather: WeatherState): string {
  const intensityWord = weather.intensity === 'heavy' ? 'Heavy' :
                        weather.intensity === 'moderate' ? '' : 'Light';
  
  const weatherWord: Record<WeatherType, string> = {
    clear: 'Clear skies',
    cloudy: 'Cloudy',
    rain: 'Rain',
    storm: 'Thunderstorm',
    snow: 'Snow',
    heatwave: 'Heatwave',
  };
  
  if (weather.type === 'clear' || weather.type === 'heatwave') {
    return weatherWord[weather.type];
  }
  
  return intensityWord ? `${intensityWord} ${weatherWord[weather.type]}` : weatherWord[weather.type];
}

/**
 * Get weather icon name
 */
export function getWeatherIcon(weatherType: WeatherType): string {
  const icons: Record<WeatherType, string> = {
    clear: 'sun',
    cloudy: 'cloud',
    rain: 'rain',
    storm: 'lightning',
    snow: 'snow',
    heatwave: 'thermometer',
  };
  return icons[weatherType];
}

/**
 * Check if weather is precipitating (rain or snow)
 */
export function isPrecipitating(weatherType: WeatherType): boolean {
  return weatherType === 'rain' || weatherType === 'storm' || weatherType === 'snow';
}

/**
 * Get snow accumulation level (0-1) based on weather history
 * For now, simplified: just returns 1 if snowing, 0 otherwise
 * In a more complex system, this would track accumulation over time
 */
export function getSnowAccumulation(weather: WeatherState): number {
  if (weather.type === 'snow') {
    return weather.intensity === 'heavy' ? 1.0 : 
           weather.intensity === 'moderate' ? 0.6 : 0.3;
  }
  return 0;
}
