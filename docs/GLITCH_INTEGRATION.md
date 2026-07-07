# Glitch Integration

Glitch is implemented as an optional layer. Normal local builds behave as they did before. A build becomes Glitch-backed only when `NEXT_PUBLIC_GLITCH_ENABLED=1`.

## Title Registry

The shared registry lives in `src/lib/glitch/config.ts`.

| game | route | title id | runtime token env | deploy token env |
| --- | --- | --- | --- | --- |
| IsoCity | `/` and `/coop/[roomCode]` | `ed2b4375-3918-4916-8736-aae299226363` | `NEXT_PUBLIC_GLITCH_ISOCITY_TITLE_TOKEN` | `GLITCH_ISOCITY_DEPLOY_TOKEN` |
| IsoCoaster | `/coaster` and `/coaster/coop/[roomCode]` | `e51bcfd1-ffda-4038-b124-b4cb090fb8a7` | `NEXT_PUBLIC_GLITCH_COASTER_TITLE_TOKEN` | `GLITCH_COASTER_DEPLOY_TOKEN` |

Runtime title tokens are client credentials for install/cloud-save/progression/multiplayer routes. Deploy tokens are not client credentials and are only read by scripts.

## Runtime Boot Flow

`src/lib/glitch/GlitchProvider.tsx` performs the runtime boot sequence:

1. Detect the game from the route or `NEXT_PUBLIC_GLITCH_GAME_KEY`.
2. Create a `GlitchClient` with the title id and runtime title token.
3. If the Glitch parent iframe supplies `install_id`, `user_install_id`, and `session_id` query parameters, adopt those identifiers first. This keeps the game attached to the logged-in Glitch install instead of creating a local guest install.
4. Otherwise create or reuse an install with `POST /titles/{title_id}/installs`.
5. Persist Glitch's returned `install_id`.
6. Validate access with `POST /titles/{title_id}/installs/{install_id}/validate`.
7. Block play when `valid` is false or the token is missing while the flag is enabled.
8. Refresh the install every 60 seconds. Parent-provided installs are refreshed by validation; standalone local installs are refreshed by reusing the same `user_install_id` and `session_id`.

The provider never reads deploy tokens, admin JWTs, or server tokens.

The coaster Glitch deployment is launched at the container root URL. `src/proxy.ts` therefore rewrites root requests to `/coaster` whenever `NEXT_PUBLIC_GLITCH_GAME_KEY=coaster`. This prevents the IsoRollerCoaster title from rendering the IsoCity root page inside the Glitch iframe.

## Cloud Saves

Cloud save support is in `src/lib/glitch/cloudSave.ts` and `src/hooks/useGlitchGameServices.ts`.

The hook runs inside each game component and is inert unless Glitch is validated. It stores slot `0` autosaves by:

1. Serializing the current game state to JSON bytes.
2. Base64 encoding those raw bytes.
3. Computing SHA-256 over the decoded raw bytes, not the base64 string.
4. Sending `slot_index`, `payload`, `checksum`, `save_type`, `client_timestamp`, and `base_version`.
5. Storing the returned cloud `version` in localStorage for optimistic concurrency.

If Glitch returns a 409 conflict, the code logs the conflict object and does not overwrite silently. A future UI can surface `keep_server` versus `use_client` using `resolveSaveConflict`.

When the player is inside a multiplayer room, autosaves intentionally store a per-user rejoin handle instead of the full shared world. That handle contains the game key, room code, saved timestamp, player count, and `source_of_truth: glitch_lobby_event_log`. This prevents each player from creating a competing personal cloud copy of the same city. Solo play still stores the full local state in the user's cloud slot.

Guest installs may receive `GUEST_NOT_ALLOWED` for cloud saves. That is handled as a skip rather than a crash. In normal Glitch iframe play, the parent install context should prevent logged-in users from being treated as guests.

## Multiplayer and MMO

