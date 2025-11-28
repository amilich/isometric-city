/**
 * Weather System for IsoCity
 * 
 * Handles seasons, weather generation, day length, and economic effects.
 */

import { Season, WeatherType, WeatherState, SeasonInfo } from '@/types/game';

// ============================================================================
// Season Configuration
// ============================================================================

/**
 * Map months to seasons
 * 1-2: Winter, 3-5: Spring, 6-8: Summer, 9-11: Fall, 12: Winter
 */
export function getSeasonFromMonth(month: number): Season {
  if (month === 12 || month <= 2) return 'winter';
  if (month <= 5) return 'spring';
  if (month <= 8) return 'summer';
  return 'fall';
}

/**
 * Season-specific configurations
 */
export const SEASON_CONFIG: Record<Season, SeasonInfo> = {
  spring: {
    season: 'spring',
    dayLength: 13,        // 13 hours of daylight
    baseTemperature: 15,  // Mild
  },
  summer: {
    season: 'summer',
    dayLength: 16,        // Long days
    baseTemperature: 28,  // Hot
  },
  fall: {
    season: 'fall',
    dayLength: 11,        // Shortening days
    baseTemperature: 12,  // Cool
  },
  winter: {
    season: 'winter',
    dayLength: 8,         // Short days
    baseTemperature: -2,  // Cold
  },
};

// ============================================================================
// Weather Probabilities by Season
// ============================================================================

/**
 * Weather type probabilities for each season (must sum to 1.0)
 */
const WEATHER_PROBABILITIES: Record<Season, Record<WeatherType, number>> = {
  spring: {
    clear: 0.35,
    cloudy: 0.25,
    rain: 0.30,
    storm: 0.10,
    snow: 0,      // No snow in spring
    heatwave: 0,  // No heatwave in spring
  },
  summer: {
    clear: 0.50,
    cloudy: 0.15,
    rain: 0.15,
    storm: 0.10,
    snow: 0,       // No snow in summer
    heatwave: 0.10, // Heatwaves possible
  },
  fall: {
    clear: 0.30,
    cloudy: 0.35,
    rain: 0.25,
    storm: 0.08,
    snow: 0.02,   // Rare early snow
    heatwave: 0,  // No heatwave in fall
  },
  winter: {
    clear: 0.25,
    cloudy: 0.30,
    rain: 0.10,
    storm: 0.05,
    snow: 0.30,   // Common snow
    heatwave: 0,  // No heatwave in winter
  },
};

/**
 * Base duration (in ticks) for each weather type
 * Actual duration is randomized around this value
 */
const WEATHER_BASE_DURATION: Record<WeatherType, number> = {
  clear: 600,     // ~20 game days (long stretches of good weather)
  cloudy: 300,    // ~10 game days
  rain: 150,      // ~5 game days
  storm: 60,      // ~2 game days (storms are shorter)
  snow: 200,      // ~6-7 game days
  heatwave: 120,  // ~4 game days
};

// ============================================================================
// Weather Generation
// ============================================================================

/**
 * Generate a new weather type based on current season
 */
export function generateWeatherType(season: Season): WeatherType {
  const probabilities = WEATHER_PROBABILITIES[season];
  const random = Math.random();
  
  let cumulative = 0;
  for (const [weatherType, probability] of Object.entries(probabilities)) {
    cumulative += probability;
    if (random < cumulative) {
      return weatherType as WeatherType;
    }
  }
  
  return 'clear'; // Fallback
}

/**
 * Generate weather intensity (0-1)
 * Higher intensity = more visual effects and economic impact
 */
export function generateWeatherIntensity(type: WeatherType): number {
  switch (type) {
    case 'clear':
      return 0;
    case 'cloudy':
      return 0.3 + Math.random() * 0.4; // 0.3-0.7
    case 'rain':
      return 0.4 + Math.random() * 0.4; // 0.4-0.8
    case 'storm':
      return 0.7 + Math.random() * 0.3; // 0.7-1.0
    case 'snow':
      return 0.3 + Math.random() * 0.5; // 0.3-0.8
    case 'heatwave':
      return 0.6 + Math.random() * 0.4; // 0.6-1.0
    default:
      return 0;
  }
}

/**
 * Generate weather duration in ticks with randomization
 */
