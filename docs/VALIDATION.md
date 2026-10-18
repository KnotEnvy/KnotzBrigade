# Validation — October 17, 2026

## Preservation and engine

`node scripts/verify-archive.mjs` passes for all **35 original files**. The manifest preserves the original working-tree bytes, including prior CRLF-only changes, from source commit `d5edd10e3e4ca1ddfa1d34dfe59e01b4bf79c986`. Asset preparation reads that archive and writes only generated remake assets. The initial independent player-atlas check compared every row of all 78 frames with the source pixels. The mission now uses 11 bounded, extruded atlases; preparation enforces a 2048×2048 texture ceiling.

`npm run check` passes: exact **Phaser 4.2.1** pin, scan for common removed v3 rendering APIs, strict application TypeScript. Installed versioned source/types were consulted for lighting, filter lists, GPU layers, tint, camera resizing, Arcade groups and sound. The scan is a guard, not proof of every API. Node 24.21.0 and npm 11.19.0 were used.

Production compilation passes. The current full-engine JavaScript is about 1.44 MB minified / 379 KB gzip; Vite reports its normal large-chunk notice. The bundle retains the full engine. `git diff --check` and archive verification pass.

## Reproducible browser suite

From `remake/`, install Playwright Chromium once (`npx playwright install chromium`) and run `npm test`. It prepares assets and starts an isolated Vite server on a free loopback port. An existing browser can be selected with `PLAYWRIGHT_CHROMIUM_EXECUTABLE`.

The latest [machine-readable results](evidence/mission/test-results.json) contain **15 passing checks**, zero uncaught game errors:

- Actual Arcade overlap resolves a non-piercing projectile against one target; duplicate death cannot award score twice.
- Tideguard catches hostile fire, observes cooldown and releases a countershot.
- Hit protection and actual scene pause/resume work.
- Auto-fire interaction preserves the pause shortcut; harbor return resets the Pause label.
- Pressure gates block friendly/hostile fire, their opening is safe, scrapes respect protection, and clean passages award once.
- Boss reinforcement and catch-score budgets are finite.
- Six restarts retain one mission handler per action, stable pooled sound counts and one canvas; a synthetic checkpoint clear cannot alter full-run records or clear count.
- A Surge that kills the guardian stops the director in the same frame; no replacement boss spawns.
- Part-three practice uses a CLEAR grade, a one-relay target, attainable advice, and Replay preserves the same practice entry.
- All three sector reports appear; practice from part one stores separate sector records and cannot set a full-run best.
- Pilot/Lance, Pilot/Fan and Ace/Lance complete all three parts with **input only**, observing both boss phases and every signature attack.
- Portrait 390×844 supports launch, Guard, pause/resume without horizontal overflow.
- Landscape 844×390 keeps Launch inside the harbor, hides flight controls before launch, supports hold Focus and visible header Pause.

Full-run simulations use the real Scene Manager and Arcade Physics updates at 60 simulated steps/second, omitting intermediate rendering. The bot selects real directional keys and ability requests; it does not modify health, damage, score, waves or progression. Controlled fixtures are separate and explicitly labelled in the test script. Simulation timings vary slightly with initial browser timing; they are **not frame-rate measurements or human playtests**. Exact latest run data and attack histories are in the JSON.

| Input-only run | Simulated clear time | Carrier | Guardian |
|---|---:|---:|---:|
| Pilot / Lance | 183.3s | 20.5s | 35.7s |
| Pilot / Fan | 183.2s | 29.7s | 26.4s |
| Ace / Lance | 203.2s | 26.4s | 49.8s |

The latest runs take zero, one and four hull damage respectively, with all three relays retrieved. Both Pilot rigs see each boss's defining mechanics. The carrier uses armor/catch volleys/hatch openings/a body charge; the guardian uses actual destructible linked conduits/core openings/curtains/mines/vents. These checks do not establish how a new human player perceives difficulty or fun.

## Production and failure checks

After building, run `node scripts/test-production.mjs` with the same browser setup. [Production results](evidence/mission/production-results.json) pass:

- Static production output boots under `/mission/`, with optional fonts blocked and the development inspection hook absent.
- Launch, keyboard input, pause, settings, quality resize to 640×360 and resume work.
- A missing critical player atlas produces a visible error and disables launch.
- Unsupported WebGL produces an actionable error and disables launch.
- No uncaught game errors or failed game-asset requests in the successful production run.

