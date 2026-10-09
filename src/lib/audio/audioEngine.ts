import { AUDIO_CUE_LIBRARY, AudioCueVariant, GameAudioCue } from './soundManifest';
import { DEFAULT_COASTER_MUSIC_TRACK_ID, DEFAULT_MUSIC_TRACK_ID, getMusicTrack } from './musicManifest';

const AUDIO_SETTINGS_KEY = 'isocity-audio-settings-v1';

export interface AudioSettings {
  enabled: boolean;
  masterVolume: number;
  sfxVolume: number;
  musicEnabled: boolean;
  musicVolume: number;
  musicTrackId: string;
}

const DEFAULT_SETTINGS: AudioSettings = {
  enabled: true,
  masterVolume: 0.72,
  sfxVolume: 0.86,
  musicEnabled: true,
  musicVolume: 0.42,
  musicTrackId: DEFAULT_MUSIC_TRACK_ID,
};

function getDefaultSettings(): AudioSettings {
  return {
    ...DEFAULT_SETTINGS,
    musicTrackId: isCoasterRuntime() ? DEFAULT_COASTER_MUSIC_TRACK_ID : DEFAULT_MUSIC_TRACK_ID,
  };
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

function randomBetween([min, max]: [number, number]): number {
  return min + Math.random() * (max - min);
}

function isCoasterRuntime(): boolean {
  if (process.env.NEXT_PUBLIC_GLITCH_GAME_KEY === 'coaster') return true;
  return typeof window !== 'undefined' && window.location.pathname.startsWith('/coaster');
}

export function loadAudioSettings(): AudioSettings {
  const defaults = getDefaultSettings();
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = window.localStorage.getItem(AUDIO_SETTINGS_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<AudioSettings>;
    return {
      enabled: parsed.enabled ?? defaults.enabled,
      masterVolume: clampUnit(parsed.masterVolume ?? defaults.masterVolume),
      sfxVolume: clampUnit(parsed.sfxVolume ?? defaults.sfxVolume),
      musicEnabled: parsed.musicEnabled ?? defaults.musicEnabled,
      musicVolume: clampUnit(parsed.musicVolume ?? defaults.musicVolume),
      musicTrackId: typeof parsed.musicTrackId === 'string' ? parsed.musicTrackId : defaults.musicTrackId,
    };
  } catch {
    return defaults;
  }
}

export function saveAudioSettings(settings: AudioSettings): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(settings));
}

export class GameAudioEngine {
  private settings: AudioSettings;
  private htmlAudioCache = new Map<string, HTMLAudioElement>();
  private lastPlayedAt = new Map<GameAudioCue, number>();
  private context: AudioContext | null = null;
  private unlocked = false;
  private musicAudio: HTMLAudioElement | null = null;
  private activeMusicTrackId: string | null = null;

  constructor(settings: AudioSettings = loadAudioSettings()) {
    this.settings = settings;
    this.preloadLicensedAssets();
  }

  getSettings(): AudioSettings {
    return this.settings;
  }

  setSettings(next: Partial<AudioSettings>): AudioSettings {
    const previousTrackId = this.settings.musicTrackId;
    this.settings = {
      enabled: next.enabled ?? this.settings.enabled,
      masterVolume: clampUnit(next.masterVolume ?? this.settings.masterVolume),
      sfxVolume: clampUnit(next.sfxVolume ?? this.settings.sfxVolume),
      musicEnabled: next.musicEnabled ?? this.settings.musicEnabled,
      musicVolume: clampUnit(next.musicVolume ?? this.settings.musicVolume),
      musicTrackId: next.musicTrackId ?? this.settings.musicTrackId,
    };
    saveAudioSettings(this.settings);
    if (this.settings.musicTrackId !== previousTrackId) {
      this.startMusic(this.settings.musicTrackId).catch(() => undefined);
    } else {
      this.applyMusicSettings();
    }
    return this.settings;
  }

