// THE LETTER VIDEO PLAYER — the letter is played back from pre-rendered videos, so the browser
// does almost no drawing work at all.
//   - For each paragraph there are two videos, made by tools/letter_video/ from the real letter
//     (the gold lettering, the colours flowing inside it and the sparks):
//       write_N.mp4: the paragraph writing itself, played once, starting when its first word would;
//       loop_N.mp4:  the finished paragraph with the colours flowing and sparks flying, 36 s,
//                    looping seamlessly. It takes over the moment the writing video ends.
//   - The videos have a black background and are shown with "screen" blending, so the black
//     disappears into the paper and only the gold and colours show.
//   - letter_video/timing.json says each paragraph's size (so its room is kept from the start),
//     when its video starts, and where its lines are (so the scroll can follow the writing).
//   - After editing letter.html or the settings, render again: see tools/letter_video/README.md.
//   - The videos start loading as soon as the page opens, and the page's intro (the blue outline)
//     waits until they've arrived (letterHasArrived), so the writing never stops to load.

const VIDEOS = new URL("./letter_video/", import.meta.url).href;
const motionIsReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const paragraphs = [];
const writingOrder = [];             // every line with the second it starts being written
let alreadyWritten = false;

// How much of the letter has arrived: videos that can play through, out of all of them.
let videosMade = 0;
let videosArrived = 0;
const arrivals = [];                 // one promise per video: it can play through (or can't be loaded at all)

function makeVideo(file, loops, version) {
  const video = document.createElement("video");
  video.src = VIDEOS + file + version;
  video.muted = true;                // muted videos may play by themselves
  video.playsInline = true;
  video.preload = "auto";
  video.loop = loops;
  video.setAttribute("aria-hidden", "true");
  videosMade++;
  arrivals.push(new Promise((resolve) => {
    const arrived = () => { videosArrived++; resolve(); };
    video.addEventListener("canplaythrough", arrived, { once: true });
    video.addEventListener("error", arrived, { once: true });     // a broken one mustn't hold the page up
  }));
  return video;
}

// Resolves once every video of the letter can play through without stopping, or after longestWait
// milliseconds at the latest (a very slow connection, or a browser that won't load videos ahead,
// must never hold the page up for good). The letter chapter's intro waits for this (letter.js).
export async function letterHasArrived(longestWait) {
  const tooLong = new Promise((resolve) => setTimeout(resolve, longestWait));
  await Promise.race([prepareLetter().then(() => Promise.all(arrivals)).catch(() => {}), tooLong]);
}

// From 0 to 1: how much of the letter has arrived so far.
export function shareOfLetterArrived() {
  return videosMade ? videosArrived / videosMade : 0;
}

// ---- Building (really just placing the videos, at their final size) -------------------------------
let preparing = null;
export function prepareLetter(scrollingArea) {
  if (!preparing) preparing = placeVideos();
  return preparing;
}

async function placeVideos() {
  const answer = await fetch(VIDEOS + "timing.json");
  const timing = await answer.json();
  // The videos are kept by the browser for a long time (see the cache settings in settings.py). timing.json
  // is rewritten with every render, so its fingerprint goes on the end of each video's address: after
  // a new render the addresses change and the browser fetches the new videos instead of its old copies.
  const fingerprint = answer.headers.get("etag") || answer.headers.get("last-modified") || "";
  const version = fingerprint ? `?v=${encodeURIComponent(fingerprint.replace(/[^\w.-]/g, ""))}` : "";
  const sources = [...document.querySelectorAll(".letter-paragraph")];
  sources.forEach((source, index) => {
    source.textContent = source.textContent.replace(/\[[^\]]*\]/g, "");   // screen readers skip the [pausa] marks
    const info = timing.paragraphs[index];
    if (!info) return;
    const holder = document.createElement("div");
    holder.className = "paragraph-holder";
    holder.style.aspectRatio = `${info.width} / ${info.height}`;   // its room, before anything loads
    const writing = makeVideo(info.write, false, version);
    const looping = makeVideo(info.loop, true, version);
    looping.classList.add("waiting");
    holder.append(writing, looping);
    source.after(holder);
    const paragraph = { holder, writing, looping, info };
    paragraphs.push(paragraph);
    for (const line of info.lines) {
      writingOrder.push({ start: line.start, letter: { getBoundingClientRect: () => whereIsLine(paragraph, line) } });
    }
  });
  writingOrder.sort((a, b) => a.start - b.start);
}

function whereIsLine(paragraph, line) {
  const shown = paragraph.holder.getBoundingClientRect();
  const top = shown.top + (line.y / paragraph.info.height) * shown.height;
  return { top, bottom: top + shown.height * (60 / paragraph.info.height) };
}

// When the writing video ends, the loop takes over. Its first frame continues exactly where the
// writing ended, so the switch can't be seen.
function switchToLoop(paragraph) {
  paragraph.looping.classList.remove("waiting");
  paragraph.looping.play().catch(() => {});
  paragraph.writing.classList.add("waiting");
}

export async function writeLetterInGold(scrollingArea) {
  if (alreadyWritten) return;
  alreadyWritten = true;
  await prepareLetter(scrollingArea);
  for (const paragraph of paragraphs) {
    paragraph.holder.classList.add("ready");
    if (motionIsReduced) { switchToLoop(paragraph); paragraph.looping.pause(); continue; }
    paragraph.writing.addEventListener("ended", () => switchToLoop(paragraph), { once: true });
    paragraph.writing.addEventListener("error", () => switchToLoop(paragraph), { once: true });   // it broke midway: show it written
    setTimeout(() => paragraph.writing.play().catch(() => switchToLoop(paragraph)), paragraph.info.start * 1000);
  }
  followTheWriting(scrollingArea);
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
