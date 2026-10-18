import Phaser from 'phaser';

/** Phaser 4.2.1 can retain a destroyed wrapper when a GPU-layer Scene closes.
 * Its restore pass calls createResource on every entry, including those whose
 * renderer was cleared by destroy(). Remove only those dead entries first.
 * Keep this version-specific workaround isolated; no engine files are patched.
 */
export function installGraphicsRecovery(renderer: Phaser.Renderer.WebGL.WebGLRenderer): void {
  if (Phaser.VERSION !== '4.2.1') throw new Error('Recheck the graphics-recovery workaround when upgrading Phaser.');
  renderer.setContextHandlers(undefined, (event: WebGLContextEvent) => {
    for (const list of [renderer.glTextureWrappers, renderer.glBufferWrappers, renderer.glProgramWrappers, renderer.glFramebufferWrappers, renderer.glVAOWrappers]) {
      for (let i = list.length - 1; i >= 0; i--) if (list[i].renderer === null) list.splice(i, 1);
    }
    renderer.dispatchContextRestored(event);
  });
}
