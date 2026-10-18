import { GameAudioCue } from './soundManifest';

export const GAME_AUDIO_EVENT = 'isocity:audio-cue';

export interface GameAudioCueDetail {
  cue: GameAudioCue;
  gain?: number;
  allowDuringCooldown?: boolean;
}

export function emitAudioCue(cue: GameAudioCue, detail: Omit<GameAudioCueDetail, 'cue'> = {}): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<GameAudioCueDetail>(GAME_AUDIO_EVENT, {
    detail: { cue, ...detail },
  }));
}

