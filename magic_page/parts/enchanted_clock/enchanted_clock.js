// THE ENCHANTED CLOCK ("teleport" version)
//
// Ported from "Arcane Hours" (arcane-clock/enchanted-clock-teleport). Clock design inspired
// by Tim Holman's cursor-effects (MIT): https://github.com/tholman/cursor-effects
//
// What starts it:  the page loading.
// What it uses:    the current time and date, and the mouse (or finger) position.
// What it does:    draws a violet clock in two layers:
//   - THE DETAILS (Mayan numerals, hands, tick marks, runes, the date ring, sparks) always
//     stay visible and follow the mouse elastically: each piece chases the one before it,
//     so they stream after the pointer like a ribbon and then settle back into a clock face.
//   - THE SHAPES (four circles, two triangles, an octagon) "teleport": when the mouse moves
//     away, they fade out where they were; once the mouse rests for a moment, they draw
//     themselves again, line by line, at the new spot. A click summons them at once.
// What changes:    only what's on screen.
// Keys:            Space pauses the turning ornaments (the time keeps running); Escape recentres.
//
// Changed from the original: it listens to the mouse on the whole window (not its own element),
// so it never blocks the wand's drawing, and the arrow keys are left free for reading the letter.

const FULL_TURN = Math.PI * 2;
const VIOLET = "192,164,255";   // red, green, blue of the clock's ink
const RUNES = ["ᚠ","ᚢ","ᚦ","ᚨ","ᚱ","ᚲ","ᚷ","ᚹ","ᚺ","ᚾ","ᛁ","ᛃ","ᛇ","ᛈ","ᛉ","ᛋ","ᛏ","ᛒ","ᛖ","ᛗ","ᛚ","ᛜ","ᛞ","ᛟ"];

// Teleport timing, in milliseconds.
const WAIT_BEFORE_REDRAWING = 160;   // the mouse must rest this long before the shapes redraw
const TIME_TO_DRAW_SHAPES = 2800;
const TIME_TO_FADE_SHAPES = 280;
const MIN_MOVE_TO_TELEPORT = 24;     // smaller mouse moves don't make the shapes jump

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let paused = reduceMotion.matches;
reduceMotion.addEventListener("change", () => { paused = reduceMotion.matches; });

const canvas = document.getElementById("enchanted-clock");
const pen = canvas.getContext("2d");

let width = 0, height = 0, scale = 1;
let target = { x: 0, y: 0 };         // where the details are heading (the mouse)
let trail = [];                      // 128 points: each chases the one before it; trail[0] chases the mouse
let trailClock = 0;                  // leftover milliseconds for the fixed 60-steps-a-second trail
let detailsTurning = 0;              // seconds of "ornament time" for the turning details
let shapesHere = null;               // the shapes being drawn: {x, y, age, rotation}
let shapesLeaving = null;            // the shapes fading out at the old spot: {x, y, age, rotation, fadeAge}
let shapesHidden = false;
let waitingToTeleport = null;        // where the shapes will reappear once the mouse rests: {x, y, since}
let drawnFraction = 1;               // 0..1: how much of the shape being drawn is visible right now

const clampToOne = (value) => Math.max(0, Math.min(1, value));

// Keep the clock's middle far enough from the edges that the whole clock fits.
function keepOnScreen(x, y) {
  const margin = 160 * scale;
  return {
    x: Math.max(margin, Math.min(width - margin, x)),
    y: Math.max(margin, Math.min(height - margin, y)),
  };
}

function fitToWindow() {
  const pixelDensity = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width * pixelDensity;
  canvas.height = height * pixelDensity;
  pen.setTransform(pixelDensity, 0, 0, pixelDensity, 0, 0);
  scale = Math.min(width / 350, height / 350, 1);   // shrink on small screens

  target = { x: width / 2, y: height / 2 };
  shapesHere = { ...target, age: paused ? TIME_TO_DRAW_SHAPES : 0, rotation: 0 };
  shapesLeaving = null;
  shapesHidden = false;
  waitingToTeleport = null;
  trail = Array.from({ length: 128 }, () => ({ ...target }));
  trailClock = 0;
  detailsTurning = 0;
}

