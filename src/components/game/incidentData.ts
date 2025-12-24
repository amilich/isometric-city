/**
 * Incident Data - Crime types, fire types, and their descriptions
 * Comprehensive incident system for city simulation
 */

// ============================================================================
// CRIME TYPES
// ============================================================================

export type CrimeType =
  // Violent Crimes
  | 'armed_robbery'
  | 'mugging'
  | 'assault'
  | 'aggravated_assault'
  | 'carjacking'
  | 'kidnapping'
  | 'hostage_situation'
  | 'gang_violence'
  | 'shooting'
  | 'stabbing'
  
  // Property Crimes
  | 'burglary'
  | 'home_invasion'
  | 'commercial_burglary'
  | 'car_theft'
  | 'bike_theft'
  | 'package_theft'
  | 'shoplifting'
  | 'smash_and_grab'
  | 'warehouse_theft'
  | 'construction_theft'
  
  // Financial Crimes
  | 'fraud'
  | 'identity_theft'
  | 'credit_card_fraud'
  | 'insurance_fraud'
  | 'embezzlement'
  | 'counterfeiting'
  
  // Public Order
  | 'disturbance'
  | 'public_intoxication'
  | 'disorderly_conduct'
  | 'noise_complaint'
  | 'loitering'
  | 'trespassing'
  | 'public_urination'
  | 'street_racing'
  | 'illegal_dumping'
  
  // Drug Related
  | 'drug_dealing'
  | 'drug_possession'
  | 'illegal_dispensary'
  | 'public_drug_use'
  
  // Traffic & Vehicle
  | 'hit_and_run'
  | 'dui'
  | 'reckless_driving'
  | 'traffic_violation'
  | 'parking_violation'
  | 'illegal_street_vendor'
  
  // Vandalism & Destruction
  | 'vandalism'
  | 'graffiti'
  | 'arson_attempt'
  | 'property_damage'
  | 'broken_windows'
  
  // Other
  | 'suspicious_activity'
  | 'prowler'
  | 'stalking'
  | 'domestic_disturbance'
  | 'animal_cruelty'
  | 'illegal_gambling'
  | 'prostitution'
  | 'solicitation';

export interface CrimeData {
  name: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  duration: number; // seconds before incident expires if unresponded
  weight: number; // relative spawn frequency (higher = more common)
}

