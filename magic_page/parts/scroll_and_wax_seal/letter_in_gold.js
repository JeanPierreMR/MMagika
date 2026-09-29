// THE LETTER IN GOLD — the lettering effect from decree.html.
//
// What starts it:  the scroll calls writeLetterInGold() when it opens.
// What it uses:    the paragraphs in letter.html (class "letter-paragraph").
// What it does:    for each paragraph, builds a drawing (SVG) with three layers:
//   1. GOLD: every letter in bold gothic gold.
//   2. COLOUR: soft blurred dots of rainbow colour drifting slowly, visible only
//      inside the letters (a "mask" cuts them to the letter shapes).
//   3. SPARKS: little four-pointed stars that fly off about a third of the letters.
//   Lines are justified like a printed page; the last line of a paragraph is centred.
//   Then the letter WRITES ITSELF, as in decree.html: letter by letter, line by line, each
//   letter's gold outline is traced like ink, then filled, then the colours bloom inside it.
//   A paragraph's sparks wake up once it is finished. The scroll follows the writing down,
//   until the reader scrolls by themselves.
// What changes:    only what's on screen. The original paragraph stays (invisible) for screen readers.
// To save work, a paragraph's colours only move while it is visible in the scroll.

const SVG = "http://www.w3.org/2000/svg";

// Lettering, exactly as in decree.html.
const FONT = "'Grenze Gotisch', Georgia, serif";
const FONT_SIZE = 42;
const FONT_WEIGHT = 800;
const LETTER_SPACING = 2;
const LINE_HEIGHT = 60;
const LINE_WIDTH = 1040;
const ROOM_AROUND_SIDES = 110;       // space left and right for sparks (decree.html: 110)
const ROOM_ABOVE_AND_BELOW = 70;     // a little less than decree.html, so paragraphs sit closer

// Writing speed, exactly as in decree.html (in seconds).
const DRAW_TIME = 2.0;               // how long one letter takes to trace and fill
const LETTER_GAP = 0.035;            // delay between one letter and the next
const LINE_PAUSE = 0.25;             // extra pause before each new line

// The colour field: the default values of decree.html's control panel.
const COLOUR_DOTS = 220;             // for a decree-sized block of text (see dotsFor below)
const DOT_SPEED = 1;
const DOT_SIZE = 1;
const DOT_BRIGHTNESS = 1;
const RAINBOW_SPREAD = 340;          // degrees of colour wheel across the text
const SOFTNESS = 14;                 // how blurred the dots are

// decree.html spread its 220 dots over about 1160 × 350 units of text, shown about 0.84× size.
// Our paragraphs are taller and shown smaller, so we keep what you SEE the same: the same number
// of dots per patch of screen. (Keeping 220 dots per paragraph's units would mean about three
// times as many dots on screen, which made the letter stutter.)
const DECREE_TEXT_AREA = 1160 * 350;
const DECREE_SHOWN_SIZE = 0.84;
function dotsFor(area, shownSize) {
  const areaOnScreenComparedToDecree = (area * shownSize * shownSize) / (DECREE_TEXT_AREA * DECREE_SHOWN_SIZE * DECREE_SHOWN_SIZE);
  return Math.max(40, Math.min(600, Math.round(COLOUR_DOTS * areaOnScreenComparedToDecree)));
}

const motionIsReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const paragraphs = [];               // one entry per drawn paragraph: its dots and whether it's on screen
const writingOrder = [];             // every gold letter with the second it starts being written
let lettersSoFar = 0;                // counts letters and lines across the whole letter,
let linesSoFar = 0;                  // so the writing flows on from one paragraph to the next
let alreadyWritten = false;

