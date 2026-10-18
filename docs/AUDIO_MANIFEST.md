# Audio Manifest

This game now has a shared audio system in `src/lib/audio`, a structured SFX manifest in `src/lib/audio/soundManifest.ts`, and a structured music-loop manifest in `src/lib/audio/musicManifest.ts`. The same audio provider is available to IsoCity and IsoCoaster.

## Runtime Files

The following files are bundled under `public/audio/hazard-pay/free-upgrade-sfx/` and are wired into runtime cues:

| id | file | source | license status | use |
| --- | --- | --- | --- | --- |
| `hazard-upgrade-a-1` | `upgrade-a-1.ogg` | Hazard Pay, `Free Upgrade SFX.zip` | cleared for runtime | building placement |
| `hazard-upgrade-a-2` | `upgrade-a-2.ogg` | Hazard Pay, `Free Upgrade SFX.zip` | cleared for runtime | building placement alt |
| `hazard-upgrade-b-1` | `upgrade-b-1.ogg` | Hazard Pay, `Free Upgrade SFX.zip` | cleared for runtime | zoning, roads, UI select |
| `hazard-upgrade-b-2` | `upgrade-b-2.ogg` | Hazard Pay, `Free Upgrade SFX.zip` | cleared for runtime | zoning, roads, UI select alt |
| `hazard-upgrade-c-1` | `upgrade-c-1.ogg` | Hazard Pay, `Free Upgrade SFX.zip` | cleared for runtime | save/confirm/economy cue |
| `hazard-upgrade-c-2` | `upgrade-c-2.ogg` | Hazard Pay, `Free Upgrade SFX.zip` | cleared for runtime | save/confirm/multiplayer cue |
| `hazard-upgrade-d-1` | `upgrade-d-1.ogg` | Hazard Pay, `Free Upgrade SFX.zip` | cleared for runtime | larger upgrades and rides |
| `hazard-upgrade-d-2` | `upgrade-d-2.ogg` | Hazard Pay, `Free Upgrade SFX.zip` | cleared for runtime | larger upgrades and rides alt |
| `hazard-upgrade-e-1` | `upgrade-e-1.ogg` | Hazard Pay, `Free Upgrade SFX.zip` | cleared for runtime | achievements and Glitch validation |
| `hazard-upgrade-e-2` | `upgrade-e-2.ogg` | Hazard Pay, `Free Upgrade SFX.zip` | cleared for runtime | achievements and Glitch validation alt |

Hazard Pay's public asset page says the pack is free for game use, credit is not required, and users must not claim ownership of the sounds. The source URL and SHA-256 checksums are recorded in code.

## Excluded Ambience Pack

`Gregor Quendel - Free General Ambience Sounds.zip` was inspected but not copied into `public/`. The ZIP did not include a license file, and public listings for the same or overlapping recordings show mixed license signals. The manifest records the pack as `excluded_pending_license_review`.

To enable those ambience files later:

1. Confirm the exact source page/license for the downloaded archive allows this game's intended commercial distribution.
2. Copy only the selected files into `public/audio/gregor-quendel/general-ambience/`.
3. Add each file to `AUDIO_ASSET_MANIFEST` with source URL, license, attribution, byte size, and SHA-256.
4. Add loop or one-shot cue entries in `AUDIO_CUE_LIBRARY`.

## Runtime Music

The music bundle `music-loop-bundle-2026-q2.zip` was inspected and copied into `public/audio/abstraction/music-loop-bundle/`.

The included `_LICENSE.txt` says the bundle is CC0/Public Domain and permits commercial and non-commercial use, modification, and redistribution. Attribution is optional. The included `_README.txt` recommends OGG files for seamless looping, so only the `.ogg` loops were bundled; metadata PNG files were intentionally excluded from runtime assets.

All music entries are recorded in `MUSIC_TRACK_MANIFEST` with original filename, sanitized runtime filename, public path, source archive, creator, source URL, byte size, SHA-256, intended game fit, and license summary. The source license and README files are shipped beside the loops:

- `public/audio/abstraction/music-loop-bundle/_LICENSE.txt`
- `public/audio/abstraction/music-loop-bundle/_README.txt`

Default tracks:

| game | default track id | runtime file |
| --- | --- | --- |
| IsoCity | `week-18-distant-skyline-city-lights` | `week-18-distant-skyline-city-lights.ogg` |
| IsoCoaster | `week-21-freefall-glide` | `week-21-freefall-glide.ogg` |

Music playback starts after the browser's first user gesture. Players can open the music control in-game to change tracks, mute/unmute music, and adjust music volume independently from sound effects. SFX mute remains separate from music mute.

## Cue Model

Game code emits named cues with `emitAudioCue(...)`. The audio provider chooses variants, handles browser gesture unlock, applies cooldowns, and uses generated Web Audio tones where no licensed file exists.

Important cues:

| cue | purpose |
| --- | --- |
| `build.place` | generic city/building placement |
| `build.zone` | zoning and terrain brushes |
| `build.road` | roads, paths, queues, drag placement |
| `build.bulldoze` | generated demolition tone |
| `coaster.track` | coaster track construction |
| `coaster.ride` | large ride and coaster mode feedback |
| `ui.confirm` | save/import/positive UI action |
| `multiplayer.join` | room creation or join |
| `glitch.validated` | successful Glitch install validation |
| `glitch.denied` | failed validation or access block |
| `progress.achievement` | achievement-style fanfare |
