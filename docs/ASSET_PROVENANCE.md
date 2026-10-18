# Mission assets

The original tutorial art/audio remains byte-for-byte in `archives/legacy-canvas/`; its source attribution still needs to be completed before distribution. `remake/scripts/prepare-assets.mjs` produces bounded atlases without altering source frame pixels. Enemy sheets use the first verified animation row; ambiguous Angler2 rows and fractional fireball slicing are not carried into the mission.

## New engine chamber

Saved project asset: [`remake/public/assets/worlds/engine-chamber.png`](../remake/public/assets/worlds/engine-chamber.png), 1672 × 941 pixels. Generated with the built-in image generation tool on October 17, 2026. It is consumed by the third part's background. The asset is included in the workspace; the application does not depend on an external generation-cache path.

Final generation prompt:

> Use case: stylized-concept. Asset type: production background plate for a 2D horizontal scrolling underwater shooter, 16:9 landscape. Create a beautiful painterly game background of a drowned brass foundry's ancient engine chamber: enormous oxidized bronze turbine machinery, deep teal water, distant industrial architecture and faint cyan bioluminescence, warm amber lamps, atmospheric layers and elegant volumetric shafts. STRICT side-on orthographic game view, matching colorful illustrated steampunk sea-creature sprites rather than photorealism. The central 65 percent of the image must remain calm dark open water with subtle distant silhouettes so bright small bullets and enemies remain readable; keep sharp busy machinery around upper and lower edges and at far right only. A vast dim circular engine mechanism appears far behind the combat plane on the right, softly painted and not a foreground target. Cohesive premium art direction with rich turquoise shadows and restrained copper highlights. No characters, enemies, ships, bullets, HUD, lettering, logos or watermark. This is a single background plate, not a mockup, no UI, no borders. Landscape wide image.

Projectile, pickup, core, shield and warning shapes are code-native graphics. Their geometry and colors are intentionally consistent with gameplay semantics: cyan friendly fire/core, amber hostile shots, mint Tideguard, red marked hazard lanes.

## Original score

The five mission/boss themes and overload percussion stem are authored as note/chord/instrument data in [`compose-score.mjs`](../remake/scripts/compose-score.mjs). That deterministic script synthesizes the PCM files locally without external samples or a music service. Warning and action cues are synthesized in `AudioBus.ts`. The five retained tutorial effects remain subject to the legacy attribution check above. See [score and mixer details](AUDIO_SCORE.md).
