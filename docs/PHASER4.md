# Phaser 4 implementation notes

Research checked October 17, 2026 against official release pages and the exact installed npm package. The current stable release is **Phaser 4.2.1 “Giedi,” released July 9, 2026**. The official archive and `npm view phaser version dist-tags --json` agreed on 4.2.1. The npm `beta` tag still points to 4.0.0-rc.7; using that tag would move this project backward.

## Primary references

- [Official release archive](https://phaser.io/download/archive) and [4.2.1 release](https://phaser.io/download/release/v4.2.1).
- [README at the 4.2.1 tag](https://github.com/phaserjs/phaser/blob/v4.2.1/README.md): supported installation/import and engine overview.
- [Versioned migration guide](https://github.com/phaserjs/phaser/blob/v4.2.1/changelog/v4/4.0/MIGRATION-GUIDE.md): rendering changes and retained APIs.
- [4.2.1 changelog](https://github.com/phaserjs/phaser/blob/v4.2.1/changelog/v4/4.2.1/CHANGELOG-v4.2.1.md): includes ESM and ScaleManager fixes.
- [Versioned new-features skill](https://github.com/phaserjs/phaser/blob/v4.2.1/skills/v4-new-features/SKILL.md), [setup skill](https://github.com/phaserjs/phaser/blob/v4.2.1/skills/game-setup-and-config/SKILL.md), and [filter skill](https://github.com/phaserjs/phaser/blob/v4.2.1/skills/filters-and-postfx/SKILL.md).
- [4.2.1 TypeScript definitions](https://github.com/phaserjs/phaser/blob/v4.2.1/types/phaser.d.ts) and [source](https://github.com/phaserjs/phaser/tree/v4.2.1/src): final authority for call signatures in this project.
- [Official Phaser 4 feature overview](https://phaser.io/phaser4): direction and capability overview, not a benchmark for this game.

These are engine version 4 references. Phaser Editor version numbers describe a separate product. Generic tutorials, early-beta material, and an unversioned docs page can describe older APIs. For example, official news articles differ on the import form; the tagged README, package exports, and actual Vite runtime verify `import Phaser from 'phaser'` for 4.2.1.

## Decisions and checked APIs

The original project did not use Phaser. The new code starts from Scenes and engine systems rather than emulating its manual game loop.

| Concern | Phaser 4.2.1 approach |
| --- | --- |
| Renderer | `type: Phaser.WEBGL`; RenderNodes replace the old rendering pipeline system. Canvas cannot provide the intended showcase effects. |
| Object filters | Call `sprite.enableFilters()` first, then `sprite.filters.internal.addGlow(...)`. Filters may also be external; prefer smaller internal effects where suitable. |
| Camera filters | `camera.filters.internal.addVignette(...)`; cameras already own filter lists. |
| Bloom | Compose `ParallelFilters` with threshold/blur/additive blending, or use `Phaser.Actions.AddEffectBloom`. Do not call a removed dedicated v3 bloom FX factory. |
| Color grading | `const filter = camera.filters.internal.addColorMatrix(); filter.colorMatrix...` rather than calling color methods directly on the controller. |
| Lighting | `sprite.setLighting(true)` and `lights.addLight(x, y, radius, color, intensity, z)`; no `setPipeline('Light2D')`. |
| GPU ambient layer | `this.add.spriteGPULayer(texture, capacity)` and `layer.addMember({...})`. Members accept GPU-driven animation descriptors. Populate once; avoid per-frame buffer edits. |
| GPU animation pause | `layer.setTimerPaused(true)`; checked against ElapseTimer source. |
| Tint | `setTint(color)` plus `setTintMode(Phaser.TintModes.FILL)` when fill behavior is intended. |
| Masks | Unified filter masks such as `sprite.filters.internal.addMask(...)`; no WebGL BitmapMask. |
| Shaders | Configuration-based Shader API and v4 GLSL pragmas. Use RenderNodes for future custom renderer extensions. |
| RenderTexture | Buffered draw operations require `render()`; do not rely on immediate v3 drawing behavior. |
| Collections | Current Group children use a native Set. Use `group.getChildren()` or native iteration, not a copied old `.children.each(...)` example. |
| Texture coordinates | Standard images are handled automatically. Custom shader/texture tooling must observe v4's GL orientation. |

The current mission exercises camera filters, integrated player lighting, a 220-member GPU ambient layer, Scenes, loader, global atlas animations, Arcade Physics/overlaps/pools, normalized keyboard/pointer/touch/gamepad input, scene timers, camera zoom/resize, sound pools and synthesized AudioBuffers cached through Phaser Sound. Remaining rows are guidance for later features, not claims of implementation.

## Guardrails

1. Keep `phaser` pinned exactly to `4.2.1` and retain package-lock.json. Upgrades require reviewing their versioned changelogs and rerunning browser checks.
2. Run `npm run check`; it checks the version, rejects common removed renderer calls, and type-checks our source. The scan is a narrow guard, not proof that every API is correct.
3. Check unfamiliar calls in the installed source/type definitions and versioned examples. Shipped skills help, but prose and typings may have gaps; verify important effects in a browser.
4. Do not substitute deprecated methods or suppress type errors to make copied code appear to work. The application uses no `any` casts for engine calls.
5. Reserve SpriteGPULayer for ambient/decorative instances; ordinary physics-enabled entities remain normal sprites. GPU layer limits and dynamic-buffer costs matter more than headline sprite counts.
6. Profile effects and lighting on real hardware. Internal filters still add render work; GPU animation does not remove fill-rate or memory limits.

No general claim that Phaser is faster than every other 2D browser engine has been established. The showcase should make the case through this game's visual quality, responsiveness, tooling, and measured results.

## Context restoration finding

The refinement pass found a retained destroyed SpriteGPULayer frame-data wrapper in 4.2.1. The [diagnosis and reproduction](GRAPHICS_RECOVERY.md) describe the isolated renderer-hook workaround and real loss/restoration check. The engine version pin also protects this workaround from silently carrying into a future release. Automatic quality continues using the same virtual camera/world, rather than resizing gameplay geometry.
