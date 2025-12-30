import { Scenario } from '@/types/scenario';

export const SCENARIOS: Scenario[] = [
  {
    id: 'tutorial_town',
    name: 'Kasaba Kurucusu',
    description: 'Şehir yönetimine ilk adım. Küçük bir kasaba kur ve halkını mutlu et.',
    difficulty: 'easy',
    initialMoney: 25000,
    mapConfig: { size: 64 },
    timeLimit: { year: 2, month: 12 }, // 2 Years
    objectives: [
      {
        id: 'pop_100',
        type: 'population',
        targetValue: 100,
        description: 'Nüfusu 100 kişiye çıkar.'
      },
      {
        id: 'money_30k',
        type: 'money',
        targetValue: 30000,
        description: 'Kasada 30.000₺ biriktir.'
      },
      {
        id: 'happy_60',
        type: 'happiness',
        targetValue: 60,
        description: 'Halkın mutluluğunu %60 üzerine çıkar.'
      }
    ],
    winMessage: 'Tebrikler! Kasabanız gelişiyor. Artık daha büyük projelere hazırsınız.'
  },
  {
    id: 'metropolis_dream',
    name: 'Metropol Rüyası',
    description: 'Devasa bir metropol kurma yolunda ilerleyin. Altyapı ve ekonomi dengesini kurun.',
    difficulty: 'medium',
    initialMoney: 100000,
    mapConfig: { size: 128 },
    timeLimit: { year: 5, month: 12 }, // 5 Years
    objectives: [
      {
        id: 'pop_5k',
        type: 'population',
        targetValue: 5000,
        description: 'Nüfusu 5.000 kişiye ulaştır.'
      },
      {
        id: 'happy_80',
        type: 'happiness',
        targetValue: 80,
        description: 'Mutluluk oranını %80 seviyesinde tut.'
      },
      {
        id: 'build_parks',
        type: 'building_count',
        targetValue: 5,
        targetId: 'park_large',
        description: 'Şehre 5 adet Büyük Park inşa et.'
      }
    ],
    winMessage: 'İnanılmaz! Gerçek bir metropol yöneticisisiniz.'
  },
  {
    id: 'industrial_giant',
    name: 'Sanayi Devi',
    description: 'Ekonomiyi güçlendirin ama çevre kirliliğine dikkat edin.',
    difficulty: 'hard',
    initialMoney: 50000,
    mapConfig: { size: 96 },
    timeLimit: { year: 4, month: 12 }, // 4 Years
    objectives: [
      {
        id: 'money_1m',
        type: 'money',
        targetValue: 1000000,
        description: '1 Milyon ₺ nakit biriktir.'
      },
      {
        id: 'pop_10k',
        type: 'population',
        targetValue: 10000,
        description: '10.000 nüfusa ulaş.'
      }
    ],
    winMessage: 'Ekonomi devi oldunuz! Şehriniz para basıyor.'
  }
];