export const CRIME_DATA: Record<CrimeType, CrimeData> = {
  // Violent Crimes (critical/high severity, longer duration)
  armed_robbery: {
    name: 'Silahlı Soygun',
    description: 'Silahlı şüpheli sivilleri tehdit ediyor. Silah çekilmiş durumda.',
    severity: 'critical',
    duration: 45,
    weight: 3,
  },
  mugging: {
    name: 'Gasp',
    description: 'Kurban sokakta soyuluyor. Şüpheli kaçıyor.',
    severity: 'high',
    duration: 30,
    weight: 5,
  },
  assault: {
    name: 'Saldırı',
    description: 'Fiziksel kavga sürüyor. Birden fazla kişi karışmış durumda.',
    severity: 'high',
    duration: 25,
    weight: 6,
  },
  aggravated_assault: {
    name: 'Ağır Saldırı',
    description: 'Potansiyel silahlı şiddetli saldırı. Kurban yaralı.',
    severity: 'critical',
    duration: 40,
    weight: 2,
  },
  carjacking: {
    name: 'Araç Gaspı',
    description: 'Silahlı şüpheli sürücüden aracı zorla alıyor.',
    severity: 'critical',
    duration: 35,
    weight: 2,
  },
  kidnapping: {
    name: 'Adam Kaçırma',
    description: 'Kişi zorla araca bindiriliyor. Acil müdahale gerekli.',
    severity: 'critical',
    duration: 50,
    weight: 1,
  },
  hostage_situation: {
    name: 'Rehine Durumu',
    description: 'Silahlı şüpheli rehineleri tutuyor. Müzakereci lazım.',
    severity: 'critical',
    duration: 60,
    weight: 0.5,
  },
  gang_violence: {
    name: 'Çete Çatışması',
    description: 'Rakip gruplar çatışıyor. Birden fazla şüpheli.',
    severity: 'critical',
    duration: 40,
    weight: 2,
  },
  shooting: {
    name: 'Ateş Açılması',
    description: 'Silah sesleri bildirildi. Olası yaralılar.',
    severity: 'critical',
    duration: 45,
    weight: 1,
  },
  stabbing: {
    name: 'Bıçaklama',
    description: 'Bıçaklı saldırı bildirildi. Tıbbi müdahale gerekli.',
    severity: 'critical',
    duration: 40,
    weight: 1.5,
  },

  // Property Crimes (medium/high severity)
  burglary: {
    name: 'Hırsızlık (Mesken)',
    description: 'İzinsiz giriş tespit edildi. Şüpheli binanın içinde.',
    severity: 'high',
    duration: 30,
    weight: 8,
  },
  home_invasion: {
    name: 'Haneye Tecavüz',
    description: 'Dolu konutta davetsiz misafir. Sakinler tehlikede.',
    severity: 'critical',
    duration: 35,
    weight: 3,
  },
  commercial_burglary: {
    name: 'İş Yeri Hırsızlığı',
    description: 'İş yerine izinsiz giriş sürüyor. Alarm tetiklendi.',
    severity: 'high',
    duration: 28,
    weight: 6,
  },
  car_theft: {
    name: 'Oto Hırsızlığı',
    description: 'Araç çalınıyor. Şüpheli arabaya giriyor.',
    severity: 'medium',
    duration: 22,
    weight: 10,
  },
  bike_theft: {
    name: 'Bisiklet Hırsızlığı',
    description: 'Bisiklet çalınıyor. Şüpheli kilidi kesiyor.',
    severity: 'low',
    duration: 15,
    weight: 12,
  },
  package_theft: {
    name: 'Kargo Hırsızlığı',
    description: 'Kapı önü hırsızı teslim edilen paketleri çalıyor.',
    severity: 'low',
    duration: 12,
    weight: 15,
  },
  shoplifting: {
    name: 'Mağaza Hırsızlığı',
    description: 'Perakende mağazasında hırsızlık. Şüpheli kaçıyor.',
    severity: 'low',
    duration: 15,
    weight: 20,
  },
  smash_and_grab: {
    name: 'Cam Kırıp Kaçma',
    description: 'Cam kırıldı. Birden fazla şüpheli malları kapıyor.',
    severity: 'high',
    duration: 25,
    weight: 4,
  },
  warehouse_theft: {
    name: 'Depo Hırsızlığı',
    description: 'Endüstriyel tesiste büyük çaplı hırsızlık.',
    severity: 'high',
    duration: 35,
    weight: 3,
  },
  construction_theft: {
    name: 'Şantiye Hırsızlığı',
    description: 'Sahadan ekipman veya malzeme çalınıyor.',
    severity: 'medium',
    duration: 25,
    weight: 5,
  },

  // Financial Crimes
  fraud: {
    name: 'Dolandırıcılık',
    description: 'Şüpheli dolandırıcılık şeması. Kurban maddi kayıp bildiriyor.',
    severity: 'medium',
    duration: 30,
    weight: 4,
  },
  identity_theft: {
    name: 'Kimlik Hırsızlığı',
    description: 'Kişisel bilgiler hileli kullanılıyor.',
    severity: 'medium',
    duration: 30,
    weight: 3,
  },
  credit_card_fraud: {
    name: 'Kredi Kartı Dolandırıcılığı',
    description: 'Yetkisiz kart işlemleri sürüyor.',
    severity: 'medium',
    duration: 25,
    weight: 5,
  },
  insurance_fraud: {
    name: 'Sigorta Dolandırıcılığı',
    description: 'Kurgu kaza veya sahte hasar talebi tespit edildi.',
    severity: 'medium',
    duration: 35,
    weight: 2,
  },
  embezzlement: {
    name: 'Zimmete Para Geçirme',
    description: 'Çalışan şirket fonlarını çalarken yakalandı.',
    severity: 'high',
    duration: 40,
    weight: 1,
  },
  counterfeiting: {
    name: 'Kalpazanlık',
    description: 'Sahte para veya mal dağıtılıyor.',
    severity: 'high',
    duration: 35,
    weight: 2,
  },

  // Public Order (low/medium severity, short duration)
  disturbance: {
    name: 'Kamu Huzurunu Bozma',
    description: 'Yüksek sesli tartışma büyüyor. Kalabalık toplanıyor.',
    severity: 'low',
    duration: 18,
    weight: 25,
  },
  public_intoxication: {
    name: 'Kamusal Alanda Sarhoşluk',
    description: 'Aşırı alkollü şahıs rahatsızlık veriyor.',
    severity: 'low',
    duration: 15,
    weight: 18,
  },
  disorderly_conduct: {
    name: 'Düzensiz Davranış',
    description: 'Şahıs uymayı reddediyor. Olay çıkarıyor.',
    severity: 'low',
    duration: 18,
    weight: 15,
  },
  noise_complaint: {
    name: 'Gürültü Şikayeti',
    description: 'Aşırı gürültü mahalleyi rahatsız ediyor.',
    severity: 'low',
    duration: 12,
    weight: 20,
  },
  loitering: {
    name: 'Aylaklık',
    description: 'Şüpheli şahıslar mülk etrafında dolaşıyor.',
    severity: 'low',
    duration: 10,
    weight: 12,
  },
  trespassing: {
    name: 'İzinsiz Giriş',
    description: 'Özel mülkte yetkisiz kişi tespit edildi.',
    severity: 'low',
    duration: 15,
    weight: 14,
  },
  public_urination: {
    name: 'Kamusal Alanda İdrar',
    description: 'Kamusal alanda uygunsuz davranış.',
    severity: 'low',
    duration: 8,
    weight: 10,
  },
  street_racing: {
    name: 'Sokak Yarışı',
    description: 'Araçlar tehlikeli hızlarda yarışıyor.',
    severity: 'high',
    duration: 20,
    weight: 4,
  },
  illegal_dumping: {
    name: 'Kaçak Döküm',
    description: 'Yetkisiz atık dökülüyor.',
    severity: 'low',
    duration: 20,
    weight: 6,
  },

  // Drug Related
  drug_dealing: {
    name: 'Uyuşturucu Ticareti',
    description: 'Şüpheli narkotik alışverişi sürüyor.',
    severity: 'high',
    duration: 20,
    weight: 8,
  },
  drug_possession: {
    name: 'Uyuşturucu Bulundurma',
    description: 'Şüpheli kontrollü madde taşıyor.',
    severity: 'medium',
    duration: 18,
    weight: 10,
  },
  illegal_dispensary: {
    name: 'Yasadışı Dispanser',
    description: 'Ruhsatsız ilaç operasyonu keşfedildi.',
    severity: 'high',
    duration: 35,
    weight: 2,
  },
  public_drug_use: {
    name: 'Açıkta Madde Kullanımı',
    description: 'Şahıs açıkça madde kullanıyor.',
    severity: 'low',
    duration: 15,
    weight: 12,
  },

  // Traffic & Vehicle
  hit_and_run: {
    name: 'Vurup Kaçma',
    description: 'Sürücü çarpışmadan sonra kaçtı. Olası yaralanmalar.',
    severity: 'high',
    duration: 25,
    weight: 6,
  },
  dui: {
    name: 'Alkollü Sürücü',
    description: 'Şüpheli alkollü sürücü. Dengesiz davranış.',
    severity: 'high',
    duration: 22,
    weight: 7,
  },
  reckless_driving: {
    name: 'Dikkatsiz Sürüş',
    description: 'Araç tehlikeli sürülüyor. Başkalarını tehlikeye atıyor.',
    severity: 'medium',
    duration: 18,
    weight: 10,
  },
  traffic_violation: {
    name: 'Trafik İhlali',
    description: 'Hareket halinde ihlal gözlemlendi. Sürücüye ceza kesiliyor.',
    severity: 'low',
    duration: 12,
    weight: 25,
  },
  parking_violation: {
    name: 'Park İhlali',
    description: 'Yasadışı park edilmiş araç erişimi engelliyor.',
    severity: 'low',
    duration: 10,
    weight: 20,
  },
  illegal_street_vendor: {
    name: 'Yasadışı Satıcı',
    description: 'Ruhsatsız satıcı izinsiz çalışıyor.',
    severity: 'low',
    duration: 15,
    weight: 8,
  },

  // Vandalism & Destruction
  vandalism: {
    name: 'Vandalizm',
    description: 'Mülk hasar görüyor veya tahrip ediliyor.',
    severity: 'medium',
    duration: 18,
    weight: 12,
  },
  graffiti: {
    name: 'Grafiti',
    description: 'Şahıs binayı veya yüzeyi sprey boyayla boyuyor.',
    severity: 'low',
    duration: 15,
    weight: 15,
  },
  arson_attempt: {
    name: 'Kundaklama Girişimi',
    description: 'Şahıs yangın çıkarmaya çalışıyor. Acil durum.',
    severity: 'critical',
    duration: 30,
    weight: 2,
  },
  property_damage: {
    name: 'Mülk Hasarı',
    description: 'Kasıtlı mülk tahribi sürüyor.',
    severity: 'medium',
    duration: 20,
    weight: 8,
  },
  broken_windows: {
    name: 'Kırık Camlar',
    description: 'Camlar kırılıyor. Olası hırsızlık girişimi.',
    severity: 'medium',
    duration: 18,
    weight: 10,
  },

  // Other
  suspicious_activity: {
    name: 'Şüpheli Faaliyet',
    description: 'Bilinmeyen şahıs bina yakınında garip davranıyor.',
    severity: 'low',
    duration: 15,
    weight: 18,
  },
  prowler: {
    name: 'Sinsi Dolaşan',
    description: 'Gece mülk etrafında dolaşan şahıs.',
    severity: 'medium',
    duration: 18,
    weight: 8,
  },
  stalking: {
    name: 'Tacizli Takip',
    description: 'Kişi bilinmeyen şahıs tarafından takip ediliyor.',
    severity: 'high',
    duration: 25,
    weight: 3,
  },
  domestic_disturbance: {
    name: 'Aile İçi Huzursuzluk',
    description: 'Konutta hararetli tartışma. Olası şiddet.',
    severity: 'high',
    duration: 25,
    weight: 10,
  },
  animal_cruelty: {
    name: 'Hayvana Eziyet',
    description: 'Hayvan kötü muamele görüyor veya tehlikede.',
    severity: 'medium',
    duration: 20,
    weight: 3,
  },
  illegal_gambling: {
    name: 'Yasadışı Kumar',
    description: 'Ruhsatsız kumar operasyonu keşfedildi.',
    severity: 'medium',
    duration: 30,
    weight: 2,
  },
  prostitution: {
    name: 'Fuhuş',
    description: 'Bölgede yasadışı faaliyet bildirildi.',
    severity: 'medium',
    duration: 20,
    weight: 4,
  },
  solicitation: {
    name: 'Israrlı Satıcılık',
    description: 'Gelip geçenlere agresif satış/dilencilik.',
    severity: 'low',
    duration: 12,
    weight: 8,
  },
};

