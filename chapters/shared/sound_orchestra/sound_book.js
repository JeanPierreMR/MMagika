// THE SOUND BOOK — every sound and song in the experience, in one place. THIS is the file to edit.
//
// Each entry is one "cue", by name. The chapters only ever say cue("its name"); what it sounds like,
// how loud, and how it fades are decided here.
//
//   kind      "bed"  a sound that keeps going (ambience, music) until it's stopped, with fades;
//             "once" a one-off sound;
//             "voice" the mockingjay (sung by chapters/signal/bird_song.js; only its volume is here).
//   where     when it plays (a note for you; the code doesn't read it).
//   file      a real recording in sound_orchestra/audio/, e.g. "audio/forest.ogg". While it's null,
//             the synthesized placeholder named in "synth" is used instead (synth_recipes.js).
//             Use CC0 / public-domain files, and note where each came from in audio/README.md.
//   synth     the placeholder recipe in synth_recipes.js.
//   volume    0 to 1.
//   fadeIn, fadeOut   seconds (beds).
//   loop      whether a file loops (beds always loop).
//   options   extra settings passed to the recipe.
//
// To try changes without walking through the story, use the sound lab (tools/sound_lab/).

export const MASTER_VOLUME = 0.9;      // everything at once

export const SOUND_BOOK = {
  // ---- 1. The vault --------------------------------------------------------------------------
  "vault.room": {
    kind: "bed", where: "/vault, from the start (or the first touch, if the browser waits for one)",
    file: null,             // e.g. "audio/vault_room.ogg": wind, an empty concrete room
    synth: "roomBed", volume: 0.25, fadeIn: 4, fadeOut: 2.5, loop: true,
  },
  "vault.tick": {
    kind: "once", where: "a dial clicks into place",
    file: null, synth: "tick", volume: 0.7,
  },
  "vault.wrong": {
    kind: "once", where: "a wrong combination",
    file: null, synth: "clank", volume: 0.7,
  },
  "vault.open": {
    kind: "once", where: "the right combination: bolts, a deep swell, the light's shimmer, fading into white",
    file: null,             // e.g. "audio/vault_open.ogg": a heavy door and a rising swell (~5 s)
    synth: "vaultOpen", volume: 0.9,
  },

  // ---- 2. The signal -------------------------------------------------------------------------
  "signal.forest": {
    kind: "bed", where: "/signal, once the microphone is on; it fades out with the page going dark",
    file: null,             // e.g. "audio/forest.ogg": a forest at dawn, distant birds
    synth: "forestBed", volume: 0.5, fadeIn: 4, fadeOut: 2, loop: true,
  },
  "signal.bird": {
    kind: "voice", where: "the mockingjay: singing the call, and mirroring the visitor (bird_song.js)",
    volume: 0.22,
  },
  "signal.not_quite": {
    kind: "once", where: "after the bird mirrors 4 notes that aren't the call: a soft, falling breath",
    file: null, synth: "notQuite", volume: 0.8,
  },

  // ---- 3. The terminal -----------------------------------------------------------------------
  "terminal.panic": {
    kind: "bed", where: "the kernel panic, until the screen tears",
    file: null, synth: "panicHum", volume: 0.25, fadeIn: 0.3, fadeOut: 0.5, loop: true,
  },
  "terminal.static": {
    kind: "once", where: "glitches and the crash (how long: given by the terminal)",
    file: null, synth: "staticCrackle", volume: 1,
  },
  "terminal.keys": {
    kind: "once", where: "the terminal typing",
    file: null, synth: "keystroke", volume: 1,
  },
  "terminal.welcome": {
    kind: "once", where: "\"Welcome Doctor\" appears",
    file: null, synth: "welcomeChime", volume: 0.8,
  },

  // ---- 4. The letter -------------------------------------------------------------------------
  "letter.choir": {
    kind: "bed", where: "/letter, as the page fades in from black, to the end",
    file: null,             // e.g. "audio/choir.ogg": angels singing, a soft choir or ethereal pad
    synth: "choirBed", volume: 0.55, fadeIn: 6, fadeOut: 4, loop: true,
  },
  "letter.seal": {
    kind: "once", where: "the wax seal bursts",
    file: null, synth: "sealShimmer", volume: 0.7,
  },
  "letter.glitch": {
    kind: "once", where: "the connection fails for a moment (the choir also dips)",
    file: null, synth: "staticCrackle", volume: 0.5, options: { duration: 0.12 },
  },
};
