# pitchy (vendored)

Pitch detection by the McLeod Pitch Method, from https://github.com/ianprime0509/pitchy
(pitchy 4.1.0, MIT, see LICENSE-pitchy) and its helper fft.js 4.0.4 (MIT, see LICENSE-fft.js).
Copied here because the site only runs scripts from itself (no outside hosts, see site_security/).

Changed from the originals, only so they load in the browser without a build step:
- `pitchy.js`: imports `./fft.js` instead of the package name `fft.js`.
- `fft.js`: ends with `export default FFT` instead of `module.exports = FFT`.

Used by chapters/signal/listen_for_the_call.js (which one is used: PITCH_FINDER there).
To update: download the new versions from npm and repeat the two changes.
