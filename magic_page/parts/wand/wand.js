// THE WAND
//
// What starts it:  moving the mouse (sparkles) and HOLDING the mouse button (green line).
// What it does:
//   - Sparkles trail behind the mouse (made by the borrowed cursor-effects library).
//   - While the button is held, a glowing green line follows the mouse, with little stars
//     twinkling off it (glitter).
//   - When the button is released, the line stays for 1 more second, still glittering.
//     Pressing again within that second adds another line to the same drawing, which is
//     how you draw a cross (two lines).
//   - After that second, the whole drawing is handed to the spellbook, which decides
//     whether it was a spell. The drawing then fades with a last burst of glitter:
//     gold if it was a spell, green if not.
//   - Clicking inside the open letter doesn't draw: that's for scrolling and reading.
// What changes:    only what's on screen.

import { whenDrawingFinished } from "../spellbook/spellbook.js";

const EXTRA_TIME_AFTER_RELEASE = 1000;   // milliseconds the line stays after letting go
const FADE_TIME = 900;
const LINE_COLOURS = { green: "#3dff8a", gold: "#e8c15a" };
const GLITTER_COLOURS = {
  green: ["#3dff8a", "#7dff6a", "#c6ffd9", "#ffffff"],
  gold: ["#e8c15a", "#fff0b0", "#ffd98a", "#ffffff"],
};
const motionIsReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---- Sparkles (borrowed: cursor-effects by Tim Holman) ----------------------
// Yellow-white and purples. The library adds its own canvas at the end of the page;
// we give it a class so our CSS can place it in front of everything else.
new cursoreffects.fairyDustCursor({ colors: ["#fff6d6", "#e8c15a", "#c9a7ff", "#b44cff", "#7b2cbf"] });
const sparklesCanvas = document.body.lastElementChild;
if (sparklesCanvas && sparklesCanvas.tagName === "CANVAS") {
  sparklesCanvas.classList.add("wand-sparkles");
}

// ---- The line and its glitter --------------------------------------------------
const canvas = document.getElementById("drawing-line");
const pen = canvas.getContext("2d");

let strokes = [];            // the drawing: a list of lines, each line a list of {x, y} points
let buttonIsHeld = false;
let finishTimer = null;      // counts down the extra second after release
let colour = "green";        // "green" while drawing, "gold" once a spell is recognised
let fadingSince = null;      // when the drawing started fading away (null = not fading)
let glitter = [];            // little twinkling stars: {x, y, driftX, driftY, born, life, size, colour}

function fitCanvasToWindow() {
  const pixelDensity = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * pixelDensity;
  canvas.height = window.innerHeight * pixelDensity;
  pen.setTransform(pixelDensity, 0, 0, pixelDensity, 0, 0);
}

function addGlitterAt(x, y, howMany) {
  if (motionIsReduced) return;
  const colours = GLITTER_COLOURS[colour];
  for (let i = 0; i < howMany; i++) {
    glitter.push({
      x: x + (Math.random() - 0.5) * 14,
      y: y + (Math.random() - 0.5) * 14,
      driftX: (Math.random() - 0.5) * 0.04,             // pixels per millisecond
      driftY: -0.01 - Math.random() * 0.03,             // glitter floats slightly upwards
      born: performance.now(),
      life: 500 + Math.random() * 900,
      size: 1.5 + Math.random() * 3,
      colour: colours[Math.floor(Math.random() * colours.length)],
    });
  }
}

// A random point somewhere along the drawing (used to keep the lingering line glittering).
function randomPointOnDrawing() {
  const line = strokes[Math.floor(Math.random() * strokes.length)];
  return line[Math.floor(Math.random() * line.length)];
}

// A four-pointed star, like a glint of light.
function drawGlint(x, y, size) {
  pen.beginPath();
  pen.moveTo(x, y - size * 2);
  pen.quadraticCurveTo(x, y, x + size * 2, y);
  pen.quadraticCurveTo(x, y, x, y + size * 2);
  pen.quadraticCurveTo(x, y, x - size * 2, y);
  pen.quadraticCurveTo(x, y, x, y - size * 2);
  pen.fill();
}

