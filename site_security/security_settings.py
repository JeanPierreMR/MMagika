"""
SECURITY SETTINGS — everything that keeps the site safe, in one place.

site_settings/settings.py copies all of these in. Each setting says, in plain
words, what it protects against.

Two situations:
  - "production": the real site on Render (or any server with DJANGO_PRODUCTION=1).
  - "your computer": local development, with DJANGO_DEBUG=1.
"""

import os

from django.core.exceptions import ImproperlyConfigured
from django.utils.csp import CSP

# Render always sets RENDER=true on its servers. The Dockerfile sets DJANGO_PRODUCTION=1.
RUNNING_ON_RENDER = os.environ.get("RENDER") == "true"
RUNNING_IN_PRODUCTION = RUNNING_ON_RENDER or os.environ.get("DJANGO_PRODUCTION") == "1"


# --- Debug mode ---------------------------------------------------------------
# Debug mode shows detailed error pages with the site's internals.
# Useful on your computer, dangerous in public, so it is OFF unless asked for.
DEBUG = os.environ.get("DJANGO_DEBUG") == "1" and not RUNNING_IN_PRODUCTION


# --- The secret key -------------------------------------------------------------
def read_secret_key(environment):
    """Return the site's secret key.

    Django uses it to sign things so they can't be forged. In production it
    must come from the DJANGO_SECRET_KEY environment variable (Render generates
    one, see render.yaml). If it is missing in production, the site refuses to
    start instead of running with a guessable key.
    """
    secret_key = environment.get("DJANGO_SECRET_KEY", "")
    if secret_key:
        return secret_key
    in_production = environment.get("RENDER") == "true" or environment.get("DJANGO_PRODUCTION") == "1"
    if in_production:
        raise ImproperlyConfigured("DJANGO_SECRET_KEY must be set in production.")
    return "only-for-your-computer-never-use-in-production"


SECRET_KEY = read_secret_key(os.environ)


# --- Which web addresses this site answers to ----------------------------------
# Requests for any other address are refused, which blocks some trickery with
# fake "Host" headers.
ALLOWED_HOSTS = ["localhost", "127.0.0.1"]
if os.environ.get("RENDER_EXTERNAL_HOSTNAME"):          # e.g. mmagika.onrender.com, set by Render
    ALLOWED_HOSTS.append(os.environ["RENDER_EXTERNAL_HOSTNAME"])
# Your own domain(s), comma separated, e.g. DJANGO_ALLOWED_HOSTS=mmagika.com,www.mmagika.com
ALLOWED_HOSTS += [host.strip() for host in os.environ.get("DJANGO_ALLOWED_HOSTS", "").split(",") if host.strip()]


# --- HTTPS (the padlock) ----------------------------------------------------------
# Render handles HTTPS and passes requests on to us with a header saying
# "this arrived over HTTPS". This tells Django to believe that header.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
# On Render: send plain-http visitors to https, and tell browsers to always use
# https for a year (HSTS). On your computer there is no https, so we don't.
SECURE_SSL_REDIRECT = RUNNING_ON_RENDER
SECURE_REDIRECT_EXEMPT = [r"^healthz$"]   # Render's own health check may arrive over plain http
SECURE_HSTS_SECONDS = 31_536_000 if RUNNING_ON_RENDER else 0
# Cookies only travel over https in production.
SESSION_COOKIE_SECURE = RUNNING_IN_PRODUCTION
CSRF_COOKIE_SECURE = RUNNING_IN_PRODUCTION


# --- Remembering how far a visitor has got (the "session") ---------------------------
# The story has chapters (vault, signal, terminal, letter); the site remembers which ones a
# visitor has finished, so nobody can jump straight to the end. There is no database: the
# progress is kept in a cookie in the visitor's own browser, SIGNED with the secret key, so it
# can be read but not forged (changing it makes the signature wrong and it's thrown away).
SESSION_ENGINE = "django.contrib.sessions.backends.signed_cookies"
SESSION_COOKIE_HTTPONLY = True              # page scripts can't read it
SESSION_COOKIE_SAMESITE = "Lax"             # other sites can't send it along with their requests
SESSION_COOKIE_AGE = 60 * 60 * 24 * 30      # remembered for 30 days