## Score, delivery and recovery checks

`npm run test:delivery` passes **10 checks**, with zero uncaught browser errors. [Delivery evidence](evidence/refinement/delivery-results.json) records:

- Five original sector/boss themes and an overload stem decode and loop at fixed pitch. Real audio transport drives bar-aligned changes; warning ducking recovers, pause holds music and active effects, and independent sliders persist.
- The six decoded loops total **18,144,000 bytes**, versus **55,037,952 bytes** for the archived music reference, a reduction of approximately **67%**. The archived MP3 is served only by the test helper for this comparison and is omitted from remake loading.
- Continuous AudioWorklet sampling after the master compressor/safety curve, with all three volume sliders at maximum and six cues, four explosions and four shots overlapping, retained **58,368 samples**, peak **0.9565**, RMS **0.1569**. This verifies electrical output under a deliberately crowded fixture, not perceived balance or listening quality.
- A controlled sustained **23.3ms** frame fixture lowers automatic rendering to 640×360 while preserving player position, hull and world bounds. A manual High setting is retained under a missed-frame fixture. These are functional checks, not hardware benchmarks.
- Real `WEBGL_lose_context` loss freezes the flight and blocks keyboard/button resume. Restoration preserves time, position and hull; the player explicitly resumes. This uncovered and fixed a retained destroyed GPU-layer wrapper in Phaser 4.2.1; see [diagnosis](GRAPHICS_RECOVERY.md).
- A missing Warden score asset shows an error and leaves launch disabled, rather than allowing a later combat failure.

The new [authored score and mixer](AUDIO_SCORE.md) replace the single legacy music loop. Composition, transitions, priority cues, final-output headroom and lifecycle are exercised; the mix has not been heard in this environment.

## Normally rendered complete flights

`npm run test:rendered` runs complete flights with ordinary rendering and the same input-only pilot. It never stops or manually advances the game loop and never changes clock, health, damage, score, waves or progression. Every sector theme, boss theme and overload layer actually becomes active in audio time. The run records frame intervals, encounter segments, music transitions, quality changes and final stats. Touch refers to browser layout/input-capability emulation; the pilot still selects input states rather than physically operating two thumbs.

The [initial full-flight trace](evidence/refinement/rendered-flight-auto-baseline.json) contains two normal clears, zero browser errors and all three relays in each. Desktop completed in **195.90s**, lowering 960×540 to 640×360 at **108.29s**. Its early segments consistently took about **23.3ms/frame** (~43fps), revealing that Auto's original “late” cutoff of 25ms overlooked a stable sub-60fps regime. After reduction, Warden's normal phase measured median **16.7ms / p95 17.3ms**. The criterion was corrected to a sustained mean above 19ms with over 20% of samples above 20ms, retaining warmup and a single reduction per flight.

The unchanged coarse-touch path starts at the lowest preset, so this threshold change cannot reduce it further. Its complete **180.54s** run retained **10,822 frames**, median **16.7ms**, p95 **17.2ms**, p99 **19.1ms**, worst **49.1ms**, with four intervals over 33.5ms. Warden overload's p95 was **17.1ms**. This is sustained software-renderer evidence through normal encounters, rather than an accelerated clear or a forced boss fixture. The initial collector retained positive intervals below one second; the revised desktop collector retains every positive interval.

The affected desktop path was rerun with `npm run test:rendered -- desktop-auto`. The [corrected desktop trace](evidence/refinement/rendered-desktop-auto.json) clears normally in **191.16s wall time**, with three relays, one hull damage, all themes/phases/signatures and zero browser errors. Auto lowers once at **6.12s**, preserving the 1120px physics bounds, versus the earlier 108.29s reduction. Across **11,024 frames**, mean interval is **17.34ms**, median **16.8ms**, p95 **25.4ms**, p99 **30.0ms**, worst **118.7ms**, with 48 intervals above 33.5ms. Warden normal/overload p95 values are **21.4/24.1ms**. The median and mean improve; this trace does not claim an improvement in every tail statistic or a perfectly locked 60fps.