// Get all crime types as an array
export const CRIME_TYPES = Object.keys(CRIME_DATA) as CrimeType[];

// Get a weighted random crime type
export function getRandomCrimeType(): CrimeType {
  const totalWeight = CRIME_TYPES.reduce((sum, type) => sum + CRIME_DATA[type].weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const type of CRIME_TYPES) {
    random -= CRIME_DATA[type].weight;
    if (random <= 0) {
      return type;
    }
  }
  
  return CRIME_TYPES[0];
}

// ============================================================================
// FIRE TYPES
// ============================================================================

export type FireType =
  | 'structural'
  | 'electrical'
  | 'kitchen'
  | 'industrial'
  | 'chemical'
  | 'vehicle'
  | 'brush'
  | 'explosion'
  | 'gas_leak'
  | 'arson';

export interface FireData {
  name: string;
  description: string;
  severity: 'minor' | 'moderate' | 'major' | 'catastrophic';
}

export const FIRE_DATA: Record<FireType, FireData> = {
  structural: {
    name: 'Yapısal Yangın',
    description: 'Alevler bina boyunca yayılıyor. Birden fazla kat risk altında. Derhal tahliye edin.',
    severity: 'major',
  },
  electrical: {
    name: 'Elektrik Yangını',
    description: 'Elektrik sistemi aşırı yüklenmesi. Prizlerden duman tütüyor. Güç hatları kıvılcım saçıyor.',
    severity: 'moderate',
  },
  kitchen: {
    name: 'Mutfak Yangını',
    description: 'Kontrolden çıkan yemek yangını. Yağ alevleri hızla yayılıyor. Havalandırma riskli.',
    severity: 'moderate',
  },
  industrial: {
    name: 'Endüstriyel Yangın',
    description: 'Yoğun dumanlı fabrika yangını. Tehlikeli maddeler olabilir. Geniş çevre güvenliği gerekli.',
    severity: 'catastrophic',
  },
  chemical: {
    name: 'Kimyasal Yangın',
    description: 'Toksik kimyasal yanması. Tehlikeli dumanlar yayılıyor. Uzman müdahale gerekli.',
    severity: 'catastrophic',
  },
  vehicle: {
    name: 'Araç Yangını',
    description: 'Araba alevler içinde. Yakıt tankı patlama riski. Uzak durun.',
    severity: 'minor',
  },
  brush: {
    name: 'Çalı Yangını',
    description: 'Rüzgarla yayılan bitki örtüsü yangını. Yakındaki yapılar tehdit altında.',
    severity: 'moderate',
  },
  explosion: {
    name: 'Patlama',
    description: 'Bina patlamayla sarsıldı. Yapısal bütünlük bozuldu. Olası yaralılar.',
    severity: 'catastrophic',
  },
  gas_leak: {
    name: 'Gaz Yangını',
    description: 'Doğal gaz tutuştu. Sızıntıdan sürekli alev. Kapatma vanası gerekli.',
    severity: 'major',
  },
  arson: {
    name: 'Kundaklama Yangını',
    description: 'Kasıtlı çıkarılan yangın tespit edildi. Hızlandırıcı kullanılmış. Yangın hızla yayılıyor.',
    severity: 'major',
  },
};

