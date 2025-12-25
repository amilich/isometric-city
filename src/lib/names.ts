// Name generation utilities for cities and water bodies

const CITY_NAME_PARTS = [
  'Spring', 'Riverside', 'Harbor', 'Valley', 'Hill', 'Bay', 'Creek', 'Park',
  'Lake', 'Mountain', 'Beach', 'Forest', 'Bridge', 'Port', 'View', 'Heights',
  'Grove', 'Meadow', 'Ridge', 'Point', 'Falls', 'Brook', 'Pine', 'Oak',
  'Maple', 'Cedar', 'Elm', 'Willow', 'Ash', 'Birch', 'Green', 'Blue',
  'White', 'Black', 'Red', 'New', 'Old', 'East', 'West', 'North', 'South',
  'Grand', 'Little', 'Big', 'Upper', 'Lower', 'Central', 'Fair', 'Bright',
  'Sunny', 'Clear', 'Rock', 'Stone', 'Iron', 'Gold', 'Silver', 'Copper',
  'Mill', 'Town', 'City', 'Ville', 'Burg', 'Field', 'Land', 'Wood',
];

const CITY_SUFFIXES = [
  'City', 'Town', 'Ville', 'Burg', 'Port', 'Harbor', 'Bay', 'Beach',
  'Park', 'Heights', 'Hills', 'Valley', 'Ridge', 'Point', 'Falls',
  'Springs', 'Grove', 'Meadow', 'Field', 'Woods', 'Lake', 'River',
];

const LAKE_NAMES = [
  'Van Gölü', 'Tuz Gölü', 'Beyşehir Gölü', 'Eğirdir Gölü', 'İznik Gölü',
  'Sapanca Gölü', 'Manyas Gölü', 'Uluabat Gölü', 'Acıgöl', 'Bafa Gölü',
  'Burdur Gölü', 'Haçlı Gölü', 'Çıldır Gölü', 'Hazar Gölü', 'Atatürk Baraj Gölü',
  'Keban Baraj Gölü', 'Altınkaya Baraj Gölü', 'Seyhan Baraj Gölü', 'Yedigöller',
  'Akgöl', 'Mogan Gölü', 'Eymir Gölü', 'Salda Gölü', 'Karagöl',
  'Nemrut Krater Gölü', 'Sera Gölü', 'Kovada Gölü', 'Karagöl (Artvin)',
  'Borabay Gölü', 'Nazik Gölü', 'Sünnet Gölü', 'Çekerek Baraj Gölü', 'Terkos Gölü',
  'Hanyeri Baraj Gölü', 'Gala Gölü', 'Kuş Gölü', 'Yarışlı Gölü', 'Aynalıgöl',
  'Balık Gölü', 'Ulugöl', 'Aygır Gölü', 'Dokuzhamam Gölü', 'Karadağ Gölü',
  'Sülüklü Göl', 'Gökpınar Gölü', 'Turna Gölü', 'Yılankale Gölü', 'Büyükçekmece Gölü',
  'Küçükçekmece Gölü', 'Kızılırmak Delta Gölleri', 'Büyük Akgöl', 'Kara Göl',
  'Avlan Gölü', 'Büyük Deniz Gölü', 'Yedigöller', 'Büyük Göl', 'Küçük Göl',
];

const OCEAN_NAMES = [
  'Pasifik Okyanusu', 'Atlas Okyanusu', 'Kuzey Buz Denizi', 'Hint Okyanusu',
  'Güney Okyanusu', 'Akdeniz', 'Karayip Denizi', 'Kuzey Denizi',
  'Baltık Denizi', 'Karadeniz', 'Kızıldeniz', 'Hazar Denizi', 'Aral Gölü',
  'Bering Denizi', 'Japon Denizi', 'Doğu Çin Denizi', 'Güney Çin Denizi',
  'Sarı Deniz', 'Filipin Denizi', 'Mercan Denizi', 'Tazmanya Denizi', 'Arap Denizi',
  'Bengal Körfezi', 'Meksika Körfezi', 'Basra Körfezi', 'Alaska Körfezi',
  'Hudson Körfezi', 'Baffin Körfezi', 'Davis Boğazı', 'Danimarka Boğazı',
  'Büyük Koy', 'Ulu Koy', 'Kraliyet Koyu', 'İhtişamlı Koy', 'Asil Koy',
  'Kadim Deniz', 'Ezelî Deniz', 'Sonsuz Deniz', 'Sınırsız Deniz', 'Uçsuz Deniz',
  'Engin Deniz', 'Kristal Deniz', 'Zümrüt Deniz', 'Safir Deniz', 'Masmavi Deniz',
  'Turkuaz Deniz', 'Kuzey Denizi', 'Güney Denizi', 'Doğu Denizi', 'Batı Denizi',
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