// ---- Teleporting the shapes ---------------------------------------------------------
function fadeShapesAway() {
  if (shapesHidden) return;
  shapesLeaving = paused ? null : { ...shapesHere, fadeAge: 0 };
  shapesHidden = true;
}

function teleportShapesTo(point) {
  waitingToTeleport = null;
  fadeShapesAway();
  shapesHere = { ...keepOnScreen(point.x, point.y), age: paused ? TIME_TO_DRAW_SHAPES : 0, rotation: 0 };
  shapesHidden = false;
}

// The mouse moved: if it went far enough, fade the shapes and wait for the mouse to rest.
function teleportWhenMouseRests(x, y) {
  const point = keepOnScreen(x, y);
  const smallMove = Math.hypot(point.x - shapesHere.x, point.y - shapesHere.y) < MIN_MOVE_TO_TELEPORT * scale;
  if (!shapesHidden && smallMove) {
    waitingToTeleport = null;
    return;
  }
  fadeShapesAway();
  // Near an edge the same clamped spot repeats; don't keep restarting the wait.
  if (waitingToTeleport && Math.hypot(point.x - waitingToTeleport.x, point.y - waitingToTeleport.y) < 2) return;
  waitingToTeleport = { ...point, since: performance.now() };
}

// ---- Listening to the mouse ----------------------------------------------------------
window.addEventListener("pointermove", (event) => {
  if (!event.isPrimary) return;
  target = keepOnScreen(event.clientX, event.clientY);
  teleportWhenMouseRests(target.x, target.y);
});
window.addEventListener("pointerdown", (event) => {
  if (!event.isPrimary) return;
  target = keepOnScreen(event.clientX, event.clientY);
  teleportShapesTo(target);                          // a click summons the shapes at once
});
window.addEventListener("pointerup", (event) => {
  if (event.isPrimary && event.pointerType === "touch") teleportWhenMouseRests(event.clientX, event.clientY);
});
const forgetTheMouse = () => { waitingToTeleport = null; fadeShapesAway(); };
document.addEventListener("pointerleave", forgetTheMouse);
window.addEventListener("pointercancel", forgetTheMouse);
window.addEventListener("blur", forgetTheMouse);
window.addEventListener("keydown", (event) => {
  // Keys pressed while reading the letter belong to the letter.
  if (event.target instanceof Element && event.target.closest("input, textarea, .paper")) return;
  if (event.key === "Escape") {
    target = { x: width / 2, y: height / 2 };
    teleportShapesTo(target);
  }
  if (event.code === "Space") { event.preventDefault(); paused = !paused; }
});
window.addEventListener("resize", fitToWindow);

// ---- Moving things along ----------------------------------------------------------------
function moveEverything(millisecondsSinceLastFrame, now) {
  // The trail: every point moves 40% of the way towards the one ahead of it, 60 times a second
  // (in fixed steps, so the elastic feel is the same on 60 Hz and 144 Hz screens).
  if (paused) {
    trail.forEach((point) => { point.x = target.x; point.y = target.y; });
    trailClock = 0;
  } else {
    trailClock += millisecondsSinceLastFrame;
    while (trailClock >= 1000 / 60) {
      trail.forEach((point, index) => {
        const ahead = index ? trail[index - 1] : target;
        point.x += (ahead.x - point.x) * 0.4;
        point.y += (ahead.y - point.y) * 0.4;
      });
      trailClock -= 1000 / 60;
    }
    detailsTurning += millisecondsSinceLastFrame / 1000;
  }

  shapesHere.age += millisecondsSinceLastFrame;
  if (paused) {
    shapesHere.age = TIME_TO_DRAW_SHAPES;
    shapesLeaving = null;
  } else if (shapesHere.age >= TIME_TO_DRAW_SHAPES) {
    shapesHere.rotation += millisecondsSinceLastFrame / 1000;   // finished drawing: start turning
  }
  if (shapesLeaving) {
    shapesLeaving.fadeAge += millisecondsSinceLastFrame;
    if (shapesLeaving.fadeAge >= TIME_TO_FADE_SHAPES) shapesLeaving = null;
  }
  if (waitingToTeleport && now - waitingToTeleport.since >= WAIT_BEFORE_REDRAWING) teleportShapesTo(waitingToTeleport);
}

