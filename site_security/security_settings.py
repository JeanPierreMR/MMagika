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
# The site sets no cookies today; if it ever does, they only travel over https.
SESSION_COOKIE_SECURE = RUNNING_IN_PRODUCTION
CSRF_COOKIE_SECURE = RUNNING_IN_PRODUCTION


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
    "font-src": [CSP.SELF],                 # the letter's fonts, stored on this site (magic_page/vendor/fonts)
    "connect-src": [CSP.SELF],
    "base-uri": [CSP.NONE],
    "form-action": [CSP.NONE],              # there are no forms
    "frame-ancestors": [CSP.NONE],          # same as X_FRAME_OPTIONS, for newer browsers
}


# --- How many requests one visitor may send ------------------------------------------
# Used by site_security/limit_requests_per_visitor.py. One page load asks for
# about 35 files (pictures, scripts, styles), so 600 a minute still lets a
# person reload the page more than 15 times a minute.
REQUESTS_ALLOWED_PER_VISITOR_PER_MINUTE = int(os.environ.get("REQUESTS_PER_VISITOR_PER_MINUTE", "600"))
