'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Music, Volume2, VolumeX, X } from 'lucide-react';
import { GameAudioEngine, AudioSettings, loadAudioSettings } from './audioEngine';
import { GAME_AUDIO_EVENT, GameAudioCueDetail } from './audioEvents';
import { MUSIC_TRACK_MANIFEST } from './musicManifest';
import { GameAudioCue } from './soundManifest';

interface AudioContextValue {
  settings: AudioSettings;
  play: (cue: GameAudioCue, gain?: number) => void;
  setEnabled: (enabled: boolean) => void;
  setMasterVolume: (volume: number) => void;
  setSfxVolume: (volume: number) => void;
  setMusicEnabled: (enabled: boolean) => void;
  setMusicVolume: (volume: number) => void;
  setMusicTrack: (trackId: string) => void;
}

const AudioContext = createContext<AudioContextValue | null>(null);

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AudioSettings>(() => loadAudioSettings());
  const [engine] = useState(() => new GameAudioEngine(settings));

  const updateSettings = useCallback((next: Partial<AudioSettings>) => {
    const updated = engine.setSettings(next);
    setSettings(updated);
  }, [engine]);

  const play = useCallback((cue: GameAudioCue, gain?: number) => {
    engine.playCue(cue, gain);
  }, [engine]);

  useEffect(() => {
    const unlock = () => {
      engine.unlock().catch(() => undefined);
    };
    window.addEventListener('pointerdown', unlock, { once: true, passive: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [engine]);

  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<GameAudioCueDetail>).detail;
      if (!detail?.cue) return;
      engine.playCue(detail.cue, detail.gain, detail.allowDuringCooldown);
    };
    window.addEventListener(GAME_AUDIO_EVENT, listener);
    return () => window.removeEventListener(GAME_AUDIO_EVENT, listener);
  }, [engine]);

  const value = useMemo<AudioContextValue>(() => ({
    settings,
    play,
    setEnabled: (enabled) => updateSettings({ enabled }),
    setMasterVolume: (masterVolume) => updateSettings({ masterVolume }),
    setSfxVolume: (sfxVolume) => updateSettings({ sfxVolume }),
    setMusicEnabled: (musicEnabled) => updateSettings({ musicEnabled }),
    setMusicVolume: (musicVolume) => updateSettings({ musicVolume }),
    setMusicTrack: (musicTrackId) => updateSettings({ musicTrackId }),
  }), [play, settings, updateSettings]);

  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>;
}

export function MusicControls({ className = '' }: { className?: string }) {
  const { settings, setMusicEnabled, setMusicTrack, setMusicVolume } = useGameAudio();
  const [open, setOpen] = useState(false);
  const CurrentIcon = settings.musicEnabled ? Music : VolumeX;

  return (
    <div className={`relative h-10 w-10 ${className}`}>
      {!open ? (
        <button
          type="button"
          className="h-10 w-10 inline-flex items-center justify-center rounded bg-slate-900/90 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors shadow-lg"
          aria-label={settings.musicEnabled ? 'Music settings' : 'Enable music'}
          title={settings.musicEnabled ? 'Music settings' : 'Enable music'}
          onClick={() => setOpen(true)}
        >
          <CurrentIcon className="h-4 w-4" />
        </button>
      ) : (
        <div
          className="absolute w-72 max-w-[calc(100vw-1rem)] bg-slate-950/95 border border-slate-700 text-white shadow-xl p-3 space-y-3"
          style={{ bottom: 'calc(100% + 0.5rem)', left: 0 }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Music className="h-4 w-4 text-slate-400" />
              <span>Music</span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-7 w-7 inline-flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10"
              aria-label="Close music settings"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <select
            value={settings.musicTrackId}
            onChange={(event) => setMusicTrack(event.target.value)}
            className="w-full bg-slate-900 border border-slate-700 px-2 py-2 text-sm text-white outline-none focus:border-slate-500"
            aria-label="Music track"
          >
            {MUSIC_TRACK_MANIFEST.map((track) => (
              <option key={track.id} value={track.id}>
                {track.title}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMusicEnabled(!settings.musicEnabled)}
              className="h-8 w-8 inline-flex items-center justify-center border border-slate-700 text-slate-300 hover:text-white hover:bg-white/10"
              aria-label={settings.musicEnabled ? 'Mute music' : 'Enable music'}
              title={settings.musicEnabled ? 'Mute music' : 'Enable music'}
            >
              {settings.musicEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={settings.musicVolume}
              onChange={(event) => setMusicVolume(Number(event.target.value))}
              className="min-w-0 flex-1"
              aria-label="Music volume"
            />
            <span className="w-9 text-right text-xs text-slate-400">
              {Math.round(settings.musicVolume * 100)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export function useGameAudio(): AudioContextValue {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useGameAudio must be used within AudioProvider');
  }
  return context;
}

export function AudioToggleButton({ className = '' }: { className?: string }) {
  const { settings, setEnabled } = useGameAudio();
  const Icon = settings.enabled ? Volume2 : VolumeX;
  return (
    <button
      type="button"
      className={className}
      aria-label={settings.enabled ? 'Mute sound effects' : 'Enable sound effects'}
      title={settings.enabled ? 'Mute sound effects' : 'Enable sound effects'}
      onClick={() => setEnabled(!settings.enabled)}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
