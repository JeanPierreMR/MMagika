# Making the colour animation (colour_field.webp)

1. `python tools/colour_field/save_frames.py /some/empty/folder`
2. Open http://localhost:8002/render_frames.html in Chrome and wait until it says Done.
3. `ffmpeg -framerate 15 -i /some/empty/folder/frame_%04d.png -c:v libwebp_anim -lossless 0 -quality 60 -compression_level 3 -loop 0 tools/colour_field/colour_field.webp`

Settings (number of dots, loop length, softness) are at the top of `render_frames.html`.

The letter videos don't use the .webp: tools/letter_video paints the same colours directly with colour_field.js.
The .webp is kept here as a preview of the colours.