  async unlock(): Promise<void> {
    if (typeof window === 'undefined' || this.unlocked) return;
    this.context = this.context ?? new window.AudioContext();
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
    this.unlocked = true;
    if (this.settings.musicEnabled) {
      this.startMusic().catch(() => undefined);
    }
  }

  playCue(cue: GameAudioCue, gainOverride?: number, allowDuringCooldown = false): void {
    const definition = AUDIO_CUE_LIBRARY[cue];
    if (!definition || !this.settings.enabled) return;

    const now = performance.now();
    const lastPlayedAt = this.lastPlayedAt.get(cue) ?? 0;
    if (!allowDuringCooldown && now - lastPlayedAt < definition.cooldownMs) {
      return;
    }
    this.lastPlayedAt.set(cue, now);

    const variant = definition.variants[Math.floor(Math.random() * definition.variants.length)];
    const gain = clampUnit((gainOverride ?? definition.defaultGain) * variant.gain * this.settings.masterVolume * this.settings.sfxVolume);

    if (variant.src) {
      this.playHtmlAudio(variant, gain);
      return;
    }

    if (variant.generated) {
      this.playGeneratedTone(variant, gain);
    }
  }

  private preloadLicensedAssets(): void {
    if (typeof window === 'undefined') return;
    for (const definition of Object.values(AUDIO_CUE_LIBRARY)) {
      for (const variant of definition.variants) {
        if (!variant.src || this.htmlAudioCache.has(variant.src)) continue;
        const audio = new Audio(variant.src);
        audio.preload = 'auto';
        audio.crossOrigin = 'anonymous';
        this.htmlAudioCache.set(variant.src, audio);
      }
    }
  }

  private playHtmlAudio(variant: AudioCueVariant, gain: number): void {
    if (!variant.src) return;
    const cached = this.htmlAudioCache.get(variant.src);
    const audio = cached?.cloneNode(true) as HTMLAudioElement | undefined;
    if (!audio) return;

    audio.volume = gain;
    audio.playbackRate = variant.playbackRate ? randomBetween(variant.playbackRate) : 1;
    audio.play().catch(() => {
      // Browsers reject play() before a user gesture. The provider retries future cues after unlock.
    });
  }

  private playGeneratedTone(variant: AudioCueVariant, gain: number): void {
    if (!variant.generated || typeof window === 'undefined') return;
    this.context = this.context ?? new window.AudioContext();
    const context = this.context;
    if (context.state === 'suspended') return;

    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    const start = context.currentTime;
    const duration = variant.generated.durationMs / 1000;
    const endFrequency = variant.generated.endFrequencyHz ?? variant.generated.frequencyHz;

    oscillator.type = variant.generated.waveform;
    oscillator.frequency.setValueAtTime(variant.generated.frequencyHz, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration);

    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), start + 0.015);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    oscillator.connect(envelope);
    envelope.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  async startMusic(trackId: string = this.settings.musicTrackId): Promise<void> {
    if (typeof window === 'undefined') return;
    const track = getMusicTrack(trackId);
    if (this.activeMusicTrackId !== track.id || !this.musicAudio) {
      this.stopMusic();
      this.musicAudio = new Audio(track.publicPath);
      this.musicAudio.loop = true;
      this.musicAudio.preload = 'auto';
      this.musicAudio.crossOrigin = 'anonymous';
      this.activeMusicTrackId = track.id;
    }
    this.applyMusicSettings();
    if (!this.settings.musicEnabled || !this.unlocked) return;
    await this.musicAudio.play();
  }

  stopMusic(): void {
    if (!this.musicAudio) return;
    this.musicAudio.pause();
    this.musicAudio.currentTime = 0;
    this.musicAudio = null;
    this.activeMusicTrackId = null;
  }

  private applyMusicSettings(): void {
    if (!this.musicAudio) return;
    this.musicAudio.volume = clampUnit(this.settings.masterVolume * this.settings.musicVolume);
    if (!this.settings.musicEnabled) {
      this.musicAudio.pause();
      return;
    }
    if (this.unlocked) {
      this.musicAudio.play().catch(() => undefined);
    }
  }
}
