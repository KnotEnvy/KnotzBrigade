# The Drowned Foundry — Mission 01

A complete three-part horizontal shooter in Phaser **4.2.1**, TypeScript and Vite. Start in the harbor; the flight ends in a scored debrief or checkpoint retry.

## Commands

```sh
npm ci
npm run dev        # http://127.0.0.1:5197
npm run check      # exact engine pin, removed-v3-API scan, TypeScript
npx playwright install chromium  # once, for browser tests
npm test           # builds legacy atlases, runs isolated browser simulations
npm run build      # prepares assets, checks, produces dist/
npm run test:delivery # real-time score, mixer, pause and adaptive-render checks
npm run test:rendered # two full normally rendered flights; takes several minutes
npm run test:rendered -- desktop-auto # rerun only the desktop flight
npm run test:production # subdirectory build + failure checks, after build
npm run preview    # http://127.0.0.1:4297 after build
```

Use Node ^20.19.0 or >=22.12.0. Package versions are pinned in package-lock.json. Dev/preview bind to loopback; static output uses relative paths and supports subdirectory hosting. The full Phaser bundle is intentionally retained and triggers Vite's large-chunk notice.

Tests can use an existing browser through `PLAYWRIGHT_CHROMIUM_EXECUTABLE`. Linux needs Chromium's normal runtime libraries. This workspace's verification used the available temporary browser libraries via `LD_LIBRARY_PATH`; those host-specific paths are not project dependencies. Tests start an isolated Vite server on a free port and close it afterward. Mission/production evidence goes to `../docs/evidence/mission/`; score/delivery/rendered evidence goes to `../docs/evidence/refinement/`. The main mission suite omits intermediate rendering; `test:rendered` uses ordinary real-time rendering. Both use the same input-only pilot without changing health, score, waves or boss damage. Separate controlled fixtures test collisions, scoring and persistence. These runs do not establish human enjoyment or physical-device performance.

## Controls and settings

WASD/arrows steer, Shift focuses, X/right mouse catches and counters, C activates Surge. Auto-fire starts enabled; disable it to fire with Space. P/Escape pauses, M mutes, F opens fullscreen. Touch provides an analog stick and Focus/Guard/Surge buttons. Dragging the arena also steers. Gamepad: left stick/D-pad move, A fire, B guard, X surge, L1 focus. Physical controller hardware remains unverified.

Automatic rendering is the default for new saves: it starts at 960×540 on desktop or 640×360 on touch, then can lower desktop rendering once per flight if a sustained frame window misses budget. Manual 640×360, 960×540 and 1280×720 settings remain available. Existing manual preferences are preserved; choose Automatic in Settings to enable adaptation. All use the same 1280×720 virtual world and physics. Effects and reduced-motion options are independent. Local settings and per-rig/per-flight records tolerate denied or corrupt storage. Checkpoint clears are labelled practice and cannot overwrite full-run records.

## Structure

- `src/core/mission.ts`: authored waves, enemy tuning, difficulties, ranks.
- `src/scenes/BootScene.ts`, `HarborScene.ts`, `MissionScene.ts`: loading, menu, mission director/combat.
- `src/scenes/OceanScene.ts`: shared parallax, lighting/filter setup, virtual camera, GPU ambient layer.
- `src/game/Actors.ts`, `PilotInput.ts`, `Feedback.ts`, `AudioBus.ts`, `MusicDirector.ts`, `RenderGovernor.ts`: pooled actors, input, visual and audio feedback.
- `src/main.ts`, `style.css`, `index.html`: accessible HTML interface, settings, touch controls and debrief.
- `scripts/prepare-assets.mjs`: 11 bounded atlases, selected images and audio; never alters the archive.
- `scripts/test-mission.mjs`: actual-browser regression fixtures and complete input-only flight runs.

The [original authored score](../docs/AUDIO_SCORE.md) uses five scene themes, an overload layer, bar-aligned transitions and independent music/effects controls. The legacy boss MP3 is preserved in the archive and omitted from remake loading.

Graphics loss pauses the mission and permits explicit resume after restoration. An isolated, version-guarded [4.2.1 recovery workaround](../docs/GRAPHICS_RECOVERY.md) handles a destroyed GPU-layer wrapper retained by the engine; review it when upgrading Phaser.

All generated textures stay below 2048px; extruded atlas gutters preserve original frame pixels. Generated legacy assets are ignored and recreated before dev, build and tests. The new engine-chamber background is a tracked source asset; its prompt is in [asset provenance](../docs/ASSET_PROVENANCE.md).

Use [the Phaser 4 notes](../docs/PHASER4.md) and installed versioned source/types when adding engine calls. Phaser 4 uses RenderNodes, filter lists, integrated lighting and SpriteGPULayer; do not substitute Phaser 3 rendering APIs. `window.__KNOTZ_GAME__` is available only in development builds for inspection and tests.
