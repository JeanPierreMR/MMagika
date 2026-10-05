// THE PROFILER — finds out what makes the page slow. Only for your own computer.
//
// What starts it:  opening the page with ?profile at the end of the address, while the server
//                  runs with DJANGO_DEBUG=1 (e.g. http://localhost:8001/?profile).
// What it does:    casts the healing spell by itself, waits until the letter is writing, then
//                  measures how smoothly the page runs:
//                    - first with everything on,
//                    - then with ONE part switched off at a time (the colour animation, the
//                      sparks, the scroll's shadow, the stars, ...),
//                    - then with everything off, and with everything on again at the end.
//                  Whatever makes the biggest jump in smoothness when switched off is what costs
//                  the most. During the whole run it moves a pretend mouse in circles, so the
//                  mouse effects are measured too (keep your own mouse still).
//                  In Chrome/Edge it also notes which script files take the time in slow frames.
// What it shows:   a table in a panel on the right, with a button to copy the report.
// "Switched off" means hidden (display: none): the browser stops drawing it. Its JavaScript may
// still run; that part of the cost shows up in the script table instead.

import { castHealingSpell } from "../healing_spell/healing_spell.js";

const SETTLE_TIME = 700;      // ms to wait after switching something, before measuring
const MEASURE_TIME = 4000;    // ms of measuring per step

// Each experiment adds a class to <html>; profiler.css hides the matching part.
const EXPERIMENTS = [
  ["everything on", []],
  ["no colour animation inside the letters", ["p-no-colour"]],
  ["no sparks on the letters", ["p-no-sparks"]],
  ["writing paused (no tracing/filling)", ["p-no-writing"]],
  ["no scroll shadow & glow (filter on the whole scroll)", ["p-no-scroll-shadow"]],
  ["no letter drawings at all", ["p-no-letter"]],
  ["no night sky (stars canvas)", ["p-no-sky"]],
  ["no wand (drawing line + mouse sparkles)", ["p-no-wand"]],
  ["no enchanted clock", ["p-no-clock"]],
  ["no memories in the background", ["p-no-memories"]],
  ["no watching eyes", ["p-no-eyes"]],
  ["no golden ball", ["p-no-ball"]],
  ["everything off", ["p-no-colour", "p-no-sparks", "p-no-writing", "p-no-scroll-shadow", "p-no-letter", "p-no-sky",
    "p-no-wand", "p-no-clock", "p-no-memories", "p-no-eyes", "p-no-ball"]],
  ["everything on (again, to check nothing drifted)", []],
];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---- The panel --------------------------------------------------------------------------------
const panel = document.createElement("div");
panel.id = "profiler-panel";
panel.innerHTML = `
  <h2>Profiler</h2>
  <p class="profiler-note">Keep your mouse still. It casts the spell, waits for the writing, then runs
  ${EXPERIMENTS.length} steps of ${(SETTLE_TIME + MEASURE_TIME) / 1000} s. Keep this tab in front.</p>
  <button type="button" id="profiler-start">Start (with the spell)</button>
  <button type="button" id="profiler-now">Measure now (as it is)</button>
  <p id="profiler-status"></p>
  <div id="profiler-results"></div>
  <button type="button" id="profiler-copy" hidden>Copy report</button>`;
document.body.appendChild(panel);
const status = panel.querySelector("#profiler-status");
const results = panel.querySelector("#profiler-results");

// ---- A pretend mouse, moving in circles --------------------------------------------------------
let pretendMouseOn = false;
function movePretendMouse(now) {
  if (!pretendMouseOn) return;
  const x = innerWidth / 2 + Math.cos(now / 700) * innerWidth * 0.3;
  const y = innerHeight / 2 + Math.sin(now / 900) * innerHeight * 0.3;
  const target = document.elementFromPoint(x, y) || document.body;
  target.dispatchEvent(new PointerEvent("pointermove", { clientX: x, clientY: y, bubbles: true, pointerType: "mouse" }));
  target.dispatchEvent(new MouseEvent("mousemove", { clientX: x, clientY: y, bubbles: true }));
  requestAnimationFrame(movePretendMouse);
}

// ---- Which scripts take the time (Chrome/Edge only: "long animation frames") -------------------
let slowFrames = [];
const canSeeScripts = PerformanceObserver.supportedEntryTypes?.includes("long-animation-frame");
if (canSeeScripts) {
  new PerformanceObserver((list) => slowFrames.push(...list.getEntries())).observe({ type: "long-animation-frame", buffered: false });
}

// ---- Measuring one step -------------------------------------------------------------------------
function measureFrames(duration) {
  return new Promise((resolve) => {
    const frameTimes = [];
    let last = null;
    const start = performance.now();
    function frame(now) {
      if (last !== null) frameTimes.push(now - last);
      last = now;
      if (now - start < duration) requestAnimationFrame(frame);
      else resolve(frameTimes);
    }
    requestAnimationFrame(frame);
  });
}

function summarise(frameTimes) {
  const sorted = [...frameTimes].sort((a, b) => a - b);
  const total = frameTimes.reduce((a, b) => a + b, 0);
  const pick = (share) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * share))] || 0;
  return {
    fps: frameTimes.length / (total / 1000),
    median: pick(0.5),
    p95: pick(0.95),
    worst: sorted[sorted.length - 1] || 0,
    slowShare: frameTimes.filter((t) => t > 25).length / (frameTimes.length || 1),   // frames slower than 40 fps
  };
}

