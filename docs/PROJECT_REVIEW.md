# Knotz Brigade: review and remake direction

Reviewed October 17, 2026. Recommendation: preserve the original and start a fresh Phaser 4 implementation, reusing selected assets and ideas. This is an engine replacement from a custom Canvas game, not a Phaser 3 upgrade.

## Where the previous work stopped

The project began as a 2023 JavaScript/Canvas tutorial. The latest committed work is August 20, 2025:

- `47ec7aa`: added the state machine, menu, game-over report, health, and presentation feedback.
- `d5edd10`: subsequent script2.js bug fix; this is the reviewed HEAD.

The page actually loads [script2.js](../archives/legacy-canvas/script2.js), approximately 992 lines in one load-event closure. [script.js](../archives/legacy-canvas/script.js) is an older implementation, and [BaseSideShooterSetup.js](../archives/legacy-canvas/BaseSideShooterSetup.js) is an earlier scaffold. They are not three modules of the active game. `ultracolor.py` is an unrelated color constants reference. There was no package manager, engine dependency, module build, test suite, or CI configuration.

The apparent local modifications on entry were all CRLF-only changes across seven files. The archive preserves those working-tree bytes, rather than resetting them to the last commit. All 35 source/asset files were hashed before moving and verified afterward. Their snapshot is [recorded here](../archives/legacy-canvas.manifest.json).

## What already works

The active build has a main menu, fade transitions, a 60-second score attack, and a mission report with ranks and stats. The player moves vertically, fires limited ammunition, regenerates ammo, and can enter a ten-second power-up state with a second firing position. The run starts with 20 health and 20 ammo; ammo capacity is 50.

Nine enemy classes are implemented: two anglers, Lucky Fish, Hive Whale, Drone, Bulb Whale, Moon Fish, Stalker, and Razorfin. Eight are random spawn choices; drones emerge from a destroyed Hive Whale. There are four parallax layers, sprite animations, explosions, gear particles, a shield hit animation, hit flash, recoil, camera shake, six sound effects, and one music track. These are good ingredients for a distinct underwater mechanical shooter.

Browser inspection confirmed the original menu, start transition, movement, shooting, and all 20 images loading without uncaught exceptions during a short smoke run. This was not a full 60-second gameplay or balancing test. [Menu evidence](evidence/legacy-menu.png) and [gameplay evidence](evidence/legacy-playing.png) are retained.

## Why a fresh implementation is worthwhile

Rendering, input, movement, collisions, state, sound, and UI all share one closure and mutable Game object. Porting those classes line by line would carry their assumptions into Phaser rather than taking advantage of its scene lifecycle, physics, animation, input, loader, sound, camera, and timing systems.

Specific findings in the active script:

| Area | Finding | Remake approach |
| --- | --- | --- |
| Timing | Player/enemy/background movement, sprite frame advancement, recoil damping, and fade progress advance per rendered frame. The timer uses delta time, so faster displays change difficulty relative to the clock. | Physics velocities in pixels/second, Phaser animations, timers, tweens, and consistent pause behavior. |
| Collisions | A projectile marked for deletion remains eligible in later collision checks. A defeated enemy remains eligible within the current inner loop. Overlapping targets/shots can therefore produce extra hits or kill rewards. | Pool lifecycle and one authoritative damage/death resolution path; regression cases for overlapping targets. |
| Shield | Collision resets a shield animation, but non-lucky collisions still immediately subtract health. There is no shield charge check or protection interval. | Explicit shield ability, visible cooldown, clear damage rules and invulnerability windows. |
| Report accuracy | Only the top shot increments projectilesFired. The secondary power-up shot does not, and repeated collision checks can inflate hits. | Count every emitted projectile and its first valid hit once. |
| Reset | Entering play resets many fields but leaves timers such as enemyTimer/ammoTimer and shield animation state untouched. | Fresh run state, scene-owned resources, and explicit reset tests. |
| Audio | HTML audio elements are restarted directly; there is no volume/mute UI, pooled sound handling, or music stop on the game-over transition. | Phaser sound lifecycle, gesture unlock, settings, music transitions, and audio feedback budget. |
| Content | Weighted random spawns every two seconds; no authored waves, enemy attack patterns, boss fight, objectives, or biome progression. | A wave director, readable enemy roles, authored pacing, and one proper boss. |
| Devices | Fixed 1000 × 500 canvas and keyboard input; no pause, gamepad, touch combat, or saved scores. | Responsive camera/UI, pause/focus behavior, deliberate touch/gamepad layouts, then versioned save data. |

Additional frame metadata needs cleanup: the shield image contains 24 frames while the animation can index beyond them; Angler2 is 337 pixels tall while the code assumes two 165-pixel rows; the fireball code slices 145 pixels into fractional 36.25-pixel frames. These should be resolved in the asset metadata rather than copied into loader settings.

## Asset audit

There are 20 PNGs and seven audio files. The entire original snapshot is 9,542,454 bytes. The music alone is 6,240,129 bytes, about 65% of that size. Confirm its source and evaluate compressed/streamed delivery before shipping.

The art is worth retaining as reference and prototype material. The original sheet layout is a Canvas convenience, and several sheets exceed common WebGL texture limits:

| Sheet | Original pixels | Migration action |
| --- | --- | --- |
| Player | 4680 × 380 | Already losslessly repacked by the new asset script to 1488 × 1358, with 78 named frames. |
| Angler1 / Angler2 | 8892 × 507 / 8307 × 337 | Repack and verify row boundaries. |
| Hive Whale | 15600 × 227 | Repack into bounded atlas pages. |
| Bulb Whale / Moon Fish | 10530 × 438 / 8853 × 240 | Repack into bounded atlas pages. |
| Stalker | 9477 × 123 | Repack. |
| Drone / Razorfin | 4485 × 190 / 7293 × 149 | Repack for the planned 2048-pixel atlas budget. |
| Four backgrounds | 1768 × 500 each | Already usable by the survey scene; revisit resolution and segmentation for new biomes. |

