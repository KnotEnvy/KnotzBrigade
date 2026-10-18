# Knotz Brigade — The Drowned Foundry

A Phaser **4.2.1** underwater horizontal shooter. Mission 01 is a complete three-part flight with a carrier miniboss and a furnace guardian. The original Canvas project remains unchanged in [archives/legacy-canvas/](archives/legacy-canvas/).

## Play

Requires Node 20.19+ on the 20.x line, or 22.12+ (verified with Node 24).

```sh
cd remake
npm ci
npm run dev
```

Open http://127.0.0.1:5197. Steer with WASD/arrows; hold Shift for precision. Auto-fire starts on. **X** catches enemy fire and releases a countershot; **C** spends full resonance on Surge. **P / Escape** pauses. Touch has a stick, Focus, Guard, Surge and header Pause; gamepad mappings appear in the flight manual.

The Breakwater teaches the flight and pressure-gate routing; the Brood Convoy ends with the charging Broodkeeper; Heart of the Works combines mines and vents before the Warden's linked conduits. Choose Lance or Fan and Cadet, Pilot or Ace. Checkpoints allow practice retries; full-run records are separate by rig and difficulty.

```sh
npm run check
npm test             # requires Playwright Chromium; see remake/README.md
npm run build
npm run preview      # http://127.0.0.1:4297
```

The current refinement adds an [authored adaptive score](docs/AUDIO_SCORE.md), separate music/effects sliders, Automatic render quality and safe graphics recovery. Complete normally rendered desktop and touch-emulated flights pass; the desktop trace caught and corrected a delayed Auto reduction.

See [mission design](docs/MISSION_01.md), [validation and its limits](docs/VALIDATION.md), [Phaser 4 research](docs/PHASER4.md), and [asset provenance](docs/ASSET_PROVENANCE.md). Automated input-only clears establish progression, not human enjoyment or physical-device frame pacing. Five fresh-context reviews improved the mean from 7.31 to **8.88**. The [latest critique](docs/CRITIC_ROUND_5.md) rates nine of ten categories at 8.9; audio remains **8.7 provisional**, so the strict every-category-above-8.8 gate remains unmet without listening. It found no remaining confirmed gameplay/source defect. All reports remain in `docs/CRITIC_ROUND_*.md`.

## Original project

From this repository root, run `python3 -m http.server 4197 --bind 127.0.0.1` and open http://127.0.0.1:4197/archives/legacy-canvas/. Original controls: Enter starts, Up/Down moves, Space fires, D toggles debug.

`node scripts/verify-archive.mjs` verifies all 35 original working-tree files against their preservation manifest, including pre-existing line-ending changes. The [initial project review](docs/PROJECT_REVIEW.md) explains the fresh implementation. Legacy asset attribution remains to be completed before distribution.
