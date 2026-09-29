# MMagika

A sparse night sky of pulsing stars. Two pairs of glowing purple-green eyes appear now and then in the dark corners, with a faint glint of red fangs beneath. In the middle sits a black scroll with a soft purple glow, sealed with dark red wax stamped **MD** in gold. A golden winged ball flutters about, always keeping away from your mouse.

Move the mouse and sparkles follow it. **Hold the click** and you draw a glowing, glittering green line. Draw the right shape and something happens:

| Draw (holding the click) | What happens |
|---|---|
| **A cross** (a `+` or a `†`, as two lines or as a whole silhouette) or **a triangle** | **The healing spell.** The stars turn into coloured crosses. Memories of medicine flood the screen one after another, each shown once, oldest first (House M.D.-opening style), then settle into the background, smaller, drifting in and out. The seal cracks, the scroll unrolls, and the letter appears in glowing gothic gold with colours flowing through it and sparks flying off (the effect from `decree.html`). The golden ball stops fleeing and flies freely. |
| **A spiral** | A translucent swirling purple portal opens where you drew it. |
| **A zigzag** (or a lightning bolt) | The screen flashes and jolts. |

A violet **enchanted clock** (Mayan numerals, rings of runes, today's date, the real time) follows your mouse: its details stream after it like a ribbon, and its circles and triangles fade and redraw themselves wherever the mouse comes to rest (a click summons them at once). Space pauses its turning ornaments; Escape recentres it. A little pixel cat also chases your mouse around.

---

## Where to start reading

The code is organised around **what you see on the page**. Each visible part has one folder holding its HTML, CSS and JavaScript together.

1. **[magic_page/page.html](magic_page/page.html)** lists every part, from the back of the screen to the front.
2. **[magic_page/parts/spellbook/spellbook.js](magic_page/parts/spellbook/spellbook.js)** decides which drawing casts which spell.
3. **[magic_page/parts/healing_spell/healing_spell.js](magic_page/parts/healing_spell/healing_spell.js)** is the main story, step by step.

Each JavaScript file starts by answering: *What starts it? What does it use? What does it do? What changes?*

### The parts (`magic_page/parts/`)

| Folder | What it is |
|---|---|
| `whole_page/` | Colours (several purples) and basic layout shared by everything |
| `night_sky/` | The pulsing stars; later turns them into coloured crosses |
| `enchanted_clock/` | The violet clock that follows the mouse (ported from Arcane Hours, "teleport" version) |
| `watching_eyes/` | Dark corners, and two pairs of eyes that slowly appear, follow the mouse, blink lazily and vanish |
| `wand/` | Sparkles, plus the glittering green line while you hold the click (it stays until 1 second after you let go) |
| `spellbook/` | Reads what shape you drew (`shape_reader.js`) and casts the matching spell |
| `healing_spell/` | The main story, in order |
| `medical_history/` | The pictures: the flood of memories, then the quiet background (credits in `image_credits.md`) |
| `golden_winged_ball/` | The golden ball: shy of the mouse at first, free once the scroll opens |
| `scroll_and_wax_seal/` | The black scroll and melted-wax seal. **The letter's text is in `letter.html`**; `letter_in_gold.js` draws it in gold |
| `swirling_portal/`, `lightning_flash/` | The spiral and zigzag spells |
| `pixel_cat/` | Loads the borrowed pixel cat |

### Everything else

| Folder / file | What it is |
|---|---|
| `site_security/` | **All** the safety rules in one place: secret key, HTTPS, which scripts the browser may run, and the per-visitor request limit. `tests.py` checks them. |
| `site_settings/` | Django's wiring: which web address shows what, where files live |
| `magic_page/views.py` | The two things the site can show: the page, and `/healthz` ("I'm alive") for Render |
| `magic_page/vendor/` | Code borrowed from other people, unchanged, with licences ([README](magic_page/vendor/README.md)) |
| `Dockerfile`, `render.yaml` | How Render builds and runs the site |
| `docs/scaling.html` | How this could grow to 20 million users, Render vs AWS |

---

## Run it on your computer

```bash
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
DJANGO_DEBUG=1 python manage.py runserver     # open http://127.0.0.1:8000
python manage.py test                         # the automatic checks
```

Or run exactly what Render runs:

```bash
docker build -t mmagika .
docker run --rm -p 10000:10000 -e DJANGO_SECRET_KEY=anything-for-local-testing mmagika   # open http://localhost:10000
```

## Put it on Render

1. Push this repository to GitHub.
2. In Render: **New → Blueprint** and pick the repository. Render reads `render.yaml`, builds the `Dockerfile`, creates a secret key, and gives you an address like `mmagika.onrender.com`.
3. Using your own domain? Set `DJANGO_ALLOWED_HOSTS=yourdomain.com` in Render's environment settings.

**After the first deploy, check one thing.** The request limit (`site_security/limit_requests_per_visitor.py`) reads the visitor's address from the first entry in the `X-Forwarded-For` header. Render's docs don't spell out how Render sets that header. If every visitor turns out to share one address, the limit would apply to everyone together. Open the page from two different networks (for example Wi-Fi and phone data); if the second one gets "Too many requests" while the first is busy, adjust `find_visitor_ip_address` in that file.

**Want real flood protection?** Put the site behind your own free Cloudflare account and add one rate-limiting rule. The in-app limit is a backstop, not a shield.

## Browsers

Built for current Chrome, Firefox and Safari. Checked in Chrome and Firefox. Safari still needs a check on an Apple device, but the code avoids the features Safari is known to lack. People who turn on "reduce motion" get a calmer page: no sparkles, no pixel cat, no flying or shaking.
