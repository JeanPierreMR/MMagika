# Pre-rendering the letter as videos (for the letter chapter)

Makes `chapters/letter/scroll_and_wax_seal/letter_video/`: for each paragraph a video of it
writing itself and a 36-second seamless loop of it finished, plus `timing.json`.
It reads the real `letter.html`, the fonts, and the settings (see below),
so **render again after editing the letter or the settings**.

## Rendering: one command

    python3 tools/letter_video/save_videos.py render

It needs ffmpeg, and Firefox or Chrome. It opens the render page in a browser without a window,
prints its progress and each video as it's finished, and says "Done" at the end. Then hard-refresh
/letter. The new videos are made in `letter_video_new/` and only replace the old ones once all of
them are finished, so if it fails or you stop it (Ctrl+C), the site keeps the videos it had.

How long it takes depends on the letter's length and the writing speed: at 0.3 s per letter the
whole letter takes about 9 minutes to write, and rendering it takes roughly three times that.

## The letter's text and pauses

The text is in `chapters/letter/scroll_and_wax_seal/letter.html`: one `<p class="letter-paragraph">`
per paragraph (one video each), one line per line. Where the pen should stop, write:

| Mark | Pause | Setting (in the tuner, "Writing speed") |
|---|---|---|
| `[pausa]` | short | `pause` (default 1.5 s) |
| `[pausa larga]` | long | `longPause` (default 3 s) |
| `[silencio]` | longest | `silence` (default 5 s) |

The marks are never drawn. A pause at the end of a paragraph holds back the next one.

## Tuning the animation

    python3 tools/letter_video/save_videos.py

then open http://localhost:8003/tools/letter_video/tuner.html

Move the sliders and watch the preview: pick a paragraph, drag the timeline or press Play.
It's painted by the same code as the videos (`letter_painter.js`), so it's what you'll get.
"Save for the render" writes `settings.json` here; only the settings you changed are saved.
The defaults are at the top of `letter_painter.js`. To go back, press
"Back to defaults" and save, or delete `settings.json`. Stop it with Ctrl+C, then render.

## Rendering by hand (if the command can't find a browser)

With the helper running (the command just above), open
http://localhost:8003/tools/letter_video/render_letter.html and keep that tab in front until it says
Done (a hidden tab is slowed right down). This writes straight over the old videos.