# --- Protection against forged requests (CSRF) --------------------------------------------
# Opening the vault sends the combination to the site. Another website could try to make a
# visitor's browser send that request on their behalf; a secret token that only our own
# pages know (it travels in a header, see chapters/vault/vault.js) stops that.
CSRF_COOKIE_HTTPONLY = True
CSRF_COOKIE_SAMESITE = "Lax"


# --- The vault's combination -----------------------------------------------------------------
def read_vault_combination(environment):
    """Return the combination that opens the vault.

    It is only ever checked on the server (chapters/views.py), so it never appears in the page.
    In production it must come from the VAULT_COMBINATION environment variable (set it in
    Render's dashboard); on your computer a default is used.
    """
    combination = environment.get("VAULT_COMBINATION", "").strip().upper()
    if combination:
        return combination
    in_production = environment.get("RENDER") == "true" or environment.get("DJANGO_PRODUCTION") == "1"
    if in_production:
        raise ImproperlyConfigured("VAULT_COMBINATION must be set in production.")
    return "12MD20262020"


VAULT_COMBINATION = read_vault_combination(os.environ)
# Wrong guesses allowed per visitor per minute, before "the lock is jammed".
VAULT_GUESSES_ALLOWED_PER_VISITOR_PER_MINUTE = int(os.environ.get("VAULT_GUESSES_PER_MINUTE", "10"))


# --- Which pages may use the microphone ----------------------------------------------------
# Used by site_security/permissions_policy.py. Only the signal chapter listens (for the
# mockingjay's call); every other page is told the microphone, camera and location are off.
# The sound is analysed in the visitor's browser and never recorded or sent anywhere.
MICROPHONE_ALLOWED_ON = ["/signal"]


# --- Headers that tell the browser to be careful -------------------------------------
SECURE_CONTENT_TYPE_NOSNIFF = True          # don't guess file types (stops disguised scripts)
SECURE_REFERRER_POLICY = "same-origin"      # don't tell other sites which page a visitor came from
SECURE_CROSS_ORIGIN_OPENER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"                    # other sites may not show this page inside a frame


# --- Content Security Policy: which scripts, styles and images the browser may load ---
# Only files from this site itself are allowed. Our own <script>/<style> tags
# also carry a one-time code (the "nonce"), so a script someone manages to sneak
# into the page without that code will not run.
SECURE_CSP = {
    "default-src": [CSP.NONE],              # anything not listed below: blocked
    "script-src": [CSP.SELF, CSP.NONCE],
    "style-src": [CSP.SELF, CSP.NONCE],
    "img-src": [CSP.SELF, "data:"],         # "data:" = tiny images written inside the page itself
    "media-src": [CSP.SELF],                # videos, only from this site (the pre-rendered letter)
    "font-src": [CSP.SELF],                 # the fonts, stored on this site (chapters/shared/fonts)
    "connect-src": [CSP.SELF],
    "base-uri": [CSP.NONE],
    "form-action": [CSP.SELF],              # the vault's form may only be sent to this site
    "frame-ancestors": [CSP.NONE],          # same as X_FRAME_OPTIONS, for newer browsers
}


# --- How many requests one visitor may send ------------------------------------------
# Used by site_security/limit_requests_per_visitor.py. One page load asks for
# about 35 files (pictures, scripts, styles), so 600 a minute still lets a
# person reload the page more than 15 times a minute.
REQUESTS_ALLOWED_PER_VISITOR_PER_MINUTE = int(os.environ.get("REQUESTS_PER_VISITOR_PER_MINUTE", "600"))