export function generateWeatherDuration(type: WeatherType): number {
  const baseDuration = WEATHER_BASE_DURATION[type];
  // Randomize between 60% and 140% of base duration
  return Math.floor(baseDuration * (0.6 + Math.random() * 0.8));
}

/**
 * Get cloud coverage for a weather type
 */
export function getCloudCoverage(type: WeatherType, intensity: number): number {
  switch (type) {
    case 'clear':
      return Math.random() * 0.1; // 0-10% scattered clouds
    case 'cloudy':
      return 0.4 + intensity * 0.3; // 40-70%
    case 'rain':
      return 0.6 + intensity * 0.3; // 60-90%
    case 'storm':
      return 0.85 + intensity * 0.15; // 85-100%
    case 'snow':
      return 0.5 + intensity * 0.4; // 50-90%
    case 'heatwave':
      return Math.random() * 0.2; // 0-20% (clear hot sky)
    default:
      return 0;
  }
}

/**
 * Get temperature modifier for weather type
 */
export function getTemperatureModifier(type: WeatherType, intensity: number): number {
  switch (type) {
    case 'clear':
      return 2; // Slightly warmer
    case 'cloudy':
      return -2; // Slightly cooler
    case 'rain':
      return -4 - intensity * 4; // -4 to -8
    case 'storm':
      return -6 - intensity * 6; // -6 to -12
    case 'snow':
      return -8 - intensity * 8; // -8 to -16 (very cold)
    case 'heatwave':
      return 10 + intensity * 10; // +10 to +20 (very hot)
    default:
      return 0;
  }
}

/**
 * Create initial weather state for a given month
 */
export function createInitialWeather(month: number): WeatherState {
  const season = getSeasonFromMonth(month);
  const type = generateWeatherType(season);
  const intensity = generateWeatherIntensity(type);
  
  return {
    type,
    intensity,
    duration: generateWeatherDuration(type),
    lightningTimer: type === 'storm' ? Math.floor(30 + Math.random() * 60) : 0,
    cloudCoverage: getCloudCoverage(type, intensity),
    temperature: getTemperatureModifier(type, intensity),
    snowAccumulation: 0,
  };
}

/**
 * Generate new weather when current weather expires
 */
export function generateNewWeather(month: number, previousType: WeatherType): WeatherState {
  const season = getSeasonFromMonth(month);
  let newType = generateWeatherType(season);
  
  // Reduce chance of same weather type repeating (weather variety)
  if (newType === previousType && Math.random() < 0.5) {
    newType = generateWeatherType(season);
  }
  
  const intensity = generateWeatherIntensity(newType);
  
  return {
    type: newType,
    intensity,
    duration: generateWeatherDuration(newType),
    lightningTimer: newType === 'storm' ? Math.floor(30 + Math.random() * 60) : 0,
    cloudCoverage: getCloudCoverage(newType, intensity),
    temperature: getTemperatureModifier(newType, intensity),
    snowAccumulation: 0, // Will accumulate over time if snowing
  };
}

// ============================================================================
// Weather Effects
// ============================================================================

/**
 * Economic effects of weather on the city
 */
export interface WeatherEconomicEffects {
  demandModifier: number;        // Multiplier for zone demand (0.8-1.2)
  happinessModifier: number;     // Additive modifier for happiness (-10 to +5)
  incomeModifier: number;        // Multiplier for tax income (0.85-1.1)
  constructionSpeedModifier: number; // Multiplier for construction (0.5-1.0)
  fireRiskModifier: number;      // Multiplier for fire chance (0.5-2.0)
}

/**
 * Calculate economic effects based on current weather
 */
