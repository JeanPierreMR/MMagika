// THE LETTER IN GOLD — the lettering effect from decree.html.
//
// What starts it:  the scroll calls prepareLetter() soon after the page loads (builds it, invisible)
//                  and writeLetterInGold() once it has fully opened (starts the writing).
// What it uses:    the paragraphs in letter.html (class "letter-paragraph").
// What it does:    for each paragraph, builds a drawing (SVG) with three layers:
//   1. GOLD: every letter in bold gothic gold.
//   2. COLOUR: soft blurred dots of rainbow colour drifting slowly, visible only
//      inside the letters (a "mask" cuts them to the letter shapes). The drifting dots are a
//      ready-made looping animation (colour_field.webp, 36 seconds), so the browser only plays
//      it back instead of computing and blurring hundreds of dots. It's made with
//      tools/colour_field/ from the same settings decree.html uses.
//   3. SPARKS: little four-pointed stars that fly off about a third of the letters.
//   Lines are justified like a printed page; the last line of a paragraph is centred.
//   Then the letter WRITES ITSELF, as in decree.html: letter by letter, line by line, each
//   letter's gold outline is traced like ink, then filled, then the colours bloom inside it.
//   A paragraph's sparks wake up once it is finished. The scroll follows the writing down,
//   until the reader scrolls by themselves.
// What changes:    only what's on screen. The original paragraph stays (invisible) for screen readers.

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

// The colour animation: one tile, 1160 × 520 drawing units, that wraps top to bottom, so tiles
// can be stacked under a paragraph of any length. Its sides line up with the text's.
const COLOUR_FIELD = new URL("./colour_field.webp", import.meta.url).href;
const COLOUR_TILE_WIDTH = 1160;
const COLOUR_TILE_HEIGHT = 520;
const COLOUR_ROOM = 60;              // how far the colours reach beyond the text

const motionIsReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const paragraphs = [];               // every drawn paragraph
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
  const glowId = `spark-glow-${number}`;
  svg.innerHTML = `
    <defs>
      <radialGradient id="${glowId}">
        <stop offset="0%" stop-color="#fff4c8" stop-opacity="0.9"/>
        <stop offset="55%" stop-color="#ffd98a" stop-opacity="0.22"/>
        <stop offset="100%" stop-color="#ffd98a" stop-opacity="0"/>
      </radialGradient>
      <mask id="${maskId}" maskUnits="userSpaceOnUse" x="-2000" y="-2000" width="8000" height="8000">
        <g class="mask-letters" fill="#fff"></g>
      </mask>
    </defs>
    <g class="gold-letters"></g>
    <g mask="url(#${maskId})"><g class="colour-field"></g></g>
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

  const paragraph = { svg };
  addColourField(svg.querySelector(".colour-field"), box);
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
// Stack copies of the colour animation under the paragraph, from a little above the text to a
// little below. All copies are the same picture, so the browser decodes it only once.
function addColourField(group, box) {
  const left = box.x + box.width / 2 - COLOUR_TILE_WIDTH / 2;
  const bottom = box.y + box.height + COLOUR_ROOM;
  for (let top = box.y - COLOUR_ROOM; top < bottom; top += COLOUR_TILE_HEIGHT) {
    group.appendChild(make("image", {
      href: COLOUR_FIELD,
      x: left.toFixed(1), y: top.toFixed(1),
      width: COLOUR_TILE_WIDTH, height: COLOUR_TILE_HEIGHT + 0.5,   // a hair of overlap: no seam
      preserveAspectRatio: "none",
    }));
  }
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
// Two steps, so the writing never pushes anything around:
//   1. prepareLetter(): soon after the page loads, while the scroll is still rolled up, every
//      paragraph is built at its final size, invisible. The letter already takes its full room.
//   2. writeLetterInGold(): once the scroll is fully open, the letters start writing themselves.
let preparing = null;
export function prepareLetter(scrollingArea) {
  if (!preparing) preparing = buildEveryParagraph(scrollingArea);
  return preparing;
}

async function buildEveryParagraph(scrollingArea) {
  // Wait for the gothic font (up to 2.6 s, as decree.html does); without it the letters would be
  // measured in the wrong font. If it can't load, the letter is still written in Georgia.
  const fonts = Promise.all([
    document.fonts.load(`${FONT_WEIGHT} ${FONT_SIZE}px "Grenze Gotisch"`),
    document.fonts.load("500 16px Cinzel"),
    document.fonts.load('italic 300 24px "Cormorant Garamond"'),
  ]).catch(() => {});
  await Promise.race([fonts, new Promise((resolve) => setTimeout(resolve, 2600))]);

  const sources = [...document.querySelectorAll(".letter-paragraph")];
  sources.forEach((source, index) => drawParagraph(source, index + 1));
}

export async function writeLetterInGold(scrollingArea) {
  if (alreadyWritten) return;
  alreadyWritten = true;
  await prepareLetter(scrollingArea);
  // Two frames later (so the browser has settled), the writing begins.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    paragraphs.forEach((paragraph) => paragraph.svg.classList.add("ready", "is-writing"));
    followTheWriting(scrollingArea);
  }));
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
