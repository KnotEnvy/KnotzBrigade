// Original eight-bar arcade score. No downloaded samples or music generators.
// Voice tails wrap into the first bar, so the exported PCM loops continuously.
import { mkdir, writeFile } from 'node:fs/promises';
const rate = 22050, bpm = 112, beat = 60 / bpm, beats = 32;
const length = Math.round(rate * beat * beats), seconds = length / rate;
const folder = new URL('../public/assets/score/', import.meta.url);
const TAU = Math.PI * 2;
const hz = note => 440 * 2 ** ((note - 69) / 12);
const themes = [
  { key: 'breakwater', bass: [38, 34, 41, 36], chords: [[62,65,69,72],[58,62,65,69],[65,69,72,76],[60,64,67,72]], motif: [74,null,77,76,74,69,72,null], drive: 0.42 },
  { key: 'convoy', bass: [38, 38, 34, 33], chords: [[62,65,69],[62,65,72],[58,62,65],[57,61,64]], motif: [62,69,74,null,72,69,65,64], drive: 0.7 },
  { key: 'foundry', bass: [38, 39, 34, 33], chords: [[62,65,69,76],[63,67,70,74],[58,62,65,72],[57,61,64,69]], motif: [74,null,81,77,76,null,72,73], drive: 0.55 },
  { key: 'brood', bass: [38, 38, 41, 33], chords: [[62,65,69],[62,65,72],[65,69,72],[57,61,64]], motif: [62,62,69,65,62,69,73,69], drive: 0.9 },
  { key: 'overload', bass: [38,38,38,38], chords: [[],[],[],[]], motif: [], drive: 1, percussion: true },
  { key: 'warden', bass: [38, 34, 39, 33], chords: [[62,65,69],[58,62,65],[63,67,70],[57,61,64]], motif: [74,81,77,76,74,72,73,69], drive: 1 }
];

await mkdir(folder, { recursive: true });
const metadata = { composer: 'Knotz Brigade project score', bpm, bars: 8, sampleRate: rate, channels: 1, themes: [] };
for (const theme of themes) {
  const mix = new Float64Array(length);
  let seed = 0x2c173;
  const noise = () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 2147483648 - 1; };
  const voice = (at, duration, note, gain, kind) => {
    const start = Math.round(at * beat * rate), frames = Math.round(duration * beat * rate), frequency = hz(note);
    let filtered = 0;
    for (let i = 0; i < frames; i++) {
      const t = i / rate, progress = i / frames, phase = TAU * frequency * t;
      const release = Math.min(1, (1 - progress) / 0.16), attack = Math.min(1, t / (kind === 'pad' ? 0.09 : 0.006));
      let value;
      if (kind === 'pad') value = (Math.sin(phase) * 0.65 + Math.sin(phase * 1.0017) * 0.22 + Math.sin(phase * 2) * 0.13) * attack * release;
      else if (kind === 'bass') value = (Math.sin(phase) + Math.sin(phase * 2) * 0.16) / 1.16 * attack * Math.exp(-t * 3.8) * release;
      else if (kind === 'bell') value = (Math.sin(phase) + Math.sin(phase * 2.002) * 0.32 + Math.sin(phase * 3) * 0.09) / 1.41 * attack * Math.exp(-t * 5) * release;
      else if (kind === 'lead') value = (Math.sin(phase) + Math.sin(phase * 2) * 0.25 + Math.sin(phase * 3) * 0.08) / 1.33 * attack * Math.exp(-t * 3.3) * release;
      else if (kind === 'kick') value = Math.sin(TAU * (47 * t + 4.2 * (1 - Math.exp(-t * 28)))) * Math.exp(-t * 19) * attack * release;
      else { const raw = noise(); filtered += (raw - filtered) * 0.16; value = (raw - filtered) * Math.exp(-t * (kind === 'hat' ? 75 : 24)) * attack * release; }
      mix[((start + i) % length + length) % length] += value * gain;
    }
  };
  for (let bar = 0; bar < 8; bar++) {
    const section = Math.floor(bar / 2), chord = theme.chords[section], root = theme.bass[section];
    if (theme.percussion) {
      for (const at of [0, 0.25, 1.5, 2.25, 2.5, 3.5]) voice(bar * 4 + at, 0.7, 0, 0.14, 'kick');
      for (let step = 0; step < 16; step++) voice(bar * 4 + step / 4, 0.16, 0, step % 4 === 3 ? 0.022 : 0.009, 'hat');
      voice(bar * 4 + 3.75, 0.3, 0, 0.05, 'snare');
      continue;
    }
    chord.forEach(note => voice(bar * 4, 4.7, note - 12, 0.025, 'pad'));
    for (let step = 0; step < 8; step++) {
      const at = bar * 4 + step / 2;
      if (!theme.percussion) voice(at, 0.75, root + (step === 7 ? 12 : 0), 0.17, 'bass');
      if (step % 4 === 0 || (theme.drive > 0.8 && step === 5)) voice(at, 0.75, 0, 0.16 * theme.drive, 'kick');
      if (step === 2 || step === 6) voice(at, 0.45, 0, 0.065 * theme.drive, 'snare');
      if (theme.drive > 0.6 || step % 2 === 1) voice(at, 0.2, 0, 0.019 * theme.drive, 'hat');
      if (!theme.percussion && (bar % 2 === 1 || theme.drive > 0.6)) voice(at + 0.25, 1.4, chord[(step + bar) % chord.length], 0.045, 'bell');
    }
    theme.motif.forEach((note, step) => {
      if (note === null || (bar % 2 === 1 && step > 5)) return;
      const at = bar * 4 + step / 2;
      voice(at, 1.2, note + (bar >= 4 && step === 2 ? 12 : 0), theme.key === 'foundry' ? 0.065 : 0.072, 'lead');
      voice(at + 0.75, 1, note, 0.018, 'bell');
    });
  }
  let peak = 0, energy = 0;
  for (const sample of mix) { peak = Math.max(peak, Math.abs(sample)); energy += sample * sample; }
  const gain = Math.min(1.8, 0.68 / peak);
  const wav = Buffer.alloc(44 + length * 2);
  wav.write('RIFF',0); wav.writeUInt32LE(wav.length-8,4); wav.write('WAVEfmt ',8); wav.writeUInt32LE(16,16); wav.writeUInt16LE(1,20); wav.writeUInt16LE(1,22); wav.writeUInt32LE(rate,24); wav.writeUInt32LE(rate*2,28); wav.writeUInt16LE(2,32); wav.writeUInt16LE(16,34); wav.write('data',36); wav.writeUInt32LE(length*2,40);
  for (let i=0;i<length;i++) wav.writeInt16LE(Math.round(Math.max(-1,Math.min(1,mix[i]*gain))*32767),44+i*2);
  await writeFile(new URL(`${theme.key}.wav`, folder), wav);
  metadata.themes.push({key:theme.key,seconds,bytes:wav.length,peak:peak*gain,rms:Math.sqrt(energy/length)*gain,seamDelta:Math.abs(mix[0]-mix[length-1])*gain});
}
await writeFile(new URL('score.json', folder), JSON.stringify(metadata,null,2));
console.log(`Composed ${themes.length} original eight-bar themes (${bpm} BPM, ${seconds.toFixed(2)}s each).`);