export const FIRE_TYPES = Object.keys(FIRE_DATA) as FireType[];

// Get a random fire type (weighted toward structural/electrical for realism)
export function getRandomFireType(): FireType {
  const weights: Record<FireType, number> = {
    structural: 25,
    electrical: 20,
    kitchen: 15,
    industrial: 8,
    chemical: 3,
    vehicle: 10,
    brush: 5,
    explosion: 2,
    gas_leak: 7,
    arson: 5,
  };
  
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  let random = Math.random() * totalWeight;
  
  for (const [type, weight] of Object.entries(weights)) {
    random -= weight;
    if (random <= 0) {
      return type as FireType;
    }
  }
  
  return 'structural';
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function getCrimeName(crimeType: CrimeType): string {
  return CRIME_DATA[crimeType]?.name || 'Bilinmeyen Olay';
}

export function getCrimeDescription(crimeType: CrimeType): string {
  return CRIME_DATA[crimeType]?.description || 'Olay bildirildi.';
}

export function getCrimeDuration(crimeType: CrimeType): number {
  return CRIME_DATA[crimeType]?.duration || 20;
}

export function getFireName(fireType: FireType): string {
  return FIRE_DATA[fireType]?.name || 'Yangın';
}

export function getFireDescription(fireType: FireType): string {
  return FIRE_DATA[fireType]?.description || 'Bina yanıyor. İtfaiye ekipleri müdahale ediyor.';
}

// Get fire description based on tile coordinates (deterministic)
export function getFireDescriptionForTile(x: number, y: number): string {
  // Use coordinates to deterministically pick a fire type
  const index = Math.abs((x * 31 + y * 17) % FIRE_TYPES.length);
  return FIRE_DATA[FIRE_TYPES[index]].description;
}

// Get fire name based on tile coordinates (deterministic)
export function getFireNameForTile(x: number, y: number): string {
  const index = Math.abs((x * 31 + y * 17) % FIRE_TYPES.length);
  return FIRE_DATA[FIRE_TYPES[index]].name;
}
