export type GameAudioCue =
  | 'ui.select'
  | 'ui.confirm'
  | 'ui.cancel'
  | 'build.place'
  | 'build.zone'
  | 'build.road'
  | 'build.bulldoze'
  | 'build.upgrade'
  | 'coaster.track'
  | 'coaster.ride'
  | 'coaster.guest'
  | 'economy.deposit'
  | 'simulation.pause'
  | 'simulation.speed'
  | 'multiplayer.join'
  | 'multiplayer.leave'
  | 'glitch.validated'
  | 'glitch.denied'
  | 'progress.achievement';

export type AudioLicenseStatus =
  | 'cleared_for_runtime'
  | 'generated_by_code'
  | 'excluded_pending_license_review';

export interface AudioAssetManifestEntry {
  id: string;
  originalFileName: string;
  fileName: string | null;
  publicPath: string | null;
  sourceArchive: string;
  creator: string;
  sourceUrl: string;
  licenseSummary: string;
  licenseStatus: AudioLicenseStatus;
  attributionRequired: boolean;
  commercialUse: 'allowed' | 'generated' | 'not_wired_pending_review';
  bytes: number | null;
  sha256: string | null;
  notes: string;
}

export interface AudioCueVariant {
  assetId: string;
  src?: string;
  gain: number;
  playbackRate?: [number, number];
  generated?: {
    waveform: OscillatorType;
    frequencyHz: number;
    endFrequencyHz?: number;
    durationMs: number;
  };
}

export interface AudioCueDefinition {
  id: GameAudioCue;
  description: string;
  defaultGain: number;
  cooldownMs: number;
  variants: AudioCueVariant[];
}

const HAZARD_PATH = '/audio/hazard-pay/free-upgrade-sfx';

