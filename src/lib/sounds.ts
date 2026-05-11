import { useSettingsStore } from '../stores/settingsStore';

let _ctx: AudioContext | null = null;

function ctx(): AudioContext {
  if (!_ctx) _ctx = new AudioContext();
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

function vol(): number { return useSettingsStore.getState().volume; }

function noise(duration: number, freq: number, q: number, type: BiquadFilterType, gain: number) {
  const v = vol();
  if (v === 0) return;
  const c = ctx();
  const sampleRate = c.sampleRate;
  const size = (sampleRate * duration) | 0;
  const buf = c.createBuffer(1, size, sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < size; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / size, 2);
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;
  const g = c.createGain();
  g.gain.value = v * gain;
  src.connect(filter);
  filter.connect(g);
  g.connect(c.destination);
  src.start();
}

export function playBreak():    void { noise(0.09, 500, 0.8, 'bandpass', 0.55); }
export function playPlace():    void { noise(0.06, 320, 0.5, 'lowpass',  0.45); }
export function playFootstep(): void { noise(0.04, 260, 1.8, 'bandpass', 0.18); }
export function playSplash():   void { noise(0.12, 800, 0.4, 'bandpass', 0.35); }
