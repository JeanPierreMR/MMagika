// CHAPTER 4 — THE LETTER
//
// What starts it:  the page loading.
// What it does:    plays the intro (the scroll's outline in blue, in black: blueprint_intro/), then
//                  waits for the future frame to draw itself in (see future_frame.css), then opens
//                  the scroll (the seal bursts, the sheet unrolls and the letter writes itself)
//                  and lets the connection start failing now and then (connection_glitches.js).
// Sounds:          the angels' choir fades in with the page, a shimmer as the seal bursts
//                  ("letter.*" in shared/sound_orchestra/sound_book.js).
// What changes:    only what's on screen. This is the last chapter.

import { cue } from "../shared/sound_orchestra/orchestra.js";
import { playBlueprintIntro } from "./blueprint_intro/blueprint_intro.js";
import { startConnectionGlitches } from "./connection_glitches.js";
import { openScrollAndShowLetter } from "./scroll_and_wax_seal/scroll_and_wax_seal.js";

const FRAME_DRAWING_TIME = 2200;   // milliseconds; matches the frame's animation in future_frame.css

await playBlueprintIntro();
cue("letter.choir");                              // angels, fading in slowly
document.body.classList.add("is-started");        // the frame starts drawing itself in (future_frame.css)
setTimeout(() => {
  openScrollAndShowLetter();
  cue("letter.seal", { delay: 0.85 });            // as the seal bursts (after its glow; scroll_and_wax_seal.js)
  startConnectionGlitches();
}, FRAME_DRAWING_TIME);
