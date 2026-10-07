// THE BLUEPRINT INTRO — before the letter page shows itself.
//
// What starts it:  letter.js, when the page loads.
// What it does:    1. black;
//                  2. the closed scroll's outline (the roll, the ribbons, the seal) draws itself in
//                     blue, with a few measuring lines and labels, as if the machine scanned it;
//                  3. the outline fades: black again;
//                  4. the black fades away and the page appears.
//                  The outline is taken from where the real scroll is on screen, so it lines up.
// What changes:    nothing; it resolves (the promise) once the page has appeared.
// How long:        the numbers just below (milliseconds).

const BLACK_FIRST = 700;         // black before the outline starts
const DRAW_TIME = 1800;          // each line drawing itself (they start one after another)
const STAGGER = 220;             // between one part's lines and the next
const HOLD = 900;                // the finished outline stays
const OUTLINE_FADE = 700;        // matches .blueprint's transition in blueprint_intro.css
const BLACK_AGAIN = 500;         // black again before the page fades in
const REVEAL_TIME = 1400;        // the fade from black to the page

const SVG = "http://www.w3.org/2000/svg";
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function draw(svg, tag, attributes, { delay = 0, faint = false } = {}) {
  const shape = document.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attributes)) shape.setAttribute(name, value);
  shape.setAttribute("pathLength", 1);
  shape.classList.add("line");
  if (faint) shape.classList.add("faint");
  shape.style.setProperty("--delay", `${delay}ms`);
  svg.appendChild(shape);
}
function label(svg, x, y, text, delay, anchor = "start") {
  const words = document.createElementNS(SVG, "text");
  Object.entries({ x, y, "text-anchor": anchor }).forEach(([name, value]) => words.setAttribute(name, value));
  words.classList.add("label");
  words.style.setProperty("--delay", `${delay}ms`);
  words.textContent = text;
  svg.appendChild(words);
}

// The outline, from the real parts of the closed scroll.
function traceTheScroll(svg) {
  const box = (selector) => document.querySelector(selector)?.getBoundingClientRect();
  const roll = box("#scroll .roll") || box("#scroll");
  if (!roll) return 0;
  let step = 0;
  const next = () => (step++) * STAGGER;
  const radius = Math.min(roll.height / 2, 40);

  // The roll, and its two curled ends.
  draw(svg, "rect", { x: roll.left, y: roll.top, width: roll.width, height: roll.height, rx: radius }, { delay: next() });
  for (const x of [roll.left + radius, roll.right - radius]) {
    draw(svg, "ellipse", { cx: x, cy: roll.top + roll.height / 2, rx: radius * 0.45, ry: roll.height / 2 - 3 }, { delay: next(), faint: true });
  }
  // The ribbons.
  for (const ribbon of document.querySelectorAll("#scroll .ribbon")) {
    const r = ribbon.getBoundingClientRect();
    if (r.width && r.height) draw(svg, "rect", { x: r.left, y: r.top, width: r.width, height: r.height, rx: 2 }, { delay: next(), faint: true });
  }
  // The seal.
  const seal = box("#scroll .wax-seal");
  if (seal) {
    const cx = seal.left + seal.width / 2, cy = seal.top + seal.height / 2, r = Math.min(seal.width, seal.height) / 2;
    draw(svg, "circle", { cx, cy, r }, { delay: next() });
    draw(svg, "circle", { cx, cy, r: r * 0.68 }, { delay: next(), faint: true });
  }
  // Measuring lines and labels, like a scan.
  const below = roll.bottom + 28, left = roll.left, right = roll.right;
  const at = next();
  draw(svg, "path", { d: `M${left} ${below - 6}V${below + 6}M${left} ${below}H${right}M${right} ${below - 6}V${below + 6}` }, { delay: at, faint: true });
  label(svg, (left + right) / 2, below + 20, "OBJECT 01 · SEALED TRANSMISSION", at + DRAW_TIME * 0.6, "middle");
  label(svg, left, roll.top - 16, "SCAN ▸ HOLO-V13", at + DRAW_TIME * 0.4);
  label(svg, right, roll.top - 16, "MD · SEAL INTACT", at + DRAW_TIME * 0.8, "end");
  return at + DRAW_TIME;                                  // when the last line is finished
}

export async function playBlueprintIntro({ onOutlineGone = () => {} } = {}) {
  const intro = document.querySelector(".blueprint-intro");
  if (!intro) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {   // just a short fade from black
    onOutlineGone();
    intro.style.setProperty("--reveal-time", "0.6s");
    intro.classList.add("is-revealing");
    await wait(600);
    intro.remove();
    return;
  }
  const svg = intro.querySelector(".blueprint");
  svg.style.setProperty("--draw-time", `${DRAW_TIME}ms`);
  intro.style.setProperty("--reveal-time", `${REVEAL_TIME}ms`);
  const drawingTime = traceTheScroll(svg);
  await wait(BLACK_FIRST);
  intro.classList.add("is-drawing");
  await wait(drawingTime + HOLD);
  intro.classList.add("is-fading-outline");
  onOutlineGone();                                  // e.g. the choir starts here (letter.js)
  await wait(OUTLINE_FADE + BLACK_AGAIN);
  intro.classList.add("is-revealing");
  await wait(REVEAL_TIME);
  intro.remove();
}