function make(name, attributes = {}) {
  const element = document.createElementNS(SVG, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  return element;
}

function makeLetter(character, x, y) {
  const letter = make("text", {
    x: x.toFixed(2), y: y.toFixed(2),
    "font-size": FONT_SIZE, "font-weight": FONT_WEIGHT, "letter-spacing": LETTER_SPACING,
  });
  letter.style.fontFamily = FONT;
  letter.textContent = character;
  return letter;
}

// ---- Building one paragraph ------------------------------------------------------------
function drawParagraph(source, number) {
  const svg = make("svg", { class: "decree-svg", "aria-hidden": "true", focusable: "false", viewBox: "0 0 1200 520" });
  // Each drawing needs its own names for its mask and blur, or they would clash.
  const maskId = `letter-mask-${number}`;
  const blurId = `letter-blur-${number}`;
  const glowId = `spark-glow-${number}`;
  svg.innerHTML = `
    <defs>
      <radialGradient id="${glowId}">
        <stop offset="0%" stop-color="#fff4c8" stop-opacity="0.9"/>
        <stop offset="55%" stop-color="#ffd98a" stop-opacity="0.22"/>
        <stop offset="100%" stop-color="#ffd98a" stop-opacity="0"/>
      </radialGradient>
      <filter id="${blurId}" x="-60%" y="-60%" width="220%" height="220%" color-interpolation-filters="sRGB">
        <feGaussianBlur stdDeviation="${SOFTNESS}"/>
      </filter>
      <mask id="${maskId}" maskUnits="userSpaceOnUse" x="-2000" y="-2000" width="8000" height="8000">
        <g class="mask-letters" fill="#fff"></g>
      </mask>
    </defs>
    <g class="gold-letters"></g>
    <g mask="url(#${maskId})"><g class="colour-dots" filter="url(#${blurId})"></g></g>
    <g class="shape-letters"></g>
    <g class="sparks"></g>`;
  source.after(svg);

  const gold = svg.querySelector(".gold-letters");
  const maskLetters = svg.querySelector(".mask-letters");
  const shapeLetters = svg.querySelector(".shape-letters");   // invisible: used to measure and place sparks

  let paragraphFinishedAt = 0;
  const linesBefore = linesSoFar;
  const linesHere = layOutLines(svg, source.textContent.trim(), (character, x, y, lineNumber) => {
    // When this letter starts being written, in seconds after the writing begins.
    const start = lettersSoFar * LETTER_GAP + (linesBefore + lineNumber) * LINE_PAUSE;
    lettersSoFar++;

    const goldLetter = makeLetter(character, x, y);            // traced, then filled (CSS "inkDraw")
    goldLetter.style.setProperty("--d", start.toFixed(3) + "s");
    goldLetter.style.setProperty("--draw", DRAW_TIME + "s");
    gold.appendChild(goldLetter);
    writingOrder.push({ letter: goldLetter, start });

    const maskLetter = makeLetter(character, x, y);            // lets the colours bloom in, near the end
    maskLetter.style.setProperty("--d2", (start + DRAW_TIME * 0.7).toFixed(3) + "s");
    maskLetters.appendChild(maskLetter);

    shapeLetters.appendChild(makeLetter(character, x, y));
    paragraphFinishedAt = start + DRAW_TIME + 0.8;
  });
  linesSoFar += linesHere;
  svg.style.setProperty("--done", paragraphFinishedAt.toFixed(2) + "s");   // when its sparks wake up

  const box = shapeLetters.getBBox();
  svg.setAttribute("viewBox", [
    box.x - ROOM_AROUND_SIDES, box.y - ROOM_ABOVE_AND_BELOW,
    box.width + ROOM_AROUND_SIDES * 2, box.height + ROOM_ABOVE_AND_BELOW * 2,
  ].map((n) => n.toFixed(1)).join(" "));

  const paragraph = { svg, dots: [], bounds: null, visible: false };
  addColourDots(paragraph, svg.querySelector(".colour-dots"), box);
  addSparks(svg.querySelector(".sparks"), shapeLetters, glowId);
  paragraphs.push(paragraph);
  return paragraph;
}

// Break the text into lines no wider than LINE_WIDTH and place each letter.
// Full lines are stretched to the exact width (extra space shared between the words);
// the paragraph's last line is centred.
function layOutLines(svg, text, placeLetter) {
  const ruler = make("text", { x: 0, y: 0, "font-size": FONT_SIZE, "font-weight": FONT_WEIGHT, "letter-spacing": LETTER_SPACING, fill: "none" });
  ruler.style.fontFamily = FONT;
  svg.appendChild(ruler);
  const widthOf = (words) => { ruler.textContent = words; return ruler.getComputedTextLength(); };

  const lines = [];
  let current = "";
  for (const word of text.split(/\s+/)) {
    const longer = current ? current + " " + word : word;
    if (current && widthOf(longer) > LINE_WIDTH) {
      lines.push(current);
      current = word;
    } else {
      current = longer;
    }
  }
  if (current) lines.push(current);

  lines.forEach((lineText, lineNumber) => {
    const naturalWidth = widthOf(lineText);
    const spaces = lineText.split(" ").length - 1;
    const isLastLine = lineNumber === lines.length - 1;
    const stretch = !isLastLine && spaces > 0 ? (LINE_WIDTH - naturalWidth) / spaces : 0;
    const centring = isLastLine || spaces === 0 ? (LINE_WIDTH - naturalWidth) / 2 : 0;
    let spacesSoFar = 0;
    for (let i = 0; i < lineText.length; i++) {
      const character = lineText[i];
      if (character === " ") { spacesSoFar++; continue; }
      const x = ruler.getStartPositionOfChar(i).x + centring + stretch * spacesSoFar;
      placeLetter(character, x, lineNumber * LINE_HEIGHT, lineNumber);
    }
  });
  ruler.remove();
  return lines.length;
}

// ---- The colour field ---------------------------------------------------------------------
function addColourDots(paragraph, group, box) {
  const padding = 60;
  const bounds = { x: box.x - padding, y: box.y - padding, w: box.width + padding * 2, h: box.height + padding * 2 };
  paragraph.bounds = bounds;

  const shownSize = paragraph.svg.getBoundingClientRect().width / (box.width + ROOM_AROUND_SIDES * 2);
  const count = dotsFor(bounds.w * bounds.h, shownSize || DECREE_SHOWN_SIZE);
  for (let i = 0; i < count; i++) {
    const x = bounds.x + Math.random() * bounds.w;
    const y = bounds.y + Math.random() * bounds.h;
    // The colour depends on where the dot starts, so colours sweep across the text like a rainbow.
    const across = (x - box.x) / box.width;
    const down = (y - box.y) / box.height;
    const hue = (across * RAINBOW_SPREAD + down * RAINBOW_SPREAD * 0.22 + (Math.random() - 0.5) * 26 + 720) % 360;
    const saturation = 82 + Math.random() * 15;
    const lightness = Math.max(8, Math.min(88, (55 + Math.random() * 12) * DOT_BRIGHTNESS));
    const radius = 16 + Math.random() * 26;

    const circle = make("circle", {
      cx: x.toFixed(1), cy: y.toFixed(1), r: (radius * DOT_SIZE).toFixed(1),
      fill: `hsl(${hue.toFixed(1)}, ${saturation.toFixed(1)}%, ${lightness.toFixed(1)}%)`,
      "fill-opacity": (0.55 + Math.random() * 0.28).toFixed(2),
    });
    group.appendChild(circle);
    paragraph.dots.push({ x, y, angle: Math.random() * Math.PI * 2, speed: 0.16 + Math.random() * 0.4, circle });
  }
}

// Each dot wanders: it keeps a heading that turns a tiny random amount each step.
// A dot leaving one side of the text comes back in on the other side.
// The dots drift slowly, so moving them 30 times a second looks the same as 60 and costs half.
let lastMove = 0;
function moveColourDots(now) {
  if (now - lastMove < 33) { requestAnimationFrame(moveColourDots); return; }
  const steps = lastMove ? Math.min((now - lastMove) / 16.667, 5) : 1;   // 1 step = one 60 Hz frame
  lastMove = now;
  for (const paragraph of paragraphs) {
    if (!paragraph.visible) continue;
    const b = paragraph.bounds;
    for (const dot of paragraph.dots) {
      dot.angle += (Math.random() - 0.5) * 0.02 * steps;
      dot.x += Math.cos(dot.angle) * dot.speed * DOT_SPEED * steps;
      dot.y += Math.sin(dot.angle) * dot.speed * DOT_SPEED * steps;
      if (dot.x < b.x) dot.x += b.w; else if (dot.x > b.x + b.w) dot.x -= b.w;
      if (dot.y < b.y) dot.y += b.h; else if (dot.y > b.y + b.h) dot.y -= b.h;
      dot.circle.setAttribute("cx", dot.x.toFixed(1));
      dot.circle.setAttribute("cy", dot.y.toFixed(1));
    }
  }
  requestAnimationFrame(moveColourDots);
}

// ---- Sparks ---------------------------------------------------------------------------------
// A four-pointed star shape with curved sides.
function starShape(r) {
  const k = r * 0.14;
  return `M0 ${-r} Q ${k} ${-k} ${r} 0 Q ${k} ${k} 0 ${r} Q ${-k} ${k} ${-r} 0 Q ${-k} ${-k} 0 ${-r} Z`;
}

// About 3 in 10 letters get a spark. It starts on a random edge of the letter and flies
// outward (away from the letter's middle), growing, twirling and fading. The CSS animation
// "sparkFlow" in letter_in_gold.css does the moving; here we only set where and how far.
function addSparks(group, letters, glowId) {
  for (const letter of letters.children) {
    if (Math.random() > 0.3) continue;
    const b = letter.getBBox();
    if (!b.width && !b.height) continue;

    const side = Math.floor(Math.random() * 4);
    const x = side === 1 ? b.x + b.width : side === 3 ? b.x : b.x + Math.random() * b.width;
    const y = side === 0 ? b.y : side === 2 ? b.y + b.height : b.y + Math.random() * b.height;
    let dx = x - (b.x + b.width / 2);
    let dy = y - (b.y + b.height / 2) - 6;
    const length = Math.hypot(dx, dy) || 1;
    const distance = 22 + Math.random() * 42;
    dx = (dx / length) * distance;
    dy = (dy / length) * distance;

    const holder = make("g", { transform: `translate(${x.toFixed(2)} ${y.toFixed(2)})` });
    const spark = make("g", { class: "spark" });
    const size = 2.4 + Math.random() * 1.9;
    spark.appendChild(make("circle", { r: (size * 2.9).toFixed(2), fill: `url(#${glowId})` }));
    spark.appendChild(make("path", { d: starShape(size), fill: "#fff8e2" }));
    spark.style.setProperty("--dx", dx.toFixed(2) + "px");
    spark.style.setProperty("--dy", dy.toFixed(2) + "px");
    spark.style.setProperty("--dur", (3.4 + Math.random() * 3.4).toFixed(2) + "s");
    spark.style.setProperty("--delay", (-Math.random() * 8).toFixed(2) + "s");
    holder.appendChild(spark);
    group.appendChild(holder);
  }
}

// ---- Writing the letter -------------------------------------------------------------------------
// Waits for the gothic font (up to 2.6 s, as decree.html does), then draws every paragraph.
export async function writeLetterInGold(scrollingArea) {
  if (alreadyWritten) return;
  alreadyWritten = true;
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load(`${FONT_WEIGHT} ${FONT_SIZE}px "Grenze Gotisch"`),
        document.fonts.load("500 16px Cinzel"),
        document.fonts.load('italic 300 24px "Cormorant Garamond"'),
      ]),
      new Promise((resolve) => setTimeout(resolve, 2600)),
    ]);
  } catch {
    // If the fonts can't load, the letter is still written in Georgia.
  }

  const sources = [...document.querySelectorAll(".letter-paragraph")];
  sources.forEach((source, index) => drawParagraph(source, index + 1));

  // Only move a paragraph's colours while it is visible in the scroll.
  const watcher = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const paragraph = paragraphs.find((p) => p.svg === entry.target);
      if (paragraph) paragraph.visible = entry.isIntersecting;
    }
  }, { root: scrollingArea });
  paragraphs.forEach((paragraph) => watcher.observe(paragraph.svg));

  // Everything is laid out at its final size before any letter shows, so nothing moves or grows.
  // Two frames later (so the browser has settled), the writing begins.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    paragraphs.forEach((paragraph) => paragraph.svg.classList.add("ready", "is-writing"));
    followTheWriting(scrollingArea);
  }));
  if (!motionIsReduced) requestAnimationFrame(moveColourDots);
}