`src/lib/multiplayer/providerFactory.ts` selects the provider:

- Glitch disabled: existing Supabase realtime provider.
- Glitch enabled: `src/lib/multiplayer/glitchProvider.ts`.

The Glitch provider uses documented multiplayer routes:

- Creates public lobbies with `game_mode` set to `isocity-coop` or `coaster-coop` unless a future caller explicitly marks the room private.
- Uses the existing 5-character room code as `map_name` and `metadata.room_code`.
- Stores a deterministic room seed in lobby metadata: game key, room code, city/park name, grid size, capacity, and `source_of_truth`.
- Lets creators set `Number Of Players That Can Join`, clamped to 1-64 for the current browser-client topology.
- Lists public joinable rooms through `GET /titles/{title_id}/multiplayer/lobbies`.
- Joins rooms by searching lobbies with that game mode and map name.
- Sends small edit commands through lobby messages with `message_type: "system"`.
- Replays ordered lobby messages from sequence 0 for late joiners, starting from the deterministic room seed.
- Splits oversized placement batches and drops anything that still exceeds the documented 4 KB control-plane limit.
- Sends text chat as `message_type: "chat"` lobby messages and displays the last 100 messages.
- Creates or joins Glitch voice rooms attached to the lobby, stores voice participant tokens only in memory, heartbeats voice state, and uses the documented packet/poll fallback for browser microphone chunks when supported.
- Attempts MMO presence only when `NEXT_PUBLIC_GLITCH_MMO_PRESENCE_ENABLED=1`, then lists an existing active realm and city zone before calling `world/enter` and `world/presence`. The flag is off by default because HAR evidence showed the realm route redirecting to the game container and failing CORS in the current production environment.

Important limitation: the attached Glitch docs explicitly say lobby messages are a control plane and not realtime gameplay replication. There is no documented shared room-state database endpoint in the exported context. For that reason, large full-state snapshots are not pushed through Glitch lobby messages. The current implementation uses an event-sourced room model: deterministic seed plus ordered, compact edit actions. This gives horizontally scalable active rooms because no browser is the only persisted source of truth, but it is still not a replacement for a dedicated authoritative simulation server for very large or long-lived MMO worlds.

The existing Supabase provider remains the fallback when Glitch is disabled. Supabase still provides database-backed shared room state in that mode. Voice chat is marked unsupported in Supabase fallback because the requested voice implementation is tied to Glitch voice rooms and participant tokens.

## Chat and Voice UI

The multiplayer badge now doubles as the communication dock. When connected, it shows:

- Room code.
- Copy invite button.
- Visible `Chat` button that opens text chat and voice controls.
- Visible `Talk` button that joins or leaves lobby voice directly.
- Current players.
- Voice errors when microphone or relay access fails.

This badge is mounted at the top-right of both IsoCity and IsoCoaster on mobile and desktop so it is not hidden behind Glitch capture controls or the in-game sidebars.

## Invite Links

When Glitch is enabled, invite links are generated with the public Glitch play URL:

`https://www.glitch.fun/games/{title_id}/play?room={ROOM_CODE}`

They no longer copy the Azure Container Apps instance host. The local `/coop/{code}` and `/coaster/coop/{code}` links are used only when Glitch is disabled.

## Behavioral Events

Behavior events are implemented in:

- `src/lib/glitch/behaviorEvents.ts`
- `src/lib/glitch/GlitchAnalyticsProvider.tsx`

The game sends single runtime events through:

`POST /titles/{title_id}/events`

Each event includes the validated `game_install_id`, `step_key`, `action_key`, optional sanitized metadata, and a client timestamp. The code does not load `game-analytics.js` because that tracker already lives in the Glitch parent iframe.

Stable event areas:

