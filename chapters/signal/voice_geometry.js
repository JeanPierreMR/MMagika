// THE VOICE GEOMETRY — the whole page: the sound drawn as moving geometry around the mockingjay,
// with the listener's real calculations written over it, as if the machine were working it out.
//
// What starts it:  signal.js creates it once the microphone is on; it runs constantly after that.
// What it draws, from the middle outwards (every frame):
//   - the sound wave bent into a ring around the picture,
//   - the sound's frequencies as rays (its spectrum),
//   - polygons and a star that turn with the pitch, with more sides as more notes are heard,
//   - a polar grid with degree marks, slowly turning,
//   - a Lissajous figure made from the jump between the last two notes (a pure ratio of pitches),
//   - and in the corners, live numbers from listen_for_the_call.js: the pitch and how it was found
//     (with a small plot of the autocorrelation curve), the notes heard so far, their jumps against
//     the call's, the timing, a rotation matrix and raw sample values streaming past.
// Everything shown is computed from the real sound; nothing is random.
// Colours: cyan for listening, gold for the mockingjay; everything turns gold when it answers.

import { CALL_SHAPE, CALL_TIMING } from "./listen_for_the_call.js";

const CYAN = "111, 243, 255";
const GOLD = "230, 200, 126";
const NOTE_NAMES = ["A", "B♭", "B", "C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭"];
const MAX_PIXEL_DENSITY = 1.5;     // sharper than this costs more than it shows