The corrected run's mission clock ends at **189.925s**, approximately **1.24s** behind wall time. The maximum retained frame interval is **118.7ms**, so that cumulative difference is not evidence of a single 1.24-second stall. Its precise cause is unassigned. Runs occurred sequentially on shared-host SwiftShader with different encounter histories, so these measurements support the targeted cutoff repair and sustained reachability, not a controlled causal hardware benchmark. The touch path was not repeated after a threshold change that cannot affect its already-lowest preset.

## Independent review and visual evidence

The first fresh-context critic produced [round 1](CRITIC_ROUND_1.md), mean **7.31/10**, no category above the user's 8.8 gate. Its control, boss, score and layout findings drove the next implementation. Round 2 reached [8.35/10](CRITIC_ROUND_2.md), with the per-category gate still unmet. Its authored-routing, boss-state, phone-HUD and per-part feedback findings drove revision 3. Round 3 reached [8.72/10](CRITIC_ROUND_3.md); controls and boss design scored 8.9, while the every-category gate remained unmet. Its practice-scope defect, courier composition and contrast findings were addressed next. [Round 4](CRITIC_ROUND_4.md) reached **8.83 mean**, with **8/10 categories strictly above 8.8**; audio remained 8.3 provisional and reliability/performance 8.8.

The new authored score, mixer, automatic rendering, measured cutoff repair and actual context recovery were assessed by a fresh [round 5 critic](CRITIC_ROUND_5.md). It independently exercised keyboard/Focus, settings/music pause, independent music mute, real context loss/restoration with explicit resume, and portrait touch Guard/Pause. It inspected the full-flight traces after profiling ended and found no remaining confirmed gameplay/source defect. The fixed scores are **nine categories at 8.9**, **audio/feedback 8.7 provisional**, mean **8.88**. The strict every-category gate remains **unmet** because the mix has not been heard. More audio code or source-only scores cannot establish perceptual balance, musical payoff or fatigue. Real-device play and human first-play/retry observation remain useful validation. Reviews are saved separately as `CRITIC_ROUND_*.md` files; scores are editorial judgments, not empirical proof of superiority to R-Type or Gradius.

Screenshots: [harbor](evidence/mission/harbor.png), [carrier](evidence/mission/pilot-lance-hivewhale.png), [guardian](evidence/mission/pilot-lance-bulbwhale-phase2.png), [debrief](evidence/mission/pilot-lance-debrief.png), [portrait flight](evidence/mission/mobile-flight.png), [landscape harbor](evidence/mission/landscape-harbor.png), [landscape flight](evidence/mission/landscape-flight.png), [production](evidence/mission/production.png).

## Practical limits

T3's collaborative browser was attempted first; its host explicitly lacked libnspr4, libnss3, libnssutil3 and libasound. Verification used local Playwright Chromium with already available temporary runtime libraries and **software WebGL**. No host-wide installation was needed.

Software-renderer performance on a shared host cannot certify physical-device frame pacing. A short fully rendered [early-mission sample](evidence/mission/software-render-profile.json) measured median/p95 intervals of 16.7/33.3ms at 960×540, 16.7/16.7ms at 640×360 and 33.4/50ms at 1280×720. Encounter times/load differ between those sequential samples, so they are not a controlled causal comparison, sustained-combat test or general device claim. A separate [controlled Warden-overload fixture](evidence/mission/software-boss-profile.json) at 640×360 retained 180 live frame samples: median16.7ms, p9516.8ms, about60fps with up to24 hostile shots. Its boss HP/clock were deliberately moved to that phase, auto-fire was off, and the boss remained active; this is a short load fixture, not a legitimate clear or full-run benchmark. A renderer probe without a forced software flag still reported SwiftShader; this workspace exposes no GPU device node.

Automatic rendering starts at 960×540 desktop or 640×360 touch and can lower resolution once per flight after a sustained missed-frame window. Manual 640×360, 960×540 and 1280×720 choices retain unchanged virtual arena/physics. Existing manual preferences are preserved. Effects and reduced-motion controls remain independent.

Real GPU/phone measurements, physical controller input, listening to the audio mix, broader browser coverage and human enjoyment remain unverified. Context restoration is now covered by the real software-WebGL loss test described above. The older [audio sample](evidence/mission/audio-output.json) and short frame fixtures are historical evidence from before the authored-score/automatic-quality refinement; the new delivery data supersedes the mix measurement. Neither electrical sampling nor a bot establishes musical appeal or genuine human enjoyment. No public deployment was performed.
