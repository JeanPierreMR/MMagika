// THE LETTER PAINTER: lays out and paints the letter's frames. Shared by render_letter.html (which
// turns them into the letter videos) and tuner.html (which previews them while you change settings),
// so what you see in the tuner is exactly what gets rendered.

import { paintFrame as paintColourFrame, frame as colourFrame } from "/tools/colour_field/colour_field.js";

// ---- Settings ---------------------------------------------------------------------------------------
// The defaults. Settings saved from the tuner (settings.json, next to this file) override them.
export const settings = {
  // layout
  fontSize: 42, fontWeight: 800, letterSpacing: 2, lineHeight: 60, lineWidth: 1040,
  roomAroundSides: 110, roomAboveAndBelow: 70,
  // writing speed (seconds)
  drawTime: 55, letterGap: 0.075, linePause: 0.15,
  pause: 1.5, longPause: 3, silence: 5,   // the [pausa], [pausa larga] and [silencio] marks in letter.html
  writeBy: "letter",        // "letter": each letter traces itself; "word": a whole word at once
  // the ink
  traceShare: 0.6,          // share of drawTime spent tracing the outline (the rest fills it in)
  dashLength: 1000,         // longer = the outline appears more slowly and evenly
  strokeWidth: 1.5,
  gold: "#e6c87e",
  // the colours inside the letters
  bloomStart: 0.7,          // when the colours start, as a share of drawTime
  bloomTime: 1.2,           // seconds for them to fade in
  colourStrength: 1,        // 0 = only gold, 1 = full colours
  colourBlend: "source-over",   // "source-over" = colours cover the gold, "screen" = they light it up
  // sparks
  sparkShare: 0.17,         // share of letters with a spark
  sparkSize: 2,             // size multiplier (1 = as on the live page, too small to survive video)
  sparkGlow: 1.5,           // brightness of the glow around each spark
  sparkDistance: 1,         // how far they fly (multiplier)
  sparksFadeIn: 1.5,        // seconds, once the paragraph is written
  // the video files
  pixelsPerUnit: 0.8,       // sharpness (the page shows the letter at about 0.6)
  writingFps: 20,
};
export const LOOP_SECONDS = 36;
export const LOOP_FPS = 15;
const SPARK_LENGTHS = [4, 4.5, 6];   // seconds; each fits into 36 s a whole number of times
const TILE_WIDTH = 1160, TILE_HEIGHT = 520, COLOUR_ROOM = 60;
const FONT = "'Grenze Gotisch', Georgia, serif";

// Applies settings.json and returns the defaults as they were before (for the tuner).
export async function loadDefaults() {
  const defaults = { ...settings };
  const saved = await fetch("/tools/letter_video/settings.json", { cache: "no-store" }).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  Object.assign(settings, saved);
  return defaults;                   // the defaults before the saved settings (for the tuner)
}