// ---- The scroll follows the pen ------------------------------------------------------------------
// Twice a second, find the letter being written right now. If it's below the visible part of the
// scroll, glide down so it sits a little below the middle. As soon as the reader scrolls, clicks
// or presses a key in the scroll, we stop following and leave the scroll to them.
function followTheWriting(scrollingArea) {
  if (motionIsReduced) return;                                   // everything is written at once
  const startedAt = performance.now();
  let current = 0;
  let readerTookOver = false;
  for (const event of ["wheel", "touchstart", "pointerdown", "keydown"]) {
    scrollingArea.addEventListener(event, () => { readerTookOver = true; }, { passive: true });
  }

  const timer = setInterval(() => {
    const secondsWriting = (performance.now() - startedAt) / 1000;
    while (current < writingOrder.length - 1 && writingOrder[current + 1].start <= secondsWriting) current++;
    const finished = current >= writingOrder.length - 1;
    if (readerTookOver || finished) { clearInterval(timer); return; }

    const pen = writingOrder[current].letter.getBoundingClientRect();
    const view = scrollingArea.getBoundingClientRect();
    if (pen.bottom > view.bottom - view.height * 0.25) {
      scrollingArea.scrollTo({ top: scrollingArea.scrollTop + (pen.top - view.top) - view.height * 0.55, behavior: "smooth" });
    }
  }, 500);
}