function scriptTimeByFile(entries) {
  const byFile = new Map();
  for (const entry of entries) {
    for (const script of entry.scripts || []) {
      const file = (script.sourceURL || script.invoker || "unknown").replace(location.origin, "").replace(/^\/static\//, "");
      byFile.set(file, (byFile.get(file) || 0) + script.duration);
    }
  }
  return [...byFile.entries()].sort((a, b) => b[1] - a[1]);
}

function pageFacts() {
  const canvases = [...document.querySelectorAll("canvas")].map((c) => `${c.id || c.className || "canvas"} ${c.width}×${c.height}`);
  return {
    browser: navigator.userAgent,
    screen: `${innerWidth}×${innerHeight} at ${devicePixelRatio}× pixels`,
    "elements on the page": document.getElementsByTagName("*").length,
    "SVG elements": document.querySelectorAll("svg *").length,
    "running animations (CSS)": document.getAnimations().length,
    canvases,
  };
}

// ---- Running everything ---------------------------------------------------------------------------
async function run(withSpell) {
  panel.querySelectorAll("button").forEach((b) => (b.disabled = true));
  results.innerHTML = "";
  if (withSpell) {
    status.textContent = "Casting the spell… (about 20 s until the letter starts writing)";
    castHealingSpell();
    while (!document.querySelector(".decree-svg.is-writing")) await wait(250);
    await wait(1500);
  }
  pretendMouseOn = true;
  requestAnimationFrame(movePretendMouse);

  const rows = [];
  const html = document.documentElement;
  for (const [index, [name, classes]] of EXPERIMENTS.entries()) {
    status.textContent = `Step ${index + 1} of ${EXPERIMENTS.length}: ${name}`;
    classes.forEach((c) => html.classList.add(c));
    await wait(SETTLE_TIME);
    slowFrames = [];
    const summary = summarise(await measureFrames(MEASURE_TIME));
    rows.push({ name, ...summary, scripts: scriptTimeByFile(slowFrames), slowFrameCount: slowFrames.length });
    classes.forEach((c) => html.classList.remove(c));
    showTable(rows);
  }
  pretendMouseOn = false;
  status.textContent = "Done. The biggest gain when a part is switched off = the most expensive part.";
  showReport(rows);
  panel.querySelectorAll("button").forEach((b) => (b.disabled = false));
}

function showTable(rows) {
  const base = rows[0];
  const cell = (n, digits = 1) => n.toFixed(digits);
  results.innerHTML = `<table>
    <tr><th>step</th><th>fps</th><th>gain</th><th>median ms</th><th>95% ms</th><th>worst ms</th><th>slow frames</th></tr>
    ${rows.map((r) => `<tr><td>${r.name}</td><td>${cell(r.fps)}</td>
      <td>${r === base ? "" : (r.fps - base.fps >= 0 ? "+" : "") + cell(r.fps - base.fps)}</td>
      <td>${cell(r.median)}</td><td>${cell(r.p95)}</td><td>${cell(r.worst, 0)}</td><td>${Math.round(r.slowShare * 100)}%</td></tr>`).join("")}
  </table>`;
}

function showReport(rows) {
  const scripts = rows[0].scripts;
  if (canSeeScripts) {
    results.insertAdjacentHTML("beforeend", `<h3>Script time in slow frames, everything on (${MEASURE_TIME / 1000} s)</h3>
      <table>${scripts.length ? scripts.map(([file, ms]) => `<tr><td>${file}</td><td>${ms.toFixed(0)} ms</td></tr>`).join("")
        : "<tr><td>No slow frames caused by scripts.</td></tr>"}</table>`);
  } else {
    results.insertAdjacentHTML("beforeend", "<p class='profiler-note'>This browser can't say which scripts are slow (Chrome/Edge can).</p>");
  }
  const facts = pageFacts();
  results.insertAdjacentHTML("beforeend", `<h3>The page</h3><table>${Object.entries(facts).map(([k, v]) =>
    `<tr><td>${k}</td><td>${Array.isArray(v) ? v.join("<br>") : v}</td></tr>`).join("")}</table>`);

  const report = JSON.stringify({ rows: rows.map((r) => ({ ...r, fps: +r.fps.toFixed(1), median: +r.median.toFixed(1), p95: +r.p95.toFixed(1), worst: +r.worst.toFixed(0), slowShare: +r.slowShare.toFixed(2), scripts: r.scripts.map(([f, ms]) => [f, +ms.toFixed(0)]) })), facts }, null, 1);
  console.log("PROFILER REPORT\n" + report);
  const copy = panel.querySelector("#profiler-copy");
  copy.hidden = false;
  copy.onclick = async () => {
    try { await navigator.clipboard.writeText(report); copy.textContent = "Copied!"; }
    catch { copy.textContent = "Couldn't copy: it's also in the console (F12)"; }
  };
}

panel.querySelector("#profiler-start").addEventListener("click", () => run(true));
panel.querySelector("#profiler-now").addEventListener("click", () => run(false));
// Clicks on the panel shouldn't draw with the wand.
panel.addEventListener("pointerdown", (event) => event.stopPropagation());
