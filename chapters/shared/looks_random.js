// LOOKS RANDOM, BUT ISN'T — numbers that seem random yet come out the same every time.
//
// What it's for:  dust, stars, glitches... anything that should feel natural but look exactly
//                 the same on every visit (so the page is predictable and easy to check).
// How to use it:  const random = makeRandom(42);  then  random()  gives a number from 0 to 1.
//                 Two makers with the same starting number give the same numbers in the same order.

export function makeRandom(startingNumber) {
  let seed = startingNumber | 0;
  return function random() {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Pick one item from a list, using the given random() maker.
export function pickOneOf(list, random) {
  return list[Math.floor(random() * list.length)];
}