export const AUDIO_ASSET_MANIFEST: AudioAssetManifestEntry[] = [
  {
    id: 'hazard-upgrade-a-1',
    originalFileName: 'Upgrade A 1.ogg',
    fileName: 'upgrade-a-1.ogg',
    publicPath: `${HAZARD_PATH}/upgrade-a-1.ogg`,
    sourceArchive: 'Free Upgrade SFX.zip',
    creator: 'Hazard Pay',
    sourceUrl: 'https://hazardpay.itch.io/free-satisfying-upgrade-sfx',
    licenseSummary: 'Free game SFX pack. Public page states credit is not required; do not claim ownership of the sounds.',
    licenseStatus: 'cleared_for_runtime',
    attributionRequired: false,
    commercialUse: 'allowed',
    bytes: 136912,
    sha256: '54ec5794138ac3181287dbd4e4ea86f7e4f3226c2b2e5aa0f25242b0de262cc4',
    notes: 'Used for bright construction and confirmation feedback.',
  },
  {
    id: 'hazard-upgrade-a-2',
    originalFileName: 'Upgrade A 2.ogg',
    fileName: 'upgrade-a-2.ogg',
    publicPath: `${HAZARD_PATH}/upgrade-a-2.ogg`,
    sourceArchive: 'Free Upgrade SFX.zip',
    creator: 'Hazard Pay',
    sourceUrl: 'https://hazardpay.itch.io/free-satisfying-upgrade-sfx',
    licenseSummary: 'Free game SFX pack. Public page states credit is not required; do not claim ownership of the sounds.',
    licenseStatus: 'cleared_for_runtime',
    attributionRequired: false,
    commercialUse: 'allowed',
    bytes: 147131,
    sha256: '29a7faad7f17a5a8d2477be8d932f8ce4c4028f25bb949b8f904db1387f4d750',
    notes: 'Alternate construction confirmation variant.',
  },
  {
    id: 'hazard-upgrade-b-1',
    originalFileName: 'Upgrade B 1.ogg',
    fileName: 'upgrade-b-1.ogg',
    publicPath: `${HAZARD_PATH}/upgrade-b-1.ogg`,
    sourceArchive: 'Free Upgrade SFX.zip',
    creator: 'Hazard Pay',
    sourceUrl: 'https://hazardpay.itch.io/free-satisfying-upgrade-sfx',
    licenseSummary: 'Free game SFX pack. Public page states credit is not required; do not claim ownership of the sounds.',
    licenseStatus: 'cleared_for_runtime',
    attributionRequired: false,
    commercialUse: 'allowed',
    bytes: 110974,
    sha256: 'b290da90ca163145aedd5162b73c7522f3ca9b75ef3f4eea8760594a3d680402',
    notes: 'Used for zoning and low-intensity placement actions.',
  },
  {
    id: 'hazard-upgrade-b-2',
    originalFileName: 'Upgrade B 2.ogg',
    fileName: 'upgrade-b-2.ogg',
    publicPath: `${HAZARD_PATH}/upgrade-b-2.ogg`,
    sourceArchive: 'Free Upgrade SFX.zip',
    creator: 'Hazard Pay',
    sourceUrl: 'https://hazardpay.itch.io/free-satisfying-upgrade-sfx',
    licenseSummary: 'Free game SFX pack. Public page states credit is not required; do not claim ownership of the sounds.',
    licenseStatus: 'cleared_for_runtime',
    attributionRequired: false,
    commercialUse: 'allowed',
    bytes: 120063,
    sha256: 'bdf9da466dc4f57b01c8af41017c588e98410b7630e5771a744b85d572ce86ea',
    notes: 'Alternate zoning and path-placement variant.',
  },
  {
    id: 'hazard-upgrade-c-1',
    originalFileName: 'Upgrade C 1.ogg',
    fileName: 'upgrade-c-1.ogg',
    publicPath: `${HAZARD_PATH}/upgrade-c-1.ogg`,
    sourceArchive: 'Free Upgrade SFX.zip',
    creator: 'Hazard Pay',
    sourceUrl: 'https://hazardpay.itch.io/free-satisfying-upgrade-sfx',
    licenseSummary: 'Free game SFX pack. Public page states credit is not required; do not claim ownership of the sounds.',
    licenseStatus: 'cleared_for_runtime',
    attributionRequired: false,
    commercialUse: 'allowed',
    bytes: 113118,
    sha256: '9dbe91d4c1b6d902bdcb78d8214b5273fd9928f2a9c552a63352414a083c46ab',
    notes: 'Used for UI confirmations and saved-game actions.',
  },
  {
    id: 'hazard-upgrade-c-2',
    originalFileName: 'Upgrade C 2.ogg',
    fileName: 'upgrade-c-2.ogg',
    publicPath: `${HAZARD_PATH}/upgrade-c-2.ogg`,
    sourceArchive: 'Free Upgrade SFX.zip',
    creator: 'Hazard Pay',
    sourceUrl: 'https://hazardpay.itch.io/free-satisfying-upgrade-sfx',
    licenseSummary: 'Free game SFX pack. Public page states credit is not required; do not claim ownership of the sounds.',
    licenseStatus: 'cleared_for_runtime',
    attributionRequired: false,
    commercialUse: 'allowed',
    bytes: 102350,
    sha256: '67305f4976da2fc10c1525dd4e8a5b785ceddae38ce6440ccedf6091c1ad778b',
    notes: 'Alternate UI confirmation variant.',
  },
  {
    id: 'hazard-upgrade-d-1',
    originalFileName: 'Upgrade D 1.ogg',
    fileName: 'upgrade-d-1.ogg',
    publicPath: `${HAZARD_PATH}/upgrade-d-1.ogg`,
    sourceArchive: 'Free Upgrade SFX.zip',
    creator: 'Hazard Pay',
    sourceUrl: 'https://hazardpay.itch.io/free-satisfying-upgrade-sfx',
    licenseSummary: 'Free game SFX pack. Public page states credit is not required; do not claim ownership of the sounds.',
    licenseStatus: 'cleared_for_runtime',
    attributionRequired: false,
    commercialUse: 'allowed',
    bytes: 107271,
    sha256: 'ecc715e0a0c9b014c820cdafcf3992eb5b8898cfe644b28ae4142d59bc3fe4c9',
    notes: 'Used for larger upgrades and ride/coaster actions.',
  },
  {
    id: 'hazard-upgrade-d-2',
    originalFileName: 'Upgrade D 2.ogg',
    fileName: 'upgrade-d-2.ogg',
    publicPath: `${HAZARD_PATH}/upgrade-d-2.ogg`,
    sourceArchive: 'Free Upgrade SFX.zip',
    creator: 'Hazard Pay',
    sourceUrl: 'https://hazardpay.itch.io/free-satisfying-upgrade-sfx',
    licenseSummary: 'Free game SFX pack. Public page states credit is not required; do not claim ownership of the sounds.',
    licenseStatus: 'cleared_for_runtime',
    attributionRequired: false,
    commercialUse: 'allowed',
    bytes: 108863,
    sha256: 'dda40cb4d54d460321799013d2b92e16fb7ef0883ec924ae5aa5185f0159bf16',
    notes: 'Alternate large-upgrade and ride action variant.',
  },
  {
    id: 'hazard-upgrade-e-1',
    originalFileName: 'Upgrade E 1.ogg',
    fileName: 'upgrade-e-1.ogg',
    publicPath: `${HAZARD_PATH}/upgrade-e-1.ogg`,
    sourceArchive: 'Free Upgrade SFX.zip',
    creator: 'Hazard Pay',
    sourceUrl: 'https://hazardpay.itch.io/free-satisfying-upgrade-sfx',
    licenseSummary: 'Free game SFX pack. Public page states credit is not required; do not claim ownership of the sounds.',
    licenseStatus: 'cleared_for_runtime',
    attributionRequired: false,
    commercialUse: 'allowed',
    bytes: 97481,
    sha256: '904919383fb16b3d7aa3161e6fef177bb4511115e43dd2c0b85b04cfc455cf82',
    notes: 'Used for achievements and successful Glitch validation.',
  },
  {
    id: 'hazard-upgrade-e-2',
    originalFileName: 'Upgrade E 2.ogg',
    fileName: 'upgrade-e-2.ogg',
    publicPath: `${HAZARD_PATH}/upgrade-e-2.ogg`,
    sourceArchive: 'Free Upgrade SFX.zip',
    creator: 'Hazard Pay',
    sourceUrl: 'https://hazardpay.itch.io/free-satisfying-upgrade-sfx',
    licenseSummary: 'Free game SFX pack. Public page states credit is not required; do not claim ownership of the sounds.',
    licenseStatus: 'cleared_for_runtime',
    attributionRequired: false,
    commercialUse: 'allowed',
    bytes: 100631,
    sha256: '009970f2c3fa4f4024feb06baed1373edfb51f8bc4cf8d1678595113bcdcb834',
    notes: 'Alternate achievement and validation success variant.',
  },
  {
    id: 'gregor-general-ambience-pack',
    originalFileName: 'Gregor Quendel - Free General Ambience Sounds.zip',
    fileName: null,
    publicPath: null,
    sourceArchive: 'Gregor Quendel - Free General Ambience Sounds.zip',
    creator: 'Gregor Quendel',
    sourceUrl: 'https://gregorquendel.artstation.com/store/xW8Oa/free-general-ambience-sounds',
    licenseSummary: 'Archive was provided, but no license file was present in the ZIP. Public listings show conflicting signals, so this pack is documented but not bundled into runtime audio.',
    licenseStatus: 'excluded_pending_license_review',
    attributionRequired: true,
    commercialUse: 'not_wired_pending_review',
    bytes: null,
    sha256: null,
    notes: 'Import individual ambience files only after confirming the exact commercial license source for the downloaded archive.',
  },
];

