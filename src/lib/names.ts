// Name generation utilities for cities and water bodies

const CITY_NAME_PARTS = [
  'Spring', 'River', 'Harbor', 'Valley', 'Hill', 'Bay', 'Creek', 'Park',
  'Lake', 'Mountain', 'Beach', 'Forest', 'Bridge', 'Dock', 'View', 'Heights',
  'Grove', 'Meadow', 'Ridge', 'Cape', 'Falls', 'Springs', 'Pine', 'Oak',
  'Maple', 'Cedar', 'Elm', 'Willow', 'Ash', 'Birch', 'Green', 'Blue',
  'White', 'Black', 'Red', 'New', 'Old', 'East', 'West', 'North', 'South',
  'Grand', 'Little', 'Upper', 'Lower', 'Central', 'Fair', 'Bright',
  'Sunny', 'Clear', 'Rock', 'Stone', 'Iron', 'Gold', 'Silver', 'Copper',
  'Mill', 'Town', 'City', 'Village', 'Shire', 'Field', 'Land', 'Wood',
];

const CITY_SUFFIXES = [
  'City', 'Town', 'Village', 'Shire', 'Harbor', 'Port', 'Bay', 'Beach',
  'Park', 'Heights', 'Hills', 'Valley', 'Ridge', 'Point', 'Falls',
  'Springs', 'Grove', 'Meadow', 'Field', 'Woods', 'Lake', 'River',
];

const LAKE_NAMES = [
  'Crystal Lake', 'Mirror Lake', 'Silver Lake', 'Blue Lake', 'Green Lake',
  'Swan Lake', 'Eagle Lake', 'Deer Lake', 'Bear Lake', 'Wolf Lake',
  'Pine Lake', 'Oak Lake', 'Maple Lake', 'Cedar Lake', 'Willow Lake',
  'Clear Lake', 'Hidden Lake', 'Lost Lake', 'Shadow Lake', 'Sunset Lake',
  'Sunrise Lake', 'Golden Lake', 'Diamond Lake', 'Emerald Lake', 'Sapphire Lake',
  'Moonlight Lake', 'Starlight Lake', 'Echo Lake', 'Whisper Lake', 'Dream Lake',
  'Paradise Lake', 'Serenity Lake', 'Tranquil Lake', 'Peaceful Lake', 'Harmony Lake',
  'North Lake', 'South Lake', 'East Lake', 'West Lake', 'Central Lake',
  'Grand Lake', 'Little Lake', 'Upper Lake', 'Lower Lake', 'Twin Lakes',
  'Three Lakes', 'Mountain Lake', 'Valley Lake', 'Forest Lake', 'Meadow Lake',
];

const OCEAN_NAMES = [
  'Pacific Ocean', 'Atlantic Ocean', 'Arctic Ocean', 'Indian Ocean',
  'Southern Ocean', 'Mediterranean Sea', 'Caribbean Sea', 'North Sea',
  'Baltic Sea', 'Black Sea', 'Red Sea', 'Caspian Sea', 'Aral Sea',
  'Bering Sea', 'Japan Sea', 'East China Sea', 'South China Sea',
  'Yellow Sea', 'Philippine Sea', 'Coral Sea', 'Tasman Sea', 'Arabian Sea',
  'Bay of Bengal', 'Gulf of Mexico', 'Persian Gulf', 'Gulf of Alaska',
  'Hudson Bay', 'Baffin Bay', 'Davis Strait', 'Denmark Strait',
  'Grand Bay', 'Royal Bay', 'Majestic Bay', 'Noble Bay', 'Ancient Bay',
  'Eternal Sea', 'Infinite Sea', 'Boundless Sea', 'Endless Sea', 'Vast Sea',
  'Crystal Sea', 'Emerald Sea', 'Sapphire Sea', 'Azure Sea', 'Turquoise Sea',
  'Northern Sea', 'Southern Sea', 'Eastern Sea', 'Western Sea', 'Central Sea',
];

export function generateCityName(): string {
  const part1 = CITY_NAME_PARTS[Math.floor(Math.random() * CITY_NAME_PARTS.length)];
  const part2 = CITY_NAME_PARTS[Math.floor(Math.random() * CITY_NAME_PARTS.length)];
  const suffix = CITY_SUFFIXES[Math.floor(Math.random() * CITY_SUFFIXES.length)];
  
  // Sometimes use two parts, sometimes one part + suffix
  if (Math.random() > 0.5) {
    return `${part1} ${suffix}`;
  } else {
    // Avoid duplicate parts
    if (part1 === part2) {
      return `${part1} ${suffix}`;
    }
    return `${part1}${part2} ${suffix}`;
  }
}

export function generateWaterName(type: 'lake' | 'ocean'): string {
  const filtered = type === 'lake' ? LAKE_NAMES : OCEAN_NAMES;
  return filtered[Math.floor(Math.random() * filtered.length)];
}
