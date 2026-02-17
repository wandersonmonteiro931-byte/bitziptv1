// Shared sound effects utility for all games
// Uses Web Audio API - no external dependencies

let audioCtx: AudioContext | null = null;
let _muted = false;

function getCtx() {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

export function setMuted(m: boolean) { _muted = m; }
export function isMuted() { return _muted; }

function tone(freq: number, dur: number, type: OscillatorType = "sine", vol = 0.15) {
  if (_muted) return;
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = vol;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.stop(ctx.currentTime + dur);
  } catch {}
}

export const sfx = {
  // Generic
  click: () => tone(600, 0.1, "sine", 0.12),
  start: () => { tone(440, 0.15, "sine", 0.1); setTimeout(() => tone(550, 0.15, "sine", 0.1), 100); },
  
  // Win/Loss
  win: () => {
    tone(523, 0.15, "sine", 0.15);
    setTimeout(() => tone(659, 0.15, "sine", 0.15), 150);
    setTimeout(() => tone(784, 0.3, "sine", 0.15), 300);
  },
  lose: () => tone(200, 0.3, "sawtooth", 0.06),
  jackpot: () => {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.25, "sine", 0.15), i * 120));
  },

  // Scratch Card
  scratch: () => tone(800 + Math.random() * 400, 0.04, "sawtooth", 0.03),
  cellReveal: () => tone(500, 0.12, "triangle", 0.1),
  match: () => { tone(660, 0.1, "sine", 0.12); setTimeout(() => tone(880, 0.15, "sine", 0.12), 100); },
  
  // Cup Game
  shuffle: () => tone(300, 0.08, "square", 0.08),
  cover: () => tone(220, 0.25, "triangle", 0.08),
  reveal: () => tone(500, 0.2, "triangle", 0.1),
  
  // Prize Box
  boxOpen: () => { tone(400, 0.15, "triangle", 0.1); setTimeout(() => tone(600, 0.2, "sine", 0.12), 100); },
  boxShimmer: () => tone(1200, 0.3, "sine", 0.05),
  
  // Confetti / celebration
  celebrate: () => {
    [523, 587, 659, 784, 880].forEach((f, i) => setTimeout(() => tone(f, 0.2, "sine", 0.1), i * 80));
  },
};