function drawTheLines(opacity) {
  pen.lineCap = "round";
  pen.lineJoin = "round";
  for (const stroke of strokes) {
    if (stroke.length < 2) continue;
    // Each line is drawn twice: wide and faint (the glow), then thin and bright (the core).
    for (const [width, alpha] of [[14, 0.25], [4, 1]]) {
      pen.strokeStyle = LINE_COLOURS[colour];
      pen.lineWidth = width;
      pen.globalAlpha = opacity * alpha;
      pen.beginPath();
      pen.moveTo(stroke[0].x, stroke[0].y);
      for (const point of stroke.slice(1)) pen.lineTo(point.x, point.y);
      pen.stroke();
    }
  }
}

function drawGlitter(now) {
  pen.globalCompositeOperation = "lighter";            // overlapping glints add up to brighter light
  glitter = glitter.filter((glint) => now - glint.born < glint.life);
  for (const glint of glitter) {
    const age = now - glint.born;
    const lifeLeft = 1 - age / glint.life;
    const twinkle = 0.55 + 0.45 * Math.sin(age / 45);   // flickers as it fades
    pen.globalAlpha = lifeLeft * twinkle;
    pen.fillStyle = glint.colour;
    drawGlint(glint.x + glint.driftX * age, glint.y + glint.driftY * age, glint.size * (0.5 + lifeLeft * 0.5));
  }
  pen.globalCompositeOperation = "source-over";
}

// Runs every screen refresh: draws the line (fading if it's time) and the glitter.
function animate(now) {
  pen.clearRect(0, 0, window.innerWidth, window.innerHeight);
  let opacity = 1;
  if (fadingSince !== null) {
    opacity = Math.max(0, 1 - (now - fadingSince) / FADE_TIME);
    if (opacity === 0) {
      strokes = [];
      fadingSince = null;
    }
  }
  if (strokes.length) {
    drawTheLines(opacity);
    // The line keeps glittering while it's on screen, a few glints at random spots each frame.
    const point = randomPointOnDrawing();
    if (point) addGlitterAt(point.x, point.y, opacity > 0.5 ? 2 : 1);
  }
  drawGlitter(now);
  pen.globalAlpha = 1;
  requestAnimationFrame(animate);
}

// ---- Drawing with the mouse -----------------------------------------------------
function startLine(event) {
  if (event.button !== 0) return;                                   // only the main (left) button draws
  if (event.target instanceof Element && event.target.closest(".scroll.is-open .paper")) return;   // reading the letter
  clearTimeout(finishTimer);                                        // pressed again in time: keep adding to this drawing
  if (fadingSince !== null) {                                       // an old drawing is still fading: start fresh
    strokes = [];
    fadingSince = null;
  }
  colour = "green";
  buttonIsHeld = true;
  strokes.push([{ x: event.clientX, y: event.clientY }]);
}

function continueLine(event) {
  if (!buttonIsHeld) return;
  strokes[strokes.length - 1].push({ x: event.clientX, y: event.clientY });
  addGlitterAt(event.clientX, event.clientY, 2);
}

function endLine() {
  if (!buttonIsHeld) return;
  buttonIsHeld = false;
  finishTimer = setTimeout(finishDrawing, EXTRA_TIME_AFTER_RELEASE);
}

// The extra second is over: ask the spellbook, then fade the drawing away in a shower of glitter.
function finishDrawing() {
  const wasASpell = whenDrawingFinished(strokes);
  colour = wasASpell ? "gold" : "green";
  for (const stroke of strokes) {
    for (let i = 0; i < stroke.length; i += 3) addGlitterAt(stroke[i].x, stroke[i].y, wasASpell ? 3 : 1);
  }
  fadingSince = performance.now();
}

window.addEventListener("pointerdown", startLine);
window.addEventListener("pointermove", continueLine);
window.addEventListener("pointerup", endLine);
window.addEventListener("pointercancel", endLine);
window.addEventListener("resize", fitCanvasToWindow);
fitCanvasToWindow();
requestAnimationFrame(animate);