export function calculateWeatherEffects(weather: WeatherState, season: Season): WeatherEconomicEffects {
  const { type, intensity } = weather;
  
  let effects: WeatherEconomicEffects = {
    demandModifier: 1.0,
    happinessModifier: 0,
    incomeModifier: 1.0,
    constructionSpeedModifier: 1.0,
    fireRiskModifier: 1.0,
  };
  
  switch (type) {
    case 'clear':
      effects.demandModifier = 1.05; // Good weather boosts demand slightly
      effects.happinessModifier = 3;
      effects.incomeModifier = 1.02;
      effects.constructionSpeedModifier = 1.0;
      effects.fireRiskModifier = season === 'summer' ? 1.3 : 1.0;
      break;
      
    case 'cloudy':
      effects.demandModifier = 0.98;
      effects.happinessModifier = 0;
      effects.incomeModifier = 1.0;
      effects.constructionSpeedModifier = 0.95;
      effects.fireRiskModifier = 0.9;
      break;
      
    case 'rain':
      effects.demandModifier = 0.92 - intensity * 0.05; // 0.87-0.92
      effects.happinessModifier = -3 - Math.floor(intensity * 3); // -3 to -6
      effects.incomeModifier = 0.95 - intensity * 0.05; // 0.90-0.95
      effects.constructionSpeedModifier = 0.7 - intensity * 0.2; // 0.5-0.7
      effects.fireRiskModifier = 0.5;
      break;
      
    case 'storm':
      effects.demandModifier = 0.85 - intensity * 0.1; // 0.75-0.85
      effects.happinessModifier = -6 - Math.floor(intensity * 4); // -6 to -10
      effects.incomeModifier = 0.88 - intensity * 0.08; // 0.80-0.88
      effects.constructionSpeedModifier = 0.3; // Very slow construction
      effects.fireRiskModifier = 0.3; // Low fire risk (wet)
      break;
      
    case 'snow':
      effects.demandModifier = 0.88 - intensity * 0.08; // 0.80-0.88
      effects.happinessModifier = intensity > 0.5 ? -4 : 2; // Heavy snow = unhappy, light snow = festive
      effects.incomeModifier = 0.90 - intensity * 0.05; // 0.85-0.90
      effects.constructionSpeedModifier = 0.4 - intensity * 0.2; // 0.2-0.4
      effects.fireRiskModifier = 0.6;
      break;
      
    case 'heatwave':
      effects.demandModifier = 0.90 - intensity * 0.1; // 0.80-0.90
      effects.happinessModifier = -5 - Math.floor(intensity * 5); // -5 to -10
      effects.incomeModifier = 0.92; // AC costs, etc.
      effects.constructionSpeedModifier = 0.6; // Heat slows work
      effects.fireRiskModifier = 1.8 + intensity * 0.4; // 1.8-2.2 (high fire risk)
      break;
  }
  
  return effects;
}

// ============================================================================
// Day Length / Lighting
// ============================================================================

/**
 * Calculate sunrise and sunset hours based on season
 */
export function getDaylightHours(season: Season): { sunrise: number; sunset: number } {
  const config = SEASON_CONFIG[season];
  const dayLength = config.dayLength;
  
  // Center the daylight around noon (12:00)
  const halfDay = dayLength / 2;
  const sunrise = Math.floor(12 - halfDay);
  const sunset = Math.ceil(12 + halfDay);
  
  return { sunrise, sunset };
}

/**
 * Calculate ambient light level (0-1) based on hour and season
 * Used for day/night cycle rendering
 */
export function getAmbientLight(hour: number, season: Season, cloudCoverage: number): number {
  const { sunrise, sunset } = getDaylightHours(season);
  
  let baseLightLevel: number;
  
  if (hour < sunrise - 1) {
    // Night
    baseLightLevel = 0.15;
  } else if (hour < sunrise) {
    // Dawn
    const progress = hour - (sunrise - 1);
    baseLightLevel = 0.15 + progress * 0.35; // 0.15 -> 0.5
  } else if (hour < sunrise + 1) {
    // Early morning
    const progress = hour - sunrise;
    baseLightLevel = 0.5 + progress * 0.3; // 0.5 -> 0.8
  } else if (hour < sunset - 1) {
    // Day
    baseLightLevel = 0.95;
  } else if (hour < sunset) {
    // Late afternoon
    const progress = hour - (sunset - 1);
    baseLightLevel = 0.95 - progress * 0.15; // 0.95 -> 0.8
  } else if (hour < sunset + 1) {
    // Dusk
    const progress = hour - sunset;
    baseLightLevel = 0.8 - progress * 0.5; // 0.8 -> 0.3
  } else {
    // Night
    baseLightLevel = 0.15;
  }
  
  // Clouds reduce light level during day
  const cloudReduction = cloudCoverage * 0.25;
  
  return Math.max(0.1, baseLightLevel - cloudReduction);
}

/**
 * Get sky color based on time and weather
 */