Keep the archive untouched. Use generated atlases with gutters, explicit frame metadata, and named animations. A small file on disk can still exceed a device's maximum GPU texture dimension. The new foundation checks WebGL support and uses textures smaller than 2048 pixels on each axis.

The repository has no asset attribution manifest or formal LICENSE file. Its README says it is open source, but does not identify the tutorial art/audio permissions. Record the original sources and reuse permissions before public distribution. This is an inventory gap, not a reason to discard the assets during local prototyping.

## Proposed game direction

Keep the underwater mechanical world and the Brigade name. Build a responsive side-scrolling action game with free movement, expressive weapons, intentional dodging, salvage, and memorable sea-machine enemies. The distinguishing visual language should be oxidized brass, deep teal, luminous sea life, and warm pools of machinery light.

Working biome ideas, not finalized names or commitments:

- **Brasswake Foundry:** flooded machines and abandoned lamps. Reuse the current art to prove combat. Currents and machinery hazards shape movement.
- **Lumen Reef:** living coral around forgotten technology. New bioluminescent creatures, light-reactive attacks, and layered organic silhouettes.
- **The Black Engine:** a deep trench surrounding an enormous dormant machine. Sonar reveals, pressure hazards, and a multi-phase guardian.

The best first milestone is a complete two-to-three-minute Brasswake vertical slice: three enemy roles, one shield ability, one power-up, authored encounter pacing, one telegraphed boss, good audio, a mission report, and immediate replay. It should feel good with temporary art before expanding into more worlds.

Use image generation after choosing the art direction: a coherent biome style sheet, separate parallax plates with matching perspective, and character concepts with consistent scale, palette, silhouette, and light direction. Generated character concepts still need production animation and atlas work. Avoid treating an arbitrary generated grid as an animation-ready sprite sheet. No new generated art was needed for this review.

## How Phaser becomes the showcase

Use engine features where they improve the play experience, with a small optional rendering lab for comparisons. Phaser 4's new renderer is WebGL; this plan does not assume a WebGPU backend. Retained systems such as Arcade Physics and Scenes are valid Phaser 4 APIs even when their names are familiar from Phaser 3.

| Capability | Intended game use | Status |
| --- | --- | --- |
| Scene lifecycle and loader | Independent boot, menu, run, HUD, pause, and debrief responsibilities. | Boot and survey scenes implemented. Full game scene split is future work. |
| Arcade Physics and pools | Fast player motion, bullets, damage overlaps, stable performance. | Movement and a bounded projectile pool implemented. Enemy combat is future work. |
| Unified internal/external filters | Readable overdrive glow, depth grading, selective bloom, sonar masks, water displacement. | Internal sprite glow and camera vignette implemented, with an on/off comparison. |
| Lighting component | Lamps, glowing fauna, weapons, later normal maps or image-based lighting where warranted. | One moving player light with v4 setLighting implemented. Final world lighting is future work. |
| SpriteGPULayer | Dense drifting particles, distant schools, decorative life with GPU animation. | 600 ambient members initialized once; GPU animation drives their motion. |
| TileSprite / TilemapGPULayer | Parallax art now; large authored scenery later if a tile-based world merits it. | Four TileSprites implemented. GPU tilemaps remain an evaluated option. |
| Cameras, tweens, animation, sound, input | Impact feedback, transitions, fair telegraphs, accessibility settings, full device support. | Frame-rate-based animation, a camera fade, keyboard/pointer movement, pause/focus handling implemented. Audio/gamepad/full touch are future work. |
| CaptureFrame, shaders, RenderNodes | A distinctive sonar/refraction treatment that fits the game. | Planned experiments after core combat and profiling. No v3 pipeline code. |

Rendering targets should be demonstrated, not claimed from marketing benchmarks. Establish a representative maximum encounter, frame-time percentiles, draw calls, texture memory, loading budget, and mobile quality presets on named real devices. A stable 60 fps on an agreed desktop and mobile reference set is a target, not a measured result of this review. Readability and input response take priority over filter count.

## What was established in this pass

- Preserved all original files in `archives/legacy-canvas/` with checksums and browser evidence.
- Created `remake/` with exact Phaser 4.2.1, Vite, TypeScript, and a lockfile.
- Built a running survey prototype to validate the first asset pipeline and real Phaser 4 rendering APIs.
- Added a guard against common removed Phaser 3 rendering calls and documented the versioned primary references.

This prototype is not the vertical slice. It deliberately has no enemies, damage, progression, objective, boss, or audio. Those are the next substantive game tasks.

## Recommended build order

1. **Combat feel:** movement/aim decisions, hold-to-fire, tighter hitboxes, shield rules, damage feedback, reusable projectile/enemy pools; validate keyboard and one target touch layout.
2. **Brasswake vertical slice:** repack selected enemies; three distinct behaviors, authored waves, boss telegraphs, victory/defeat/debrief/replay, and sound settings. Add meaningful tests for one-hit resolution, kill rewards, reset, and pause.
3. **Visual identity:** lock the art bible; create unique biome layers and enemies; integrate selective lighting, normal maps, particles, sonar/refraction, and graphics presets.
4. **Production readiness:** real-device profiling, audio/texture delivery budgets, accessibility and reduced-motion choices, gamepad, saved progress, provenance, deployment and CI.

## Validation

The actual commands, browser checks, and current limitations are recorded in [VALIDATION.md](VALIDATION.md). This assessment separates source findings, tested behavior, and proposed work; the presence of a sprite or music file is not evidence of a finished boss or level.