const noteName = (semitone) => {
  const nearest = Math.round(semitone);
  const name = NOTE_NAMES[((nearest % 12) + 12) % 12];
  const octave = 4 + Math.floor((nearest + 9) / 12);
  const cents = Math.round((semitone - nearest) * 100);
  return `${name}${octave} ${cents >= 0 ? "+" : "−"}${Math.abs(cents)}¢`;
};
const signed = (n, digits = 1) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(digits)}`;

export function makeVoiceGeometry(canvas, picture) {
  const pen = canvas.getContext("2d");
  let ears = null;                 // the analyser being shown (microphone, then the bird)
  let report = { pitch: null, clarity: 0, loudness: 0, curve: null, notes: [], check: null, current: null };
  let colour = CYAN;
  let samples = new Float32Array(1024);
  let spectrum = new Uint8Array(512);
  let width = 0, height = 0;

  function fit() {
    const density = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_DENSITY);
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = width * density;
    canvas.height = height * density;
    pen.setTransform(density, 0, 0, density, 0, 0);
  }
  fit();
  window.addEventListener("resize", fit);

  const stroke = (alpha, lineWidth = 1, rgb = colour) => {
    pen.strokeStyle = `rgba(${rgb}, ${alpha})`;
    pen.lineWidth = lineWidth;
  };
  const write = (text, x, y, alpha = 0.7, align = "left", rgb = colour) => {
    pen.fillStyle = `rgba(${rgb}, ${alpha})`;
    pen.textAlign = align;
    pen.fillText(text, x, y);
  };

  // ---- The geometry ---------------------------------------------------------------------------
  function drawGrid(cx, cy, radius, t) {
    stroke(0.08);
    for (let ring = 1; ring <= 5; ring++) {
      pen.beginPath();
      pen.arc(cx, cy, radius * (1.25 + ring * 0.38), 0, Math.PI * 2);
      pen.stroke();
    }
    const turn = t * 0.05;
    pen.font = "9px ui-monospace, monospace";
    for (let i = 0; i < 36; i++) {
      const angle = turn + (i / 36) * Math.PI * 2;
      const inner = radius * 1.25, outer = radius * (i % 3 === 0 ? 3.3 : 3.05);
      stroke(i % 3 === 0 ? 0.16 : 0.07);
      pen.beginPath();
      pen.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
      pen.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
      pen.stroke();
      if (i % 3 === 0) write(`${i * 10}°`, cx + Math.cos(angle) * radius * 3.45, cy + Math.sin(angle) * radius * 3.45 + 3, 0.35, "center");
    }
  }

  function drawSpectrum(cx, cy, radius) {
    if (!ears) return;
    ears.getByteFrequencyData(spectrum);
    const binsShown = Math.floor(spectrum.length * 0.18);       // up to about 4 kHz
    for (let i = 0; i < binsShown; i++) {
      const strength = spectrum[i] / 255;
      if (strength < 0.05) continue;
      const angle = -Math.PI / 2 + (i / binsShown) * Math.PI * 2;
      const from = radius * 1.32, to = from + strength * radius * 1.1;
      stroke(0.15 + strength * 0.6, 1.2, GOLD);
      pen.beginPath();
      pen.moveTo(cx + Math.cos(angle) * from, cy + Math.sin(angle) * from);
      pen.lineTo(cx + Math.cos(angle) * to, cy + Math.sin(angle) * to);
      pen.stroke();
    }
  }

  function drawWaveRing(cx, cy, radius) {
    let loudest = 0.02;
    if (ears) {
      ears.getFloatTimeDomainData(samples);
      for (const s of samples) loudest = Math.max(loudest, Math.abs(s));
    } else samples.fill(0);
    const lift = Math.min(5, 0.5 / loudest);                    // soft sounds still move the ring
    pen.shadowColor = `rgba(${colour}, 0.9)`;
    pen.shadowBlur = 10;
    stroke(0.9, 1.6);
    pen.beginPath();
    const points = 256;
    for (let p = 0; p <= points; p++) {
      const i = Math.floor((p / points) * (samples.length - 1));
      const angle = -Math.PI / 2 + (p / points) * Math.PI * 2;
      const r = radius * 1.12 + samples[i] * lift * radius * 0.28;
      const x = cx + Math.cos(angle) * r, y = cy + Math.sin(angle) * r;
      if (p === 0) pen.moveTo(x, y); else pen.lineTo(x, y);
    }
    pen.stroke();
    pen.shadowBlur = 0;
    return loudest;
  }

  function drawPolygons(cx, cy, radius, t) {
    const sides = 3 + report.notes.length;                       // more sides as notes are heard
    const spin = t * 0.2 + (report.pitch ? Math.log2(report.pitch / 100) : 0);
    for (const [scale, alpha, step] of [[2.05, 0.35, 1], [2.05, 0.18, 2], [2.6, 0.12, 1]]) {
      stroke(alpha, 1);
      pen.beginPath();
      for (let k = 0; k <= sides; k++) {
        const angle = spin * (scale > 2.5 ? -0.6 : 1) + ((k * step) / sides) * Math.PI * 2;
        const x = cx + Math.cos(angle) * radius * scale, y = cy + Math.sin(angle) * radius * scale;
        if (k === 0) pen.moveTo(x, y); else pen.lineTo(x, y);
      }
      pen.stroke();
    }
  }

  // A Lissajous figure: x = sin(a·s + φ), y = sin(s), with a = the pitch ratio of the last jump.
  function drawLissajous(x0, y0, size, t) {
    const notes = report.notes;
    const jump = notes.length >= 2 ? notes[notes.length - 1].semitone - notes[notes.length - 2].semitone : CALL_SHAPE[0];
    const ratio = 2 ** (jump / 12);
    stroke(0.12);
    pen.strokeRect(x0 - size, y0 - size, size * 2, size * 2);
    stroke(0.6, 1);
    pen.beginPath();
    for (let i = 0; i <= 300; i++) {
      const s = (i / 300) * Math.PI * 8;
      const x = x0 + Math.sin(ratio * s + t * 0.7) * size * 0.9;
      const y = y0 + Math.sin(s) * size * 0.9;
      if (i === 0) pen.moveTo(x, y); else pen.lineTo(x, y);
    }
    pen.stroke();
    pen.font = "10px ui-monospace, monospace";
    write(`x = sin(${ratio.toFixed(3)}·s + ${(t * 0.7 % 6.283).toFixed(2)})`, x0 - size, y0 + size + 14, 0.55);
    write(`a = 2^(${signed(jump)}/12)`, x0 - size, y0 + size + 27, 0.55);
  }

  // ---- The calculations ------------------------------------------------------------------------
  function drawReadouts(t, loudest) {
    const m = Math.max(16, width * 0.025);
    pen.font = "11px ui-monospace, 'DejaVu Sans Mono', monospace";
    const line = 15;

    // Top left: the pitch, and how it was found.
    const sr = ears?.context.sampleRate || 48000;
    const f = report.pitch;
    const rows = [
      `ƒ₀    = ${f ? f.toFixed(2).padStart(8) : "    ----"} Hz   ${f ? noteName(Math.log2(f / 440) * 12) : ""}`,
      `τ     = ${f ? (sr / f).toFixed(2).padStart(8) : "    ----"} smp`,
      `r(τ)  = ${report.clarity.toFixed(3)}`,
      `RMS   = ${(20 * Math.log10(Math.max(report.loudness, 1e-5))).toFixed(1)} dBFS`,
      `r(τ)  = 2·Σx[n]x[n+τ] / Σ(x[n]²+x[n+τ]²)`,
    ];
    rows.forEach((row, i) => write(row, m, m + 12 + i * line, 0.75));
    // A small plot of r(τ): where its first peak is, there's the pitch.
    if (report.curve) {
      const x0 = m, y0 = m + 12 + rows.length * line + 8, w = Math.min(220, width * 0.25), h = 46;
      stroke(0.2);
      pen.strokeRect(x0, y0, w, h);
      stroke(0.8, 1);
      pen.beginPath();
      const curve = report.curve;
      for (let i = 0; i < w; i++) {
        const value = curve[Math.floor((i / w) * (curve.length - 1))] || 0;
        const y = y0 + h / 2 - value * (h / 2 - 2);
        if (i === 0) pen.moveTo(x0 + i, y); else pen.lineTo(x0 + i, y);
      }
      pen.stroke();
      write("r(τ) · τ ∈ [70 Hz, 3.5 kHz]", x0, y0 + h + 12, 0.4);
    }

    // Bottom left: the notes heard, and how they compare with the call.
    const notes = report.notes;
    const bottom = height - m;
    const noteRows = notes.map((note, i) =>
      `N${"₁₂₃₄"[i]}  ${noteName(note.semitone).padEnd(11)} t = ${(note.start % 100).toFixed(2)}–${(note.end % 100).toFixed(2)} s`);
    while (noteRows.length < 4) noteRows.push(`N${"₁₂₃₄"[noteRows.length]}  ---`);
    const check = report.check;
    const calcRows = [
      ...noteRows,
      `Δ    = [${check ? check.jumps.map((j) => signed(j)).join(", ") : "  ·,   ·,   ·"}] st`,
      `Δ*   = [${CALL_SHAPE.map((j) => signed(j, 0)).join(", ")}] st`,
      `ε    = ${check ? check.worstJump.toFixed(2) : "--"} st     T = ${check ? check.span.toFixed(2) : "--"} s ∈ [${CALL_TIMING.join(", ")}]`,
    ];
    calcRows.forEach((row, i) => write(row, m, bottom - (calcRows.length - 1 - i) * line, i < 4 ? 0.6 : 0.8));

    // Top right: a rotation matrix turning with time.
    const theta = (t * 0.3) % (Math.PI * 2);
    const [c, s] = [Math.cos(theta), Math.sin(theta)];
    const right = width - m;
    [
      `θ = ${(theta * 180 / Math.PI).toFixed(1).padStart(5)}°`,
      `⎡ ${c.toFixed(3).padStart(6)}  ${(-s).toFixed(3).padStart(6)} ⎤`,
      `⎣ ${s.toFixed(3).padStart(6)}  ${c.toFixed(3).padStart(6)} ⎦`,
      `peak = ${loudest.toFixed(4)}`,
    ].forEach((row, i) => write(row, right, m + 12 + i * line, 0.6, "right"));

    // Bottom right: raw sample values streaming past, in hexadecimal.
    for (let r = 0; r < 6; r++) {
      const words = [];
      for (let k = 0; k < 4; k++) {
        const value = samples[(r * 4 + k) * 37 % samples.length];
        words.push(Math.floor((value * 0.5 + 0.5) * 65535).toString(16).padStart(4, "0").toUpperCase());
      }
      write(`0x${(r * 64).toString(16).padStart(3, "0")}  ${words.join(" ")}`, right, bottom - (5 - r) * line, 0.35, "right");
    }
  }

  // ---- Every frame -------------------------------------------------------------------------------
  function draw(now) {
    const t = now / 1000;
    // Fade the last frame instead of clearing it: moving lines leave short trails.
    pen.fillStyle = "rgba(4, 5, 9, 0.38)";
    pen.fillRect(0, 0, width, height);
    const cx = width / 2, cy = height / 2;
    const radius = Math.min(width, height) * 0.15;
    drawGrid(cx, cy, radius, t);
    drawSpectrum(cx, cy, radius);
    drawPolygons(cx, cy, radius, t);
    const loudest = drawWaveRing(cx, cy, radius);
    if (width > 700) drawLissajous(width - Math.max(16, width * 0.025) - 70, height / 2, 60, t);
    drawReadouts(t, loudest);
    picture.style.setProperty("--level", Math.min(1, loudest * 3).toFixed(3));   // the picture breathes with the sound
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);

  return {
    show(analyser) { ears = analyser; samples = new Float32Array(analyser.fftSize); spectrum = new Uint8Array(analyser.frequencyBinCount); },
    report(latest) { report = latest; },
    turnGold() { colour = GOLD; },
  };
}
