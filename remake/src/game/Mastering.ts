import Phaser from 'phaser';

const outputs = new WeakMap<Phaser.Sound.WebAudioSoundManager, AudioNode>();

/** One master chain per game, retained across mission restarts. Normal signals
 * stay linear; compression and a bounded curve catch crowded impact peaks. */
export function masterOutput(scene: Phaser.Scene): AudioNode | undefined {
  const manager = scene.sound;
  if (!(manager instanceof Phaser.Sound.WebAudioSoundManager)) return undefined;
  const existing = outputs.get(manager); if (existing) return existing;
  const context = manager.context, compressor = context.createDynamicsCompressor(), ceiling = context.createWaveShaper();
  compressor.threshold.value = -4; compressor.knee.value = 6; compressor.ratio.value = 10;
  compressor.attack.value = 0.003; compressor.release.value = 0.18;
  const curve = new Float32Array(4097);
  for (let i = 0; i < curve.length; i++) {
    const x = i / (curve.length - 1) * 2 - 1, magnitude = Math.abs(x);
    curve[i] = Math.sign(x) * (magnitude <= 0.85 ? magnitude : 0.85 + 0.13 * Math.tanh((magnitude - 0.85) / 0.13));
  }
  ceiling.curve = curve; ceiling.oversample = 'none';
  manager.masterVolumeNode.disconnect(context.destination);
  manager.masterVolumeNode.connect(compressor); compressor.connect(ceiling); ceiling.connect(context.destination);
  outputs.set(manager, ceiling);
  scene.game.events.once(Phaser.Core.Events.DESTROY, () => { compressor.disconnect(); ceiling.disconnect(); outputs.delete(manager); });
  return ceiling;
}
