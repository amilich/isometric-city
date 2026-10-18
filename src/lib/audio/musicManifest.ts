export type GameMusicFit = 'isocity' | 'coaster' | 'shared';

export interface MusicTrackManifestEntry {
  id: string;
  title: string;
  originalFileName: string;
  fileName: string;
  publicPath: string;
  sourceArchive: string;
  creator: string;
  sourceUrl: string;
  licenseSummary: string;
  attributionRequired: boolean;
  commercialUse: 'allowed';
  bytes: number;
  sha256: string;
  fit: GameMusicFit;
  notes: string;
}

const MUSIC_PATH = '/audio/abstraction/music-loop-bundle';
const COMMON_LICENSE = 'CC0/Public Domain. Commercial and non-commercial use allowed; modification allowed; attribution optional.';

const MUSIC_DATA = [
  ['week-13-primordial-soup-base', 'Primordial Soup - Base', 'Week 13 - Primordial Soup BASE.ogg', 'week-13-primordial-soup-base.ogg', 3120013, '6f6c4c9b2744a9210488064603c9259c37d9421a8e562ce35a568c1ec7d8f817', 'shared', 'Low-key construction loop for planning and menu time.'],
  ['week-13-primordial-soup-jangles', 'Primordial Soup - Jangles', 'Week 13 - Primordial Soup JANGLES.ogg', 'week-13-primordial-soup-jangles.ogg', 3555242, '779b57a673b96668531709be1e07522a3d12c51c8bbc967b965420591b1bb670', 'shared', 'Bright variation for active building.'],
  ['week-13-primordial-soup-melody', 'Primordial Soup - Melody', 'Week 13 - Primordial Soup MELODY.ogg', 'week-13-primordial-soup-melody.ogg', 3451186, 'd43a191e263a3b455c22863f72781b208ce01d509801424245d38e3240b52af2', 'shared', 'Melodic city and park building loop.'],
  ['week-14-lift-you-up-chorus', 'Lift You Up - Chorus', 'Week 14 - Lift You Up CHORUS.ogg', 'week-14-lift-you-up-chorus.ogg', 2304815, 'afdf5d82a752f67879a1c0f21aa72fcb7e60b89709d23e1d1146243d75b19e90', 'coaster', 'Upbeat loop for coaster construction.'],
  ['week-14-lift-you-up-melody', 'Lift You Up - Melody', 'Week 14 - Lift You Up MELODY.ogg', 'week-14-lift-you-up-melody.ogg', 2355762, 'a7bd29e432cc48cf3c08958a4944cc1d8ab2782a26f3bcb81f0709060ab233fe', 'coaster', 'Lighter amusement-park melody.'],
  ['week-15-sunburn-beach-house', 'Sunburn - Beach House', 'Week 15 - Sunburn BEACH HOUSE.ogg', 'week-15-sunburn-beach-house.ogg', 2783916, 'f5c5cc0ecddeae67f813fb5b1356123464e1aeb5d3abcc806847d93cb44358e3', 'shared', 'Warm leisure loop for parks and waterfront cities.'],
  ['week-15-sunburn-spf-3000', 'Sunburn - SPF 3000', 'Week 15 - Sunburn SPF 3000.ogg', 'week-15-sunburn-spf-3000.ogg', 2158061, '9b4ed0ff61bec535bbc303055c0902db868ba5f0e48ceb42627788d8b1ea9615', 'coaster', 'Sunny park loop.'],
  ['week-16-vacation-day-adventure', 'Vacation Day - Adventure', 'Week 16 - Vacation Day ADVENTURE.ogg', 'week-16-vacation-day-adventure.ogg', 2091742, '026bdbfcf0b956d6c20761219df0f0c52dc4ee86c1d8c0c337a2ef357c269979', 'coaster', 'Bright exploration loop.'],
  ['week-16-vacation-day-chillout', 'Vacation Day - Chillout', 'Week 16 - Vacation Day CHILLOUT.ogg', 'week-16-vacation-day-chillout.ogg', 2136721, 'cb7200fa26dd1b94451dec985c54ab569fe463d79222ba4fbd7a14ff823e8fbd', 'shared', 'Relaxed management loop.'],
  ['week-17-alley-cat-dumpster-divin', 'Alley Cat - Dumpster Divin', 'Week 17 - Alley Cat DUMPSTER DIVIN.ogg', 'week-17-alley-cat-dumpster-divin.ogg', 2401798, '6599099af016e745e954cf2f8b404b1b5ad39e3946fb2c2f9d8b0201e5dd3315', 'isocity', 'Urban side-street loop for dense-city play.'],
  ['week-17-alley-cat-dumpster-party', 'Alley Cat - Dumpster Party', 'Week 17 - Alley Cat DUMPSTER PARTY.ogg', 'week-17-alley-cat-dumpster-party.ogg', 2465824, '321fa28aca2ef6bb4b08bce4df2616df25db792e5973d4393ef0d0075a241102', 'isocity', 'Busier urban loop.'],
  ['week-18-distant-skyline-city-lights', 'Distant Skyline - City Lights', 'Week 18 - Distant Skyline CITY LIGHTS.ogg', 'week-18-distant-skyline-city-lights.ogg', 2692481, '2bdcebdc8d127dcca4b427cdd5f81423b95c469cfeee8c3a38b7332e4b8dd324', 'isocity', 'Default IsoCity loop with urban night energy.'],
  ['week-18-distant-skyline-night-drive', 'Distant Skyline - Night Drive', 'Week 18 - Distant Skyline NIGHT DRIVE.ogg', 'week-18-distant-skyline-night-drive.ogg', 2712214, 'd1fd66893061282313acbc5ab3a6868571e3363fe5eaec2e9aac3d77187d3e5a', 'isocity', 'Smooth city-management loop.'],
  ['week-18-distant-skyline-sidewalk-strut', 'Distant Skyline - Sidewalk Strut', 'Week 18 - Distant Skyline SIDEWALK STRUT.ogg', 'week-18-distant-skyline-sidewalk-strut.ogg', 2091122, '2075e159cc37b140880f56cf09eae769826dc08078dd5d5a05d2aeb17bfce2bf', 'isocity', 'Light urban loop for early city growth.'],
  ['week-19-dark-portents-mysterious-traveler', 'Dark Portents - Mysterious Traveler', 'Week 19 - Dark Portents MYSTERIOUS TRAVELER.ogg', 'week-19-dark-portents-mysterious-traveler.ogg', 3533539, '01c29eab3385ebe58b50681ccba0dc1482e71eeed9391ff8991ade3f54051570', 'shared', 'Moodier loop for night or disaster-heavy sessions.'],
  ['week-19-dark-portents-shrouded-future', 'Dark Portents - Shrouded Future', 'Week 19 - Dark Portents SHROUDED FUTURE.ogg', 'week-19-dark-portents-shrouded-future.ogg', 3391841, 'fa6b5a42c956b932f3f6e85e0f35aecc39a2ceec8aca14467164e1861a283614', 'shared', 'Tense planning loop.'],
  ['week-20-1-magnetic-tape-scuffed', 'Magnetic Tape - Scuffed', 'Week 20.1 - Magnetic Tape SCUFFED.ogg', 'week-20-1-magnetic-tape-scuffed.ogg', 3180838, '469554fc0f7f889f7b4e9d416aa7fbd801d92e9ceddbc399c41a50659ec262f2', 'shared', 'Lo-fi loop for long-form management.'],
  ['week-20-dust-bowl-hope-of-rain', 'Dust Bowl - Hope Of Rain', 'Week 20 - Dust Bowl HOPE OF RAIN.ogg', 'week-20-dust-bowl-hope-of-rain.ogg', 4626119, 'be7342b8731df4329acf71bfe8919a020b19cc54e9b8d8d6dc8fa8f37d9b07a5', 'isocity', 'Rural or low-density city loop.'],
  ['week-20-dust-bowl-parched', 'Dust Bowl - Parched', 'Week 20 - Dust Bowl PARCHED.ogg', 'week-20-dust-bowl-parched.ogg', 4372042, 'e877b91032748e9f3fd30461c55e4860d37dc68e462a5fbc2c088d8f6275eb16', 'isocity', 'Sparse city-planning loop.'],
  ['week-21-freefall-glide', 'Freefall - Glide', 'Week 21 - Freefall GLIDE.ogg', 'week-21-freefall-glide.ogg', 2175594, 'd2ee7e1a0aa29958da61ed895df2ccbf8317415123e02aaa82ed5bcb1373415b', 'coaster', 'Default IsoCoaster loop with airy movement.'],
  ['week-21-freefall-what-a-view', 'Freefall - What A View', 'Week 21 - Freefall WHAT A VIEW.ogg', 'week-21-freefall-what-a-view.ogg', 3051488, '4cd1c6c3a57b0cc40850d02ff136214b1e23782dfa6457c9a410676cb1c5ed4d', 'coaster', 'Wide-open theme-park loop.'],
  ['week-22-the-walking-dunes-evening-oasis', 'The Walking Dunes - Evening Oasis', 'Week 22 - The Walking Dunes EVENING OASIS.ogg', 'week-22-the-walking-dunes-evening-oasis.ogg', 2293912, 'adb66d922cf2947926ad66802b851b101a7cb768d62097951373aa08243f6ffe', 'shared', 'Calmer landscape loop.'],
  ['week-22-the-walking-dunes-unblinking-sun', 'The Walking Dunes - Unblinking Sun', 'Week 22 - The Walking Dunes UNBLINKING SUN.ogg', 'week-22-the-walking-dunes-unblinking-sun.ogg', 2464887, 'be693bce378ba0ac7202b98e7ce93f4f6fbbc49388e1eeb5872dc7fad4da556a', 'shared', 'Dry, bright loop for open land.'],
  ['week-23-workshop-breadboard', 'Workshop - Breadboard', 'Week 23 - Workshop BREADBOARD.ogg', 'week-23-workshop-breadboard.ogg', 2779692, '7ec21cd36dd4be375e542a3e32116d2c2d060587f7c041f2444dfdc80da3648a', 'shared', 'Construction-focused loop.'],
  ['week-24-pull-me-down-deep-well', 'Pull Me Down - Deep Well', 'Week 24 - Pull Me Down DEEP WELL.ogg', 'week-24-pull-me-down-deep-well.ogg', 2754788, '5d2a9f815586d20ef07f8cff8a218e6968e4a206e9ee72263f8c62b7adc2116b', 'shared', 'Slow strategy loop.'],
  ['week-24-pull-me-down-gravity', 'Pull Me Down - Gravity', 'Week 24 - Pull Me Down GRAVITY.ogg', 'week-24-pull-me-down-gravity.ogg', 2850256, '56db5312ccf82b87574f05369284b009c65d0ef610a2a5fc2ac581d1e4adfa67', 'shared', 'Steady building loop.'],
  ['week-25-have-a-great-summer-pool-party', 'Have A Great Summer - Pool Party', 'Week 25 - Have A Great Summer POOL PARTY.ogg', 'week-25-have-a-great-summer-pool-party.ogg', 3559828, '6201bd85f4fa51fe1d116df657159566de11b76db24a50006ec673dd86a8cc2a', 'coaster', 'Playful park loop.'],
  ['week-26-seaside-coral-reef', 'Seaside - Coral Reef', 'Week 26 - Seaside CORAL REEF.ogg', 'week-26-seaside-coral-reef.ogg', 3990891, 'd7088e040aa5ebe07769662aa5e31ed91ca32322c7572e172bc9cb37a7810a89', 'shared', 'Waterfront loop for coastlines and water rides.'],
  ['week-26-seaside-endless-waves', 'Seaside - Endless Waves', 'Week 26 - Seaside ENDLESS WAVES.ogg', 'week-26-seaside-endless-waves.ogg', 2705036, '39ba6c31b4f8c81cbe40214fb7a57bd2c3281cae2b9b4eeb18f94134c0da8b52', 'shared', 'Relaxed water loop.'],
] as const;

export const MUSIC_TRACK_MANIFEST: MusicTrackManifestEntry[] = MUSIC_DATA.map(([
  id,
  title,
  originalFileName,
  fileName,
  bytes,
  sha256,
  fit,
  notes,
]) => ({
  id,
  title,
  originalFileName,
  fileName,
  publicPath: `${MUSIC_PATH}/${fileName}`,
  sourceArchive: 'music-loop-bundle-2026-q2.zip',
  creator: 'Abstraction / Tallbeard Studios',
  sourceUrl: 'https://tallbeard.itch.io/music-loop-bundle',
  licenseSummary: COMMON_LICENSE,
  attributionRequired: false,
  commercialUse: 'allowed',
  bytes,
  sha256,
  fit,
  notes,
}));

export const DEFAULT_MUSIC_TRACK_ID = 'week-18-distant-skyline-city-lights';
export const DEFAULT_COASTER_MUSIC_TRACK_ID = 'week-21-freefall-glide';

export function getMusicTrack(id: string | null | undefined): MusicTrackManifestEntry {
  return MUSIC_TRACK_MANIFEST.find((track) => track.id === id) ?? MUSIC_TRACK_MANIFEST[0];
}