// How far a trail point (by number, fractions allowed) is from the clock's centre, in clock units.
function lagOf(index) {
  const bounded = Math.max(0, Math.min(trail.length - 1, index));
  const before = trail[Math.floor(bounded)];
  const after = trail[Math.ceil(bounded)];
  const blend = bounded % 1;
  return {
    x: (before.x + (after.x - before.x) * blend - trail[0].x) / scale,
    y: (before.y + (after.y - before.y) * blend - trail[0].y) / scale,
  };
}

// ---- Drawing helpers (violet ink; lines stop at drawnFraction while being drawn) ------------
function ink(alpha = 1) {
  return `rgba(${VIOLET},${alpha})`;
}
function ring(radius, alpha = 1, lineWidth = 0.8) {
  if (drawnFraction <= 0) return;
  const start = -Math.PI / 2;                          // circles draw clockwise from 12 o'clock
  const end = start + FULL_TURN * drawnFraction;
  pen.beginPath();
  pen.arc(0, 0, radius, start, end);
  pen.strokeStyle = ink(alpha);
  pen.lineWidth = lineWidth;
  pen.stroke();
  if (drawnFraction < 1) {                             // a bright dot where the "pen" is while drawing
    pen.beginPath();
    pen.arc(Math.cos(end) * radius, Math.sin(end) * radius, 1.7, 0, FULL_TURN);
    pen.fillStyle = ink(0.95);
    pen.fill();
  }
}
function line(x1, y1, x2, y2, alpha = 0.6, lineWidth = 0.8) {
  if (drawnFraction <= 0) return;
  pen.beginPath();
  pen.moveTo(x1, y1);
  pen.lineTo(x1 + (x2 - x1) * drawnFraction, y1 + (y2 - y1) * drawnFraction);
  pen.strokeStyle = ink(alpha);
  pen.lineWidth = lineWidth;
  pen.stroke();
}
function polygon(radius, sides, rotation, alpha = 0.5) {
  if (drawnFraction <= 0) return;
  const edgesToDraw = drawnFraction * sides;
  pen.beginPath();
  pen.moveTo(Math.cos(rotation) * radius, Math.sin(rotation) * radius);
  for (let i = 0; i < Math.ceil(edgesToDraw); i++) {
    const a = rotation + (i * FULL_TURN) / sides;
    const b = rotation + ((i + 1) * FULL_TURN) / sides;
    const partOfEdge = Math.min(1, edgesToDraw - i);
    pen.lineTo((Math.cos(a) + (Math.cos(b) - Math.cos(a)) * partOfEdge) * radius,
               (Math.sin(a) + (Math.sin(b) - Math.sin(a)) * partOfEdge) * radius);
  }
  pen.strokeStyle = ink(alpha);
  pen.lineWidth = 0.75;
  pen.stroke();
}
function dot(x, y, radius, alpha) {
  pen.beginPath();
  pen.arc(x, y, radius, 0, FULL_TURN);
  pen.fillStyle = ink(alpha * drawnFraction);
  pen.fill();
}
function sparkleStar(x, y, radius, alpha) {
  line(x - radius, y, x + radius, y, alpha);
  line(x, y - radius, x, y + radius, alpha);
  dot(x, y, 1.2, alpha);
}
// Letters around a circle; letter number i follows trail point (firstTrailPoint + i).
function ringOfLetters(letters, radius, rotation, alpha = 0.8, size = 12, firstTrailPoint = 0) {
  pen.font = `${size}px Georgia, serif`;
  pen.textAlign = "center";
  pen.textBaseline = "middle";
  letters.forEach((letter, i) => {
    const shown = clampToOne(drawnFraction * letters.length - i);
    if (!shown) return;
    const angle = rotation + (i * FULL_TURN) / letters.length;
    const lag = lagOf(firstTrailPoint + i);
    pen.save();
    pen.translate(Math.cos(angle) * radius + lag.x, Math.sin(angle) * radius + lag.y);
    pen.rotate(angle + Math.PI / 2);
    pen.fillStyle = ink(alpha * shown);
    pen.fillText(letter, 0, 0);
    pen.restore();
  });
}
// Mayan numbers: a bar is 5, a dot is 1. So 7 is one bar with two dots above it.
function mayanNumeral(value, x, y) {
  const bars = Math.floor(value / 5);
  const dots = value % 5;
  const rows = bars + (dots ? 1 : 0);
  const top = y - (rows - 1) * 3.5;
  for (let d = 0; d < dots; d++) dot(x + (d - (dots - 1) / 2) * 5, top, 1.65, 0.95);
  for (let b = 0; b < bars; b++) {
    const barY = top + (b + (dots ? 1 : 0)) * 7;
    line(x - 8.5, barY, x + 8.5, barY, 0.95, 2.7);
  }
}
// The three hands, drawn as dotted lines; their dots trail behind one after another.
function hands(now, alpha, firstTrailPoint) {
  const seconds = now.getSeconds() + now.getMilliseconds() / 1000;
  const minutes = now.getMinutes() + seconds / 60;
  const hours = (now.getHours() % 12) + minutes / 60;
  const handList = [
    { angle: (hours / 12) * FULL_TURN, length: 43, trailStart: 0, trailSpan: 3, dotSize: 1.9 },
    { angle: (minutes / 60) * FULL_TURN, length: 64, trailStart: 3, trailSpan: 4, dotSize: 1.3 },
    { angle: (seconds / 60) * FULL_TURN, length: 73, trailStart: 7, trailSpan: 5, dotSize: 1.3 },
  ];
  for (const hand of handList) {
    const dotCount = Math.floor(hand.length / 7);
    for (let i = 0; i <= dotCount; i++) {
      const lag = lagOf(firstTrailPoint + hand.trailStart + (i / dotCount) * (hand.trailSpan - 1));
      dot(Math.cos(hand.angle - Math.PI / 2) * i * 7 + lag.x,
          Math.sin(hand.angle - Math.PI / 2) * i * 7 + lag.y, hand.dotSize, alpha);
    }
  }
  const hub = lagOf(firstTrailPoint);
  pen.save();
  pen.translate(hub.x, hub.y);
  ring(3, alpha, 1.4);
  pen.restore();
}
// The 60 little marks around the dial; every fifth one is longer.
function tickMarks(radius, alpha, firstTrailPoint) {
  for (let i = 0; i < 60; i++) {
    const angle = (i * FULL_TURN) / 60;
    const inner = radius - (i % 5 === 0 ? 6 : 2);
    const lag = lagOf(firstTrailPoint + ((i / 5 + 2) % 12));
    line(Math.cos(angle) * inner + lag.x, Math.sin(angle) * inner + lag.y,
         Math.cos(angle) * radius + lag.x, Math.sin(angle) * radius + lag.y, alpha, i % 5 === 0 ? 1 : 0.6);
  }
}

