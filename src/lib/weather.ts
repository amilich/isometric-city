// Weather system for IsoCity
// Handles seasons, weather types, and their effects

import { Season, WeatherType, WeatherState, Stats } from '@/types/game';

// Season mapping based on months (Northern Hemisphere)
export function getSeasonFromMonth(month: number): Season {
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'fall';
  return 'winter'; // Dec, Jan, Feb
}

// Get day length based on season (affects visual day/night cycle)
export function getDayLengthForSeason(season: Season): number {
  switch (season) {
    case 'spring':
      return 12; // 12 hours daylight
    case 'summer':
      return 14; // 14 hours daylight (longer days)
    case 'fall':
      return 11; // 11 hours daylight
    case 'winter':
      return 9; // 9 hours daylight (shorter days)
  }
}

// Get base temperature for season
export function getBaseTemperatureForSeason(season: Season): number {
  switch (season) {
    case 'spring':
      return 15; // Mild
    case 'summer':
      return 25; // Warm
    case 'fall':
      return 12; // Cool
    case 'winter':
      return 2; // Cold
  }
}

// Weather probabilities by season
const WEATHER_PROBABILITIES: Record<Season, Record<WeatherType, number>> = {
  spring: {
    clear: 0.4,
    rain: 0.35,
    snow: 0.05,
    lightning: 0.15,
    heat: 0.05,
  },
  summer: {
    clear: 0.5,
    rain: 0.2,
    snow: 0.0,
    lightning: 0.2,
    heat: 0.1,
  },
  fall: {
    clear: 0.35,
    rain: 0.4,
    snow: 0.1,
    lightning: 0.1,
    heat: 0.05,
  },
  winter: {
    clear: 0.3,
    rain: 0.15,
    snow: 0.4,
    lightning: 0.05,
    heat: 0.1,
  },
};

// Get random weather based on season
export function getRandomWeatherForSeason(season: Season): WeatherType {
  const probs = WEATHER_PROBABILITIES[season];
  const rand = Math.random();
  let cumulative = 0;
  
  for (const [weather, prob] of Object.entries(probs)) {
    cumulative += prob;
    if (rand < cumulative) {
      return weather as WeatherType;
    }
  }
  
  return 'clear'; // Fallback
}

// Calculate weather intensity (0-1)
export function calculateWeatherIntensity(weather: WeatherType, season: Season): number {
  const baseIntensity = {
    clear: 0.0,
    rain: 0.5,
    snow: 0.6,
    lightning: 0.8,
    heat: 0.7,
  }[weather];
  
  // Add some variation
  const variation = (Math.random() - 0.5) * 0.3;
  return Math.max(0, Math.min(1, baseIntensity + variation));
}

// Calculate cloud cover based on weather
export function calculateCloudCover(weather: WeatherType, intensity: number): number {
  switch (weather) {
    case 'clear':
      return 0.1 + Math.random() * 0.2; // Light clouds
    case 'rain':
      return 0.7 + intensity * 0.3;
    case 'snow':
      return 0.8 + intensity * 0.2;
    case 'lightning':
      return 0.9 + intensity * 0.1;
    case 'heat':
      return 0.2 + Math.random() * 0.2; // Clear but hazy
    default:
      return 0.3;
  }
}

// Calculate temperature based on weather and season
export function calculateTemperature(
  season: Season,
  weather: WeatherType,
  intensity: number
): number {
  const baseTemp = getBaseTemperatureForSeason(season);
  let modifier = 0;
  
  switch (weather) {
    case 'clear':
      modifier = 2; // Slightly warmer
      break;
    case 'rain':
      modifier = -3; // Cooler
      break;
    case 'snow':
      modifier = -8; // Much colder
      break;
    case 'lightning':
      modifier = -2; // Slightly cooler
      break;
    case 'heat':
      modifier = 8; // Much warmer
      break;
  }
  
  // Add intensity-based variation
  const variation = (Math.random() - 0.5) * 5;
  return Math.round(baseTemp + modifier + variation);
}