// The paragraphs of letter.html, one line of text per line of the letter, pause marks included.
// Django removes its {% comment %} blocks and {# #} notes before the page is sent; do the same here
// (the comment at the top mentions a paragraph tag).
export async function loadTexts() {
  const source = (await (await fetch("/chapters/letter/scroll_and_wax_seal/letter.html")).text())
    .replace(/{%\s*comment\s*%}[\s\S]*?{%\s*endcomment\s*%}/g, "")
    .replace(/{#[\s\S]*?#}/g, "")
    .replace(/<br\s*\/?>/gi, "\n");
  const page = new DOMParser().parseFromString(source, "text/html");
  return [...page.querySelectorAll(".letter-paragraph")].map((p) =>
    p.textContent.split("\n").map((line) => line.trim()).filter(Boolean).join("\n"));
}

// The pause marks, and which setting says how long each one holds the pen.
const PAUSE_MARK = /\[\s*(pausa larga|pausa|silencio)\s*\]/gi;
const PAUSE_SETTING = { "pausa": "pause", "pausa_larga": "longPause", "silencio": "silence" };
const PAUSE_WORD = "\u241F";          // a mark becomes this, plus its name, while splitting into words

// Same numbers every time.
let seed = 7;
function random() {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// ---- Layout: the letter's own lines, each centred; a line too long for the scroll wraps --------
const SVG = "http://www.w3.org/2000/svg";
let ruler = null;
function svgText(content, x, y, spacing) {
  const text = document.createElementNS(SVG, "text");
  text.setAttribute("x", x); text.setAttribute("y", y);
  text.setAttribute("font-size", settings.fontSize); text.setAttribute("font-weight", settings.fontWeight);
  if (spacing) text.setAttribute("letter-spacing", spacing);
  text.style.fontFamily = FONT;
  text.textContent = content;
  ruler.appendChild(text);
  return text;
}

function layOut(text, counters) {
  const s = settings;
  const measure = svgText("", 0, 0, s.letterSpacing);
  const widthOf = (words) => { measure.textContent = words.map((w) => w.text).join(" "); return measure.getComputedTextLength(); };

  // 1. Words, line by line. A pause mark adds its pause to the word just before it (at the very
  //    start of a paragraph there's no word before it, so it simply holds back the whole paragraph).
  const lines = [];                                  // each line: a list of { text, pauseAfter }
  let lastWord = null;
  for (const sourceLine of text.split("\n")) {
    const tokens = sourceLine.replace(PAUSE_MARK, (mark, kind) => ` ${PAUSE_WORD}${kind.toLowerCase().replace(/\s+/, "_")} `).split(/\s+/).filter(Boolean);
    let line = [];
    for (const token of tokens) {
      if (token.startsWith(PAUSE_WORD)) {
        const seconds = s[PAUSE_SETTING[token.slice(1)]];
        if (lastWord) lastWord.pauseAfter += seconds; else counters.paused += seconds;
        continue;
      }
      const word = { text: token, pauseAfter: 0 };
      if (line.length && widthOf([...line, word]) > s.lineWidth) { lines.push(line); line = []; }
      line.push(word);
      lastWord = word;
    }
    if (line.length) lines.push(line);
  }

  // 2. Where each letter goes.
  const words = [], letters = [];
  lines.forEach((lineWords, lineNumber) => {
    const lineText = lineWords.map((w) => w.text).join(" ");
    measure.textContent = lineText;
    const centring = (s.lineWidth - measure.getComputedTextLength()) / 2;
    let wordInLine = 0;
    for (let i = 0; i < lineText.length; i++) {
      const character = lineText[i];
      if (character === " ") { wordInLine++; continue; }
      const x = measure.getStartPositionOfChar(i).x + centring;
      const y = lineNumber * s.lineHeight;
      const source = lineWords[wordInLine];
      if (!source.characters) Object.assign(source, { characters: [], xs: [], y, lineNumber });
      source.characters.push(character);
      source.xs.push(x);
      letters.push({ character, x, y, box: svgText(character, x, y).getBBox() });
    }
    words.push(...lineWords);
  });

  // 3. When each piece starts: one letterGap per letter before it, linePause per line, plus every
  //    pause so far (in this paragraph and the ones before).
  const linesBefore = counters.lines;
  counters.lines += lines.length;
  // Writing letter by letter: every letter becomes its own "word". Each still starts exactly when
  // it would inside its word, so the overall pace doesn't change. A word's pause comes after its last letter.
  const pieces = s.writeBy === "letter"
    ? words.flatMap((w) => w.characters.map((c, i) => ({
        characters: [c], xs: [w.xs[i]], y: w.y, lineNumber: w.lineNumber,
        pauseAfter: i === w.characters.length - 1 ? w.pauseAfter : 0,
      })))
    : words;
  for (const word of pieces) {
    word.start = counters.letters * s.letterGap + (linesBefore + word.lineNumber) * s.linePause + counters.paused;
    word.bloomsAt = word.start + s.drawTime * s.bloomStart;
    counters.letters += word.characters.length;
    counters.paused += word.pauseAfter;
  }
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const { box } of letters) {
    left = Math.min(left, box.x); top = Math.min(top, box.y);
    right = Math.max(right, box.x + box.width); bottom = Math.max(bottom, box.y + box.height);
  }
  ruler.replaceChildren();
  return { words: pieces, letters, box: { x: left, y: top, width: right - left, height: bottom - top } };
}

// Lay out every paragraph and work out its timing and sparks, with the current settings.
export async function buildParagraphs(texts) {
  const s = settings;
  await document.fonts.load(`${s.fontWeight} ${s.fontSize}px "Grenze Gotisch"`);
  if (!ruler) {
    ruler = document.createElementNS(SVG, "svg");
    ruler.setAttribute("width", 10); ruler.setAttribute("height", 10);
    ruler.style.cssText = "position:absolute;visibility:hidden";
    document.body.appendChild(ruler);
  }
  seed = 7;
  const counters = { letters: 0, lines: 0, paused: 0 };
  return texts.map((text) => {
    const { words, letters, box } = layOut(text, counters);
    const view = {
      x: box.x - s.roomAroundSides, y: box.y - s.roomAboveAndBelow,
      width: box.width + s.roomAroundSides * 2, height: box.height + s.roomAboveAndBelow * 2,
    };
    const done = Math.max(...words.map((w) => w.start)) + s.drawTime + 0.8;   // when its sparks wake up
    const p = {
      words, view, sparks: makeSparks(letters),
      rainbow: { x: box.x + box.width / 2 - TILE_WIDTH / 2, y: box.y - COLOUR_ROOM, bottom: box.y + box.height + COLOUR_ROOM },
      start: Math.min(...words.map((w) => w.start)), done, writeEnd: done + s.sparksFadeIn,
    };
    p.surface = makeSurface(p);
    return p;
  });
}

function makeSurface(p) {
  const even = (x) => 2 * Math.ceil((x * settings.pixelsPerUnit) / 2);   // the video format needs even sizes
  const make = () => { const c = document.createElement("canvas"); c.width = even(p.view.width); c.height = even(p.view.height); return c; };
  const frame = make(), colours = make(), shapes = make();
  return { frame, pen: frame.getContext("2d"), colours, coloursPen: colours.getContext("2d"), shapes, shapesPen: shapes.getContext("2d") };
}

// ---- Easing and animation curves (as in the CSS) --------------------------------------------------
function cubicBezier(x1, y1, x2, y2) {
  const at = (a, b, t) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  return (x) => { let lo = 0, hi = 1, t = x; for (let i = 0; i < 24; i++) { t = (lo + hi) / 2; if (at(x1, x2, t) < x) lo = t; else hi = t; } return at(y1, y2, t); };
}
const inkEase = cubicBezier(0.45, 0.05, 0.35, 1), ease = cubicBezier(0.25, 0.1, 0.25, 1), easeOut = cubicBezier(0, 0, 0.58, 1);
function ink(word, T) {
  const s = settings;
  const t = (T - word.start) / s.drawTime;
  if (t <= 0) return null;
  if (t >= 1) return { trace: 1, fill: 1 };
  return t < s.traceShare ? { trace: inkEase(t / s.traceShare), fill: 0 } : { trace: 1, fill: inkEase((t - s.traceShare) / (1 - s.traceShare)) };
}
function bloom(word, T) { const t = (T - word.bloomsAt) / settings.bloomTime; return t <= 0 ? 0 : t >= 1 ? 1 : ease(t); }
function keyframed(points, phase) {
  for (let i = 1; i < points.length; i++) {
    const [o0, v0] = points[i - 1], [o1, v1] = points[i];
    if (phase <= o1) return v0 + (v1 - v0) * easeOut((phase - o0) / (o1 - o0));
  }
  return points[points.length - 1][1];
}

// ---- Sparks (with lengths that fit the 36-second loop) ------------------------
function makeSparks(letters) {
  const sparks = [];
  for (const { box: b } of letters) {
    if (random() > settings.sparkShare || (!b.width && !b.height)) continue;
    const side = Math.floor(random() * 4);
    const x = side === 1 ? b.x + b.width : side === 3 ? b.x : b.x + random() * b.width;
    const y = side === 0 ? b.y : side === 2 ? b.y + b.height : b.y + random() * b.height;
    const dx = x - (b.x + b.width / 2), dy = y - (b.y + b.height / 2) - 6;
    const length = Math.hypot(dx, dy) || 1, distance = 22 + random() * 42;
    const life = SPARK_LENGTHS[Math.floor(random() * SPARK_LENGTHS.length)];
    sparks.push({ x, y, dx: (dx / length) * distance, dy: (dy / length) * distance, size: 2.4 + random() * 1.9, life, offset: random() * life });
  }
  return sparks;
}
function drawSpark(pen, spark, loopTime, alpha) {
  const phase = (((loopTime + spark.offset) % spark.life) + spark.life) % spark.life / spark.life;
  const opacity = keyframed([[0, 0], [0.14, 1], [0.65, 0.6], [1, 0]], phase) * alpha;
  if (opacity <= 0.001) return;
  const move = keyframed([[0, 0], [0.14, 0.14], [1, 1]], phase) * settings.sparkDistance;
  const scale = keyframed([[0, 0.18], [0.14, 1], [1, 0.06]], phase) * settings.sparkSize;
  const turn = keyframed([[0, 0], [0.14, 20], [1, 90]], phase);
  pen.save();
  pen.globalAlpha = opacity;
  pen.translate(spark.x + spark.dx * move, spark.y + spark.dy * move);
  pen.rotate((turn * Math.PI) / 180);
  pen.scale(scale, scale);
  const r = spark.size * 2.9;
  const glow = pen.createRadialGradient(0, 0, 0, 0, 0, r);
  const g = settings.sparkGlow;
  glow.addColorStop(0, `rgba(255,244,200,${Math.min(1, 0.9 * g)})`); glow.addColorStop(0.55, `rgba(255,217,138,${Math.min(1, 0.22 * g)})`); glow.addColorStop(1, "rgba(255,217,138,0)");
  pen.fillStyle = glow;
  pen.beginPath(); pen.arc(0, 0, r, 0, Math.PI * 2); pen.fill();
  const s = spark.size, k = s * 0.14;
  pen.fillStyle = "#fff8e2";
  pen.beginPath();
  pen.moveTo(0, -s); pen.quadraticCurveTo(k, -k, s, 0); pen.quadraticCurveTo(k, k, 0, s);
  pen.quadraticCurveTo(-k, k, -s, 0); pen.quadraticCurveTo(-k, -k, 0, -s); pen.fill();
  pen.restore();
}

// ---- Painting one frame ------------------------------------------------------------------------
function toUnits(context, view) {
  const ppu = settings.pixelsPerUnit;
  context.setTransform(ppu, 0, 0, ppu, -view.x * ppu, -view.y * ppu);
  context.font = `${settings.fontWeight} ${settings.fontSize}px ${FONT}`;
}

// The colour field is only worked out when a letter needs it, and once per moment.
let colourShareShown = null;
function showColours(loopShare) {
  if (loopShare === colourShareShown) return;
  paintColourFrame(loopShare);
  colourShareShown = loopShare;
}

// Paint paragraph p at second T of the writing (T counts from when the whole letter starts).
export function paintFrame(p, T) {
  const s = settings;
  const { words, view, rainbow, sparks, writeEnd } = p;
  const { frame, pen, colours, coloursPen, shapes, shapesPen } = p.surface;
  // The colours run on their 36 s loop, lined up so that the loop video starts at its beginning.
  const loopTime = T - writeEnd;
  const loopShare = +((((loopTime / LOOP_SECONDS) % 1) + 1) % 1).toFixed(6);

  pen.setTransform(1, 0, 0, 1, 0, 0);
  pen.globalCompositeOperation = "source-over";
  pen.globalAlpha = 1;
  pen.fillStyle = "#000";
  pen.fillRect(0, 0, frame.width, frame.height);

  // 1. Gold: each word's outline traced, then filled.
  toUnits(pen, view);
  pen.fillStyle = pen.strokeStyle = s.gold;
  pen.lineWidth = s.strokeWidth;
  pen.lineJoin = "round";
  for (const word of words) {
    const progress = ink(word, T);
    if (!progress) continue;
    pen.setLineDash(progress.trace >= 1 ? [] : [s.dashLength, s.dashLength]);
    pen.lineDashOffset = s.dashLength * (1 - progress.trace);
    pen.globalAlpha = 1;
    if (s.strokeWidth > 0) word.characters.forEach((c, i) => pen.strokeText(c, word.xs[i], word.y));
    if (progress.fill > 0) {
      pen.globalAlpha = progress.fill;
      word.characters.forEach((c, i) => pen.fillText(c, word.xs[i], word.y));
    }
  }
  pen.setLineDash([]);
  pen.globalAlpha = 1;

  // 2. Colours, only inside the letters that have bloomed.
  let anyBloom = false;
  if (s.colourStrength > 0) {
    shapesPen.setTransform(1, 0, 0, 1, 0, 0);
    shapesPen.clearRect(0, 0, shapes.width, shapes.height);
    toUnits(shapesPen, view);
    shapesPen.fillStyle = "#fff";
    for (const word of words) {
      const amount = bloom(word, T);
      if (amount <= 0) continue;
      anyBloom = true;
      shapesPen.globalAlpha = amount;
      word.characters.forEach((c, i) => shapesPen.fillText(c, word.xs[i], word.y));
    }
  }
  if (anyBloom) {
    showColours(loopShare);
    coloursPen.setTransform(1, 0, 0, 1, 0, 0);
    coloursPen.globalCompositeOperation = "source-over";
    coloursPen.clearRect(0, 0, colours.width, colours.height);
    toUnits(coloursPen, view);
    for (let top = rainbow.y; top < rainbow.bottom; top += TILE_HEIGHT) {
      coloursPen.drawImage(colourFrame, rainbow.x, top, TILE_WIDTH, TILE_HEIGHT + 0.5);
    }
    coloursPen.setTransform(1, 0, 0, 1, 0, 0);
    coloursPen.globalCompositeOperation = "destination-in";
    coloursPen.drawImage(shapes, 0, 0);
    pen.setTransform(1, 0, 0, 1, 0, 0);
    pen.globalCompositeOperation = s.colourBlend;
    pen.globalAlpha = s.colourStrength;
    pen.drawImage(colours, 0, 0);
    pen.globalAlpha = 1;
    pen.globalCompositeOperation = "source-over";
  }

  // 3. Sparks, waking up once the paragraph is written.
  const sparkAlpha = s.sparksFadeIn > 0 ? Math.max(0, Math.min(1, (T - p.done) / s.sparksFadeIn)) : (T >= p.done ? 1 : 0);
  if (sparkAlpha > 0) {
    toUnits(pen, view);
    for (const spark of sparks) drawSpark(pen, spark, loopTime, sparkAlpha);
  }
}
