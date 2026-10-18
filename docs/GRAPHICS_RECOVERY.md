# Graphics recovery in Phaser 4.2.1

A browser context-loss test uncovered a reproducible engine failure after the harbor Scene was stopped: `WebGLTextureWrapper.createResource` accessed a null renderer during restoration.

The exact installed 4.2.1 source explains the retained reference. `SpriteGPULayer.preDestroy()` calls `frameDataTexture.destroy()` directly; that clears the wrapper's renderer and texture, but leaves the wrapper in `WebGLRenderer.glTextureWrappers`. `dispatchContextRestored()` subsequently calls `createResource()` on every registry entry. The same deleted 3×1 frame-data texture was visible in an independent runtime probe immediately after the harbor-to-mission transition, before any quality change.

[GraphicsRecovery.ts](../remake/src/game/GraphicsRecovery.ts) isolates a workaround behind an exact version check. The renderer's documented context-handler hook removes only registry entries whose renderer has already been cleared by destruction, then calls Phaser's normal restoration method. It preserves live wrappers and delegates resource recreation to Phaser. No engine files or prototypes are modified. Review and remove/revise this workaround when upgrading the engine.

The interface uses Phaser's renderer loss/restoration events. Loss pauses the mission and mix, blocks blind resume and render-setting changes, and offers an explicit reload if the browser cannot restore the view. Restoration leaves the flight paused for the player to resume. The mission's own pause method also rejects a resume while the renderer remains lost.

`npm run test:delivery` uses the real `WEBGL_lose_context` extension after automatic/manual quality changes. It verifies frozen time, position and hull; blocked keyboard/button resume while lost; the restoration event; and resumed time only after an explicit action. The restored screenshot is in `docs/evidence/refinement/context-restored.png`. This is a Chromium software-renderer recovery test, not a claim of recovery coverage across all devices.