| step_key | action examples | purpose |
| --- | --- | --- |
| `gameplay` | `start`, `end` | session duration and drop-off |
| `game_start` | `single_player_selected`, `new_city`, `new_park` | mode-selection funnel |
| `toolbox` | `select_tool` | build intent and tool usage |
| `build` | `place`, `bulldoze`, `finish_track_drag` | core construction funnel |
| `coaster_builder` | `start_build`, `place_track_line`, `finish_build`, `cancel_build` | coaster-specific build funnel |
| `panel` | `open` | UI navigation and feature discovery |
| `simulation` | `pause`, `set_speed` | pacing behavior |
| `economy` | `money_milestone`, `cash_milestone`, `money_added`, `cash_added` | progression and economy behavior |
| `progression` | `population_milestone`, `guest_milestone`, `upgrade_service_building` | milestone funnels |
| `multiplayer_setup` | `create_start`, `create_success`, `join_start`, `join_connected`, `join_error` | co-op setup funnel |
| `multiplayer_discovery` | `search_start`, `search_complete`, `select_room` | public city/park discovery funnel |
| `multiplayer_room` | `create_attempt`, `create_success`, `join_attempt`, `join_success`, `leave` | room lifecycle |
| `multiplayer_chat` | `send_text` | communication engagement without message content |
| `multiplayer_voice` | `start_attempt`, `stop`, `mute`, `unmute`, `deafen`, `undeafen` | voice engagement |
| `multiplayer_invite` | `copy_link`, `room_created_from_share` | invite funnel |
| `cloud_save` | `attempt`, `saved`, `conflict`, `guest_or_denied`, `too_large`, `error` | cloud-save reliability |

Metadata is intentionally stripped of sensitive keys such as email, tokens, user names, city names, park names, and chat text.

## Achievements and Leaderboards

The client wrapper implements the documented shared submit endpoint:

`POST /titles/{title_id}/installs/{install_id}/submit`

The current dashboard export says no leaderboard or achievement definitions are loaded for either title. The game therefore does not invent api keys. Configure these env lists after creating definitions in Glitch:

- `NEXT_PUBLIC_GLITCH_ISOCITY_LEADERBOARD_KEYS`
- `NEXT_PUBLIC_GLITCH_ISOCITY_STAT_KEYS`
- `NEXT_PUBLIC_GLITCH_COASTER_LEADERBOARD_KEYS`
- `NEXT_PUBLIC_GLITCH_COASTER_STAT_KEYS`

Future code can then map in-game metrics to those exact keys.

## Deployment

This is a Next.js app, so the correct Glitch deployment type is `node` and the entry point is `server.js`. Static `iframe` or `wasm` deployment would not include the Next server.

Scripts:

```bash
npm run build:glitch:isocity
npm run build:glitch:coaster
npm run deploy:glitch:isocity:dry-run
npm run deploy:glitch:coaster:dry-run
npm run deploy:glitch:isocity
npm run deploy:glitch:coaster
```

Deploy scripts build a standalone Next artifact, copy `.next/static` and `public`, write `glitch.deploy.json`, run a Glitch CLI dry-run, then upload only when the deploy script includes `--deploy`.

Node deployments also require a root `Dockerfile` in the uploaded ZIP. The artifact builder writes a minimal Dockerfile that runs the standalone Next server on `PORT=3000`, sets `HOSTNAME=0.0.0.0`, removes host-platform `node_modules`, and runs `npm ci --omit=dev` inside the Linux container. `package-lock.json` is copied into the artifact for that install step. Generated artifacts live under `.glitch-build/` and are gitignored.

Use local shell or CI secrets:

```bash
export GLITCH_ISOCITY_TITLE_TOKEN="..."
export GLITCH_ISOCITY_DEPLOY_TOKEN="..."
export GLITCH_COASTER_TITLE_TOKEN="..."
export GLITCH_COASTER_DEPLOY_TOKEN="..."
```

Never store deploy tokens in source, `public/`, `.env.example`, or `NEXT_PUBLIC_*` variables.