// Get weather duration in ticks (30 ticks = 1 day)
export function getWeatherDuration(weather: WeatherType): number {
  const baseDuration = {
    clear: 150, // ~5 days
    rain: 60, // ~2 days
    snow: 90, // ~3 days
    lightning: 30, // ~1 day
    heat: 120, // ~4 days
  }[weather];
  
  // Add variation (±50%)
  const variation = baseDuration * 0.5 * (Math.random() - 0.5);
  return Math.max(15, Math.round(baseDuration + variation));
}

// Create initial weather state
export function createInitialWeatherState(month: number): WeatherState {
  const season = getSeasonFromMonth(month);
  const weather = getRandomWeatherForSeason(season);
  const intensity = calculateWeatherIntensity(weather, season);
  const cloudCover = calculateCloudCover(weather, intensity);
  const temperature = calculateTemperature(season, weather, intensity);
  const dayLength = getDayLengthForSeason(season);
  const weatherDuration = getWeatherDuration(weather);
  
  return {
    season,
    currentWeather: weather,
    intensity,
    cloudCover,
    temperature,
    dayLength,
    weatherDuration,
  };
}

// Update weather state (called each tick)
export function updateWeather(
  currentWeather: WeatherState,
  month: number
): WeatherState {
  const newSeason = getSeasonFromMonth(month);
  const seasonChanged = newSeason !== currentWeather.season;
  
  // Decrease weather duration
  let newDuration = currentWeather.weatherDuration - 1;
  let newWeather = currentWeather.currentWeather;
  let newIntensity = currentWeather.intensity;
  let newCloudCover = currentWeather.cloudCover;
  let newTemperature = currentWeather.temperature;
  
  // If weather duration expired or season changed, get new weather
  if (newDuration <= 0 || seasonChanged) {
    newWeather = getRandomWeatherForSeason(newSeason);
    newIntensity = calculateWeatherIntensity(newWeather, newSeason);
    newDuration = getWeatherDuration(newWeather);
  }
  
  // Update cloud cover and temperature based on current weather
  newCloudCover = calculateCloudCover(newWeather, newIntensity);
  newTemperature = calculateTemperature(newSeason, newWeather, newIntensity);
  
  const newDayLength = getDayLengthForSeason(newSeason);
  
  return {
    season: newSeason,
    currentWeather: newWeather,
    intensity: newIntensity,
    cloudCover: newCloudCover,
    temperature: newTemperature,
    dayLength: newDayLength,
    weatherDuration: newDuration,
  };
}

// Calculate economic effects of weather
export function calculateWeatherEconomicEffects(
  weather: WeatherState,
  baseStats: Stats
): { incomeModifier: number; expenseModifier: number; happinessModifier: number } {
  let incomeModifier = 1.0;
  let expenseModifier = 1.0;
  let happinessModifier = 0;
  
  switch (weather.currentWeather) {
    case 'clear':
      // Clear weather is neutral to slightly positive
      incomeModifier = 1.0;
      expenseModifier = 1.0;
      happinessModifier = 1;
      break;
      
    case 'rain':
      // Rain slightly reduces commercial activity but is neutral overall
      incomeModifier = 0.98; // -2% income
      expenseModifier = 1.01; // +1% expenses (maintenance)
      happinessModifier = -1;
      break;
      
    case 'snow':
      // Snow reduces activity significantly
      incomeModifier = 0.94; // -6% income
      expenseModifier = 1.03; // +3% expenses (snow removal, heating)
      happinessModifier = -2;
      break;
      
    case 'lightning':
      // Lightning storms can cause power issues
      incomeModifier = 0.96; // -4% income
      expenseModifier = 1.02; // +2% expenses (repairs)
      happinessModifier = -3;
      break;
      
    case 'heat':
      // Heat waves increase energy costs
      incomeModifier = 0.97; // -3% income
      expenseModifier = 1.04; // +4% expenses (cooling, AC)
      happinessModifier = -2;
      break;
  }
  
  // Scale by intensity
  const intensityFactor = weather.intensity;
  incomeModifier = 1.0 + (incomeModifier - 1.0) * intensityFactor;
  expenseModifier = 1.0 + (expenseModifier - 1.0) * intensityFactor;
  happinessModifier = Math.round(happinessModifier * intensityFactor);
  
  return { incomeModifier, expenseModifier, happinessModifier };
}
