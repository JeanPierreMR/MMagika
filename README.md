# MMagika

A night sky full of pulsing stars. Glowing purple-green eyes watch you from the dark corners, with a faint glint of red fangs beneath. In the middle sits a scroll sealed with dark red wax, stamped **MD** in gold.

Move the mouse and sparkles follow it. **Hold the click** and you draw a glowing red line. Draw the right shape and something happens:

| Draw (holding the click) | What happens |
|---|---|
| **A cross** (two lines) or its outline, or **a triangle** | **The healing spell.** The background becomes a slideshow of medical history, oldest first (House M.D.-opening style). A golden winged ball starts flying around. The stars turn into coloured crosses. The seal cracks, the scroll unrolls, and it reads **"Live with all your heart"** in glowing, colour-changing letters, with hearts glittering out of the word *heart*. |
| **A spiral** | A swirling purple portal opens where you drew it. |
| **A zigzag** (or a lightning bolt) | The screen flashes and jolts. |

A little pixel cat also chases your mouse around.

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
| `watching_eyes/` | Dark corners, and eyes that appear, follow the mouse, blink and vanish |
| `wand/` | Sparkles, plus the red line while you hold the click (it stays until 1 second after you let go) |
| `spellbook/` | Reads what shape you drew (`shape_reader.js`) and casts the matching spell |
| `healing_spell/` | The main story, in order |
| `medical_history/` | The slideshow pictures, with `image_credits.md` |
| `golden_winged_ball/` | The flying golden ball |
| `scroll_and_wax_seal/` | The scroll, the melted-wax seal, the glowing message and the hearts |
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