// ---- Drawing the two layers ----------------------------------------------------------------
// The shapes: circles, triangles and an octagon, each drawing itself during its own slice of time.
function drawShapes(spot, opacity) {
  const drawn = clampToOne(spot.age / TIME_TO_DRAW_SHAPES);
  const slice = (from, to) => clampToOne((drawn - from) / (to - from));
  const t = spot.rotation;
  pen.save();
  pen.globalAlpha = opacity;
  pen.translate(spot.x, spot.y);
  pen.scale(scale, scale);

  const glow = pen.createRadialGradient(0, 0, 12, 0, 0, 157);   // soft violet glow behind the clock
  glow.addColorStop(0, ink(0.045 * drawn));
  glow.addColorStop(0.65, ink(0.025 * drawn));
  glow.addColorStop(1, ink(0));
  pen.fillStyle = glow;
  pen.fillRect(-160, -160, 320, 320);

  pen.shadowColor = ink(0.6);
  pen.shadowBlur = 7;
  drawnFraction = slice(0, 0.4);     ring(132, 0.2);
  drawnFraction = slice(0.06, 0.46); ring(111, 0.45);
  drawnFraction = slice(0.1, 0.5);   ring(106, 0.22);
  drawnFraction = slice(0.14, 0.54); ring(99, 0.75);
  drawnFraction = slice(0.22, 0.7);  polygon(109, 3, t * 0.06 - Math.PI / 2, 0.6);    // two triangles turning
  drawnFraction = slice(0.3, 0.78);  polygon(109, 3, -t * 0.06 + Math.PI / 2, 0.45);  // opposite ways: a star
  drawnFraction = slice(0.45, 0.82); polygon(29, 8, t * 0.12, 0.75);                  // the octagon in the middle
  drawnFraction = 1;
  pen.restore();
}