export const AUDIO_CUE_LIBRARY: Record<GameAudioCue, AudioCueDefinition> = {
  'ui.select': {
    id: 'ui.select',
    description: 'Small interface acknowledgement for tool and panel selection.',
    defaultGain: 0.34,
    cooldownMs: 35,
    variants: [
      { assetId: 'hazard-upgrade-b-1', src: `${HAZARD_PATH}/upgrade-b-1.ogg`, gain: 0.34, playbackRate: [1.35, 1.55] },
      { assetId: 'hazard-upgrade-b-2', src: `${HAZARD_PATH}/upgrade-b-2.ogg`, gain: 0.32, playbackRate: [1.32, 1.52] },
    ],
  },
  'ui.confirm': {
    id: 'ui.confirm',
    description: 'Positive UI confirmation for saves, modal actions, and imports.',
    defaultGain: 0.42,
    cooldownMs: 90,
    variants: [
      { assetId: 'hazard-upgrade-c-1', src: `${HAZARD_PATH}/upgrade-c-1.ogg`, gain: 0.42, playbackRate: [1.0, 1.08] },
      { assetId: 'hazard-upgrade-c-2', src: `${HAZARD_PATH}/upgrade-c-2.ogg`, gain: 0.4, playbackRate: [1.0, 1.08] },
    ],
  },
  'ui.cancel': {
    id: 'ui.cancel',
    description: 'Soft generated cancellation tone.',
    defaultGain: 0.2,
    cooldownMs: 90,
    variants: [
      { assetId: 'generated-ui-cancel', gain: 0.2, generated: { waveform: 'triangle', frequencyHz: 220, endFrequencyHz: 140, durationMs: 110 } },
    ],
  },
  'build.place': {
    id: 'build.place',
    description: 'Generic building placement confirmation.',
    defaultGain: 0.46,
    cooldownMs: 45,
    variants: [
      { assetId: 'hazard-upgrade-a-1', src: `${HAZARD_PATH}/upgrade-a-1.ogg`, gain: 0.46, playbackRate: [0.95, 1.08] },
      { assetId: 'hazard-upgrade-a-2', src: `${HAZARD_PATH}/upgrade-a-2.ogg`, gain: 0.44, playbackRate: [0.95, 1.08] },
    ],
  },
  'build.zone': {
    id: 'build.zone',
    description: 'Lower intensity placement for zoning and terrain brush actions.',
    defaultGain: 0.28,
    cooldownMs: 45,
    variants: [
      { assetId: 'hazard-upgrade-b-1', src: `${HAZARD_PATH}/upgrade-b-1.ogg`, gain: 0.28, playbackRate: [1.1, 1.22] },
      { assetId: 'hazard-upgrade-b-2', src: `${HAZARD_PATH}/upgrade-b-2.ogg`, gain: 0.27, playbackRate: [1.1, 1.22] },
    ],
  },
  'build.road': {
    id: 'build.road',
    description: 'Fast, quieter road/path placement feedback for drag placement.',
    defaultGain: 0.22,
    cooldownMs: 70,
    variants: [
      { assetId: 'hazard-upgrade-b-2', src: `${HAZARD_PATH}/upgrade-b-2.ogg`, gain: 0.22, playbackRate: [1.45, 1.65] },
    ],
  },
  'build.bulldoze': {
    id: 'build.bulldoze',
    description: 'Generated down-sweep for demolition because no cleared demolition asset was supplied.',
    defaultGain: 0.34,
    cooldownMs: 80,
    variants: [
      { assetId: 'generated-bulldoze', gain: 0.34, generated: { waveform: 'sawtooth', frequencyHz: 120, endFrequencyHz: 55, durationMs: 140 } },
    ],
  },
  'build.upgrade': {
    id: 'build.upgrade',
    description: 'Larger construction or upgrade reward.',
    defaultGain: 0.52,
    cooldownMs: 120,
    variants: [
      { assetId: 'hazard-upgrade-d-1', src: `${HAZARD_PATH}/upgrade-d-1.ogg`, gain: 0.52, playbackRate: [0.92, 1.0] },
      { assetId: 'hazard-upgrade-d-2', src: `${HAZARD_PATH}/upgrade-d-2.ogg`, gain: 0.5, playbackRate: [0.92, 1.0] },
    ],
  },
  'coaster.track': {
    id: 'coaster.track',
    description: 'IsoCoaster track and queue construction.',
    defaultGain: 0.42,
    cooldownMs: 50,
    variants: [
      { assetId: 'hazard-upgrade-a-1', src: `${HAZARD_PATH}/upgrade-a-1.ogg`, gain: 0.42, playbackRate: [1.1, 1.22] },
      { assetId: 'hazard-upgrade-a-2', src: `${HAZARD_PATH}/upgrade-a-2.ogg`, gain: 0.4, playbackRate: [1.1, 1.22] },
    ],
  },
  'coaster.ride': {
    id: 'coaster.ride',
    description: 'Large ride placement or coaster completion.',
    defaultGain: 0.54,
    cooldownMs: 140,
    variants: [
      { assetId: 'hazard-upgrade-d-1', src: `${HAZARD_PATH}/upgrade-d-1.ogg`, gain: 0.54, playbackRate: [0.98, 1.08] },
      { assetId: 'hazard-upgrade-d-2', src: `${HAZARD_PATH}/upgrade-d-2.ogg`, gain: 0.52, playbackRate: [0.98, 1.08] },
    ],
  },
  'economy.deposit': {
    id: 'economy.deposit',
    description: 'Money or cargo revenue event.',
    defaultGain: 0.32,
    cooldownMs: 500,
    variants: [
      { assetId: 'hazard-upgrade-c-1', src: `${HAZARD_PATH}/upgrade-c-1.ogg`, gain: 0.32, playbackRate: [1.18, 1.28] },
    ],
  },
  'simulation.pause': {
    id: 'simulation.pause',
    description: 'Generated pause/stop transport cue.',
    defaultGain: 0.18,
    cooldownMs: 160,
    variants: [
      { assetId: 'generated-pause', gain: 0.18, generated: { waveform: 'triangle', frequencyHz: 260, endFrequencyHz: 190, durationMs: 120 } },
    ],
  },
  'simulation.speed': {
    id: 'simulation.speed',
    description: 'Time-speed change cue.',
    defaultGain: 0.24,
    cooldownMs: 120,
    variants: [
      { assetId: 'hazard-upgrade-b-1', src: `${HAZARD_PATH}/upgrade-b-1.ogg`, gain: 0.24, playbackRate: [1.55, 1.75] },
    ],
  },
  'multiplayer.join': {
    id: 'multiplayer.join',
    description: 'Player joined or room created.',
    defaultGain: 0.38,
    cooldownMs: 500,
    variants: [
      { assetId: 'hazard-upgrade-c-2', src: `${HAZARD_PATH}/upgrade-c-2.ogg`, gain: 0.38, playbackRate: [1.0, 1.1] },
    ],
  },
  'multiplayer.leave': {
    id: 'multiplayer.leave',
    description: 'Player left room.',
    defaultGain: 0.2,
    cooldownMs: 500,
    variants: [
      { assetId: 'generated-multiplayer-leave', gain: 0.2, generated: { waveform: 'sine', frequencyHz: 330, endFrequencyHz: 180, durationMs: 150 } },
    ],
  },
  'glitch.validated': {
    id: 'glitch.validated',
    description: 'Successful Glitch install validation.',
    defaultGain: 0.38,
    cooldownMs: 1000,
    variants: [
      { assetId: 'hazard-upgrade-e-1', src: `${HAZARD_PATH}/upgrade-e-1.ogg`, gain: 0.38, playbackRate: [1.0, 1.04] },
      { assetId: 'hazard-upgrade-e-2', src: `${HAZARD_PATH}/upgrade-e-2.ogg`, gain: 0.36, playbackRate: [1.0, 1.04] },
    ],
  },
  'glitch.denied': {
    id: 'glitch.denied',
    description: 'Generated low warning tone for denied access.',
    defaultGain: 0.28,
    cooldownMs: 1000,
    variants: [
      { assetId: 'generated-glitch-denied', gain: 0.28, generated: { waveform: 'square', frequencyHz: 170, endFrequencyHz: 110, durationMs: 220 } },
    ],
  },
  'progress.achievement': {
    id: 'progress.achievement',
    description: 'Achievement unlock fanfare.',
    defaultGain: 0.58,
    cooldownMs: 600,
    variants: [
      { assetId: 'hazard-upgrade-e-1', src: `${HAZARD_PATH}/upgrade-e-1.ogg`, gain: 0.58, playbackRate: [0.94, 1.0] },
      { assetId: 'hazard-upgrade-e-2', src: `${HAZARD_PATH}/upgrade-e-2.ogg`, gain: 0.56, playbackRate: [0.94, 1.0] },
    ],
  },
  'coaster.guest': {
    id: 'coaster.guest',
    description: 'Guest happiness or soft park event.',
    defaultGain: 0.3,
    cooldownMs: 500,
    variants: [
      { assetId: 'hazard-upgrade-c-1', src: `${HAZARD_PATH}/upgrade-c-1.ogg`, gain: 0.3, playbackRate: [1.25, 1.38] },
    ],
  },
};
