// HARMONY — how the choirs work out their notes, the way singers in a choir do.
//
// A choir doesn't sing fixed frequencies: every singer knows the KEY (a home note, the "tonic", and its
// scale), and each part sings the melody a fixed number of SCALE STEPS away. "Two steps up" is a third:
// sometimes a major third, sometimes a minor one, depending on where in the scale the melody is, so the
// harmony always stays in the key. Seven steps is an octave.
//
//   harmonize(pitch, steps, tonic)   the note `steps` scale steps from `pitch`, in the key of `tonic`
//       steps: +2 a third above, +4 a fifth above, -2 a third below, -5 a sixth below, -7 an octave below
//   chord(root, steps)               the notes a choir would stack on `root` (e.g. [0, 2, 4] = a triad)
//   fold(pitch, low, high)           the same note moved by octaves into a range (a voice's range)
//
// Used by bird_song.js (the birds answering the call) and synth_recipes.js (the low dark choir).

export const MINOR = [0, 2, 3, 5, 7, 8, 10];   // natural minor: semitones of each step above the tonic
export const MAJOR = [0, 2, 4, 5, 7, 9, 11];

// Which scale step a pitch is on (the nearest one), counted from the tonic, octaves included.
function stepOf(pitch, tonic, scale) {
  const fromTonic = 12 * Math.log2(pitch / tonic);
  const octave = Math.floor(fromTonic / 12);
  const within = fromTonic - octave * 12;
  let nearest = 0;
  scale.forEach((semitones, step) => {
    if (Math.abs(semitones - within) < Math.abs(scale[nearest] - within)) nearest = step;
  });
  if (Math.abs(12 - within) < Math.abs(scale[nearest] - within)) return (octave + 1) * scale.length;
  return octave * scale.length + nearest;
}

// The pitch of a scale step (octaves included), in the key of `tonic`.
function pitchOfStep(step, tonic, scale) {
  const octave = Math.floor(step / scale.length);
  const within = ((step % scale.length) + scale.length) % scale.length;
  return tonic * 2 ** ((octave * 12 + scale[within]) / 12);
}

export function harmonize(pitch, steps, tonic, scale = MINOR) {
  if (steps === 0) return pitch;                 // the melody itself, exactly as sung
  return pitchOfStep(stepOf(pitch, tonic, scale) + steps, tonic, scale);
}

export function chord(root, steps, scale = MINOR) {
  return steps.map((step) => pitchOfStep(step, root, scale));
}

export function fold(pitch, low, high) {
  let folded = pitch;
  while (folded < low) folded *= 2;
  while (folded >= high) folded /= 2;
  return folded;
}