// The details: always fully visible, trailing the mouse piece by piece.
function drawDetails(now) {
  const t = detailsTurning;
  pen.save();
  pen.translate(trail[0].x, trail[0].y);
  pen.scale(scale, scale);
  pen.shadowColor = ink(0.6);
  pen.shadowBlur = 7;
  drawnFraction = 1;

  // The date's letters lead the trail; the clock face follows after them.
  const dateText = now.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).toUpperCase() + " · ";
  const faceStart = [...dateText].length;
  tickMarks(94, 0.65, faceStart);
  ringOfLetters(RUNES.filter((_, i) => i % 2 === 0), 123, t * 0.045, 0.65, 10, 8);
  for (let hour = 1; hour <= 12; hour++) {
    const angle = (hour * FULL_TURN) / 12 - Math.PI / 2;
    const lag = lagOf(faceStart + hour - 1);
    mayanNumeral(hour, Math.cos(angle) * 79 + lag.x, Math.sin(angle) * 79 + lag.y);
  }
  hands(now, 0.95, faceStart + 12);
  ringOfLetters([...dateText], 146, -t * 0.04, 0.6, 8);
  for (let i = 0; i < 3; i++) {
    const angle = t * 0.16 + (i * FULL_TURN) / 3;
    const lag = lagOf(8 + i * 4);
    sparkleStar(Math.cos(angle) * 112 + lag.x, Math.sin(angle) * 112 + lag.y, 4, 0.95);
  }

  // Little motes of light drifting around the edge, each pulsing at its own pace.
  pen.shadowBlur = 0;
  for (let i = 0; i < 19; i++) {
    const angle = i * 2.39996 + t * (i % 2 ? 1 : -1) * 0.024;
    const radius = 135 + Math.sin(i * 53.7) * 19;
    const pulse = 0.16 + (Math.sin(t * 1.4 + i * 1.9) + 1) * 0.2;
    const lag = lagOf(i + 8);
    dot(Math.cos(angle) * radius + lag.x, Math.sin(angle) * radius + lag.y, i % 5 === 0 ? 1.4 : 0.65, pulse);
  }
  pen.restore();
}

// ---- The animation loop -----------------------------------------------------------------------
let previousTimestamp = 0;

function nextFrame(timestamp) {
  const millisecondsSinceLastFrame = Math.min(timestamp - previousTimestamp || 16.67, 50);
  previousTimestamp = timestamp;
  moveEverything(millisecondsSinceLastFrame, timestamp);
  pen.clearRect(0, 0, width, height);
  if (shapesLeaving) drawShapes(shapesLeaving, 1 - shapesLeaving.fadeAge / TIME_TO_FADE_SHAPES);
  if (!shapesHidden) drawShapes(shapesHere, 1);
  drawDetails(new Date());
  requestAnimationFrame(nextFrame);
}

fitToWindow();
requestAnimationFrame(nextFrame);
