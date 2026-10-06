// SOUNDS — the short names chapters have always used for their sounds.
//
// The sounds themselves now live in the sound orchestra (shared/sound_orchestra/): to change how
// any of them sounds, how loud it is, or to swap in a real recording, edit sound_book.js there.
// These are just shortcuts, so the chapters didn't have to change.

import { cue, soundSystem } from "./sound_orchestra/orchestra.js";

export { soundSystem };

export const playTick = () => cue("vault.tick");                 // a dial clicking into place
export const playClank = () => cue("vault.wrong");               // a wrong combination
export const playVaultOpening = () => cue("vault.open");         // the vault opens
export const playStatic = (duration = 0.25) => cue("terminal.static", { duration });   // a crackle of static
export const playKeystroke = () => cue("terminal.keys");         // the terminal typing
