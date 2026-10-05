// SOUNDS — small sounds made on the spot by the browser (no audio files to download).
//
// What starts it:  a chapter calls one of the functions below (e.g. playTick() when a dial clicks).
// What it does:    builds each sound from simple pieces with the Web Audio API: a short tone,
//                  or a burst of noise shaped by a filter, faded in and out.
// Browsers only allow sound after the visitor has clicked or pressed a key on the page, so the
// first sounds may be silent until then. Every sound is quiet; none is longer than a second or two.

let audio = null;   // created on first use

export function soundSystem() {
  if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
  if (audio.state === "suspended") audio.resume();
  return audio;
}

// A short burst of noise (like static or scraping metal), shaped by a filter.
function noiseBurst({ duration, volume, filter, frequency, q = 1, delay = 0 }) {
  const a = soundSystem();
  const start = a.currentTime + delay;
  const samples = Math.ceil(a.sampleRate * duration);
  const buffer = a.createBuffer(1, samples, a.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < samples; i++) data[i] = Math.random() * 2 - 1;
  const source = a.createBufferSource();
  source.buffer = buffer;
  const shape = a.createBiquadFilter();
  shape.type = filter;
  shape.frequency.value = frequency;
  shape.Q.value = q;
  const loudness = a.createGain();
  loudness.gain.setValueAtTime(volume, start);
  loudness.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(shape).connect(loudness).connect(a.destination);
  source.start(start);
}

// A short tone that fades out (pitch in hertz).
function tone({ pitch, duration, volume, wave = "sine", delay = 0, slideTo = null }) {
  const a = soundSystem();
  const start = a.currentTime + delay;
  const oscillator = a.createOscillator();
  oscillator.type = wave;
  oscillator.frequency.setValueAtTime(pitch, start);
  if (slideTo) oscillator.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
  const loudness = a.createGain();
  loudness.gain.setValueAtTime(0.0001, start);
  loudness.gain.exponentialRampToValueAtTime(volume, start + 0.01);
  loudness.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(loudness).connect(a.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.05);
}

// A dial clicking into place.
export function playTick() {
  noiseBurst({ duration: 0.03, volume: 0.25, filter: "bandpass", frequency: 3200, q: 4 });
  tone({ pitch: 1800, duration: 0.025, volume: 0.04, wave: "square" });
}

// A dull metal clank (a wrong combination).
export function playClank() {
  tone({ pitch: 110, duration: 0.35, volume: 0.35, wave: "triangle", slideTo: 70 });
  noiseBurst({ duration: 0.25, volume: 0.3, filter: "lowpass", frequency: 900 });
}

// Heavy bolts sliding back, then the door's slow creak (the vault opens).
export function playVaultOpening() {
  for (let i = 0; i < 4; i++) {
    tone({ pitch: 90, duration: 0.3, volume: 0.3, wave: "triangle", delay: i * 0.22, slideTo: 55 });
    noiseBurst({ duration: 0.18, volume: 0.25, filter: "bandpass", frequency: 600, q: 2, delay: i * 0.22 });
  }
  noiseBurst({ duration: 2.2, volume: 0.12, filter: "bandpass", frequency: 380, q: 9, delay: 1.1 });   // the creak
  tone({ pitch: 48, duration: 2.5, volume: 0.25, wave: "sine", delay: 1.0 });                         // the weight of it
}

// A crackle of static (glitches).
export function playStatic(duration = 0.25) {
  noiseBurst({ duration, volume: 0.12, filter: "highpass", frequency: 2500 });
}

// A soft keystroke (the terminal typing).
export function playKeystroke() {
  noiseBurst({ duration: 0.02, volume: 0.06, filter: "bandpass", frequency: 2400 + Math.random() * 800, q: 3 });
}
