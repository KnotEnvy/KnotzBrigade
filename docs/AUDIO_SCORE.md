# The Drowned Foundry — authored score and mix

The remake now uses five original eight-bar themes and a separate overload percussion layer. The composition is written in [compose-score.mjs](../remake/scripts/compose-score.mjs); it uses synthesized instruments, with no downloaded samples. The old tutorial boss music remains unchanged in the archive and is no longer loaded by the remake.

| Cue | Musical role |
|---|---|
| Breakwater | Upper-register D-minor motif, soft pads, bell echoes and a restrained pulse |
| Brood Convoy | Lower, repeating motif with stronger percussion and a tightening bass progression |
| Heart of the Works | Suspended, darker chord colors and a sparse high motif |
| Broodkeeper | Low call-and-response phrase and a more insistent carrier rhythm |
| Furnace Warden | Developed upper motif over a darker four-chord cycle |
| Overload layer | Offbeat mechanical double pulses and light sixteenth-note ticks, added in phase two |

All cues share 112 BPM and an eight-bar form. Voice tails wrap across the PCM loop boundary. The mixer maintains one shared transport; requested sector/boss changes take effect at a bar boundary and crossfade. The overload layer adds rhythmic pressure without changing pitch. Separate victory/defeat stingers finish the flight while impact tails remain audible.

The Music and Effects & warnings sliders operate independently beneath Master volume and mute. Warning, exposed-core, phase and Surge cues briefly lower music with a fast attack and a slower recovery. Overlapping priority cues extend that envelope. Scene pause holds the transport and active effect voices. Restart destroys the scene's sounds and mixer listener; decoded buffers are reused from Phaser's cache.

A game-owned Web Audio master chain compresses crowded transients, followed by a bounded safety curve. The curve is linear below 0.85 amplitude; ordinary low-level signals pass unchanged. One chain is retained across scene restarts and disconnected on game destruction. The delivery test samples the final output continuously while all three sliders are at maximum and warnings, firing and explosions overlap. This verifies electrical headroom; it does not establish perceived loudness, musical quality or freedom from listening fatigue.

`npm run assets` generates six mono 22,050 Hz, 16-bit PCM WAV files and `score.json` under the ignored `remake/public/assets/score/` directory. Each loop is approximately 17.14 seconds and 756 KB. The manifest records duration, peak, RMS and boundary sample delta. These are reproducible signal measurements, not a listening assessment.

Run `npm run test:delivery` after preparing assets to verify real-time transitions, fixed playback rate, pause, independent controls, signal headroom, decoded memory and render-governor behavior. `npm run test:rendered` performs two complete flights with ordinary rendering and an input-only pilot. Detailed evidence is saved under `docs/evidence/refinement/`.
