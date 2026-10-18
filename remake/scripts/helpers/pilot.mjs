// Browser-only input driver shared by accelerated and normally rendered checks.
// It changes key states and requests abilities; no health, score, or progression edits.
export function installPilot() {
  window.__steerPilot = () => {
    const game = window.__KNOTZ_GAME__, s = game.scene.getScene('mission');
    if (!s?.player?.active || s.ending || s.scene.isPaused()) return;
            const enemies = s.enemies.getChildren().filter(e => e.active && e.x > s.player.x + 60 && e.x < 1350);
            const bullets = s.hostile.getChildren().filter(b => b.active);
            const drops = s.pickups.getChildren().filter(d => d.active && d.x > 90 && d.x < 730);
            const node = enemies.filter(e => e.kind === 'conduit').sort((a,b) => Math.abs(a.y-s.player.y)-Math.abs(b.y-s.player.y))[0];
            const target = node ?? s.boss ?? enemies.find(e => e.kind === 'lucky') ?? enemies.sort((a,b) => a.x-b.x)[0];
            let desiredY = target ? Math.max(135, Math.min(600, target.y + 15 + (target.body?.velocity.y ?? 0) * Math.min(0.5, (target.x - s.player.x) / 1120))) : 350;
            let desiredX = s.boss ? 285 : 260;
            const drop = drops.sort((a,b) => (a.kind === 'data' ? -1 : 1) - (b.kind === 'data' ? -1 : 1) || Math.hypot(a.x-s.player.x,a.y-s.player.y)-Math.hypot(b.x-s.player.x,b.y-s.player.y))[0];
            if (drop && !s.boss && (drop.kind === 'data' || drop.kind === 'power' || s.hull < s.maxHull - 1)) { desiredY = drop.y; desiredX = Math.min(620, drop.x); }
            const gate = s.gates.find(g => g.x > s.player.x - 40 && g.x < s.player.x + 520);
            if (gate) desiredY = Math.max(gate.y-gate.gap/2+45, Math.min(gate.y+gate.gap/2-45, desiredY));
            const candidates = [gate?.y ?? desiredY, desiredY, s.player.y, desiredY - 65, desiredY + 65, 145, 240, 335, 430, 525, 595].map(y => Math.max(130, Math.min(600, y)));
            let best = desiredY, bestScore = -Infinity;
            for (const y of candidates) {
              let score = -Math.abs(y-desiredY) * 0.035 - Math.abs(y-s.player.y) * 0.008;
              for(const b of bullets) for(const t of [0.12,0.3,0.5,0.75]) {
                const sx = s.player.x + Math.sign(desiredX-s.player.x) * Math.min(Math.abs(desiredX-s.player.x),365*t);
                const sy = s.player.y + Math.sign(y-s.player.y) * Math.min(Math.abs(y-s.player.y),365*t);
                const distance = Math.hypot(b.x+b.body.velocity.x*t-sx,b.y+b.body.velocity.y*t-sy);
                if(distance < 48) score -= (48-distance)*0.35;
              }
              for(const e of enemies) if(e.x < s.player.x + 260 && Math.abs(e.y-y)<(e.boss?150:70)) score -= 24;
              if (gate && Math.abs(y-gate.y)>gate.gap/2-35) score -= 140;
              if (s.boss?.rushPreparing && Math.abs(y-s.boss.targetY)<145) score -= 100;
              if (s.boss && s.clock < s.boss.rushUntil && Math.abs(y-s.boss.y)<150) score -= 100;
              for(const beam of s.lasers) if(Math.abs(y-beam.y)<beam.width/2+45) score -= 80;
              if(score > bestScore) {bestScore=score;best=y;}
            }
            const k = s.inputState.keys;
            k.up.isDown = best < s.player.y - 9; k.down.isDown = best > s.player.y + 9;
            k.left.isDown = desiredX < s.player.x - 12; k.right.isDown = desiredX > s.player.x + 12;
            const near = bullets.some(b => Math.hypot(b.x-s.player.x,b.y-s.player.y) < 170);
            if(near && s.clock >= s.guardReady) game.events.emit('pilot:guard');
            if(s.charge>=100 && (s.boss || enemies.length>=3)) game.events.emit('pilot:surge');
  };
}