export function getSkyColor(hour: number, season: Season, weather: WeatherState): string {
  const { sunrise, sunset } = getDaylightHours(season);
  const { type, cloudCoverage } = weather;
  
  // Base sky colors
  let r: number, g: number, b: number;
  
  if (hour < sunrise - 1 || hour >= sunset + 1) {
    // Night sky
    r = 10; g = 15; b = 35;
  } else if (hour < sunrise || hour >= sunset) {
    // Dawn/dusk
    r = 255; g = 150; b = 100;
  } else {
    // Day sky
    r = 135; g = 206; b = 235;
  }
  
  // Weather modifications
  if (type === 'storm') {
    r = Math.floor(r * 0.4);
    g = Math.floor(g * 0.4);
    b = Math.floor(b * 0.5);
  } else if (type === 'rain' || type === 'snow') {
    const factor = 1 - cloudCoverage * 0.3;
    r = Math.floor(r * factor + 80 * (1 - factor));
    g = Math.floor(g * factor + 80 * (1 - factor));
    b = Math.floor(b * factor + 90 * (1 - factor));
  } else if (type === 'cloudy') {
    const factor = 1 - cloudCoverage * 0.2;
    r = Math.floor(r * factor + 120 * (1 - factor));
    g = Math.floor(g * factor + 120 * (1 - factor));
    b = Math.floor(b * factor + 130 * (1 - factor));
  } else if (type === 'heatwave' && hour >= sunrise && hour < sunset) {
    // Hazy, yellowish tint
    r = Math.min(255, r + 30);
    g = Math.min(255, g + 15);
    b = Math.max(0, b - 20);
  }
  
  return `rgb(${r}, ${g}, ${b})`;
}

// ============================================================================
// Weather Update Logic
// ============================================================================

/**
 * Update weather state for a single tick
 */
export function updateWeather(weather: WeatherState, month: number): WeatherState {
  const newWeather = { ...weather };
  
  // Decrement duration
  newWeather.duration = Math.max(0, newWeather.duration - 1);
  
  // Update lightning timer for storms
  if (newWeather.type === 'storm') {
    newWeather.lightningTimer = Math.max(0, newWeather.lightningTimer - 1);
    if (newWeather.lightningTimer === 0) {
      // Reset timer for next lightning (random interval)
      newWeather.lightningTimer = Math.floor(20 + Math.random() * 80);
    }
  }
  
  // Update snow accumulation
  if (newWeather.type === 'snow') {
    // Snow accumulates slowly
    newWeather.snowAccumulation = Math.min(1, newWeather.snowAccumulation + 0.002 * newWeather.intensity);
  } else if (newWeather.snowAccumulation > 0) {
    // Snow melts slowly (faster in warmer weather)
    const season = getSeasonFromMonth(month);
    const meltRate = season === 'winter' ? 0.0005 : 
                     season === 'spring' ? 0.002 : 0.005;
    newWeather.snowAccumulation = Math.max(0, newWeather.snowAccumulation - meltRate);
  }
  
  // Generate new weather if current weather expired
  if (newWeather.duration <= 0) {
    return generateNewWeather(month, newWeather.type);
  }
  
  return newWeather;
}

// ============================================================================
// Weather Display Helpers
// ============================================================================

/**
 * Get human-readable weather description
 */
export function getWeatherDescription(weather: WeatherState, season: Season): string {
  const { type, intensity, temperature } = weather;
  const seasonConfig = SEASON_CONFIG[season];
  const actualTemp = Math.round(seasonConfig.baseTemperature + temperature);
  
  let desc = '';
  
  switch (type) {
    case 'clear':
      desc = season === 'winter' ? 'Clear and cold' : 'Clear skies';
      break;
    case 'cloudy':
      desc = intensity > 0.5 ? 'Overcast' : 'Partly cloudy';
      break;
    case 'rain':
      desc = intensity > 0.6 ? 'Heavy rain' : 'Light rain';
      break;
    case 'storm':
      desc = 'Thunderstorm';
      break;
    case 'snow':
      desc = intensity > 0.6 ? 'Heavy snowfall' : 'Light snow';
      break;
    case 'heatwave':
      desc = 'Heat wave';
      break;
  }
  
  return `${desc} (${actualTemp}°C)`;
}

/**
 * Get weather icon name for UI display
 */
export function getWeatherIcon(type: WeatherType): string {
  switch (type) {
    case 'clear': return 'sun';
    case 'cloudy': return 'cloud';
    case 'rain': return 'cloud-rain';
    case 'storm': return 'cloud-lightning';
    case 'snow': return 'cloud-snow';
    case 'heatwave': return 'thermometer';
    default: return 'sun';
  }
}
