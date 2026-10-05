"""
Django settings: how the site is wired together.

Everything about SECURITY (secret key, HTTPS, allowed web addresses, which
scripts the browser may run, request limits) lives in one separate file:
site_security/security_settings.py. This file only holds the ordinary wiring.
"""

from pathlib import Path

# The folder that contains manage.py. Other paths below are built from it.
PROJECT_FOLDER = Path(__file__).resolve().parent.parent

# Copy every security setting (DEBUG, SECRET_KEY, ALLOWED_HOSTS, SECURE_CSP, ...)
# from site_security/security_settings.py into these settings.
from site_security.security_settings import *  # noqa: E402,F403


# --- The pieces of Django we use --------------------------------------------
# There are no user accounts and no database, so we leave out everything Django
# normally adds for those.
INSTALLED_APPS = [
    # On your computer, let WhiteNoise hand out the files instead of Django's own test server.
    # WhiteNoise tells the browser to check for a newer copy every time, so after a change
    # you never get new HTML with an old, cached CSS or JavaScript file.
    "whitenoise.runserver_nostatic",
    "django.contrib.staticfiles",   # hands out pictures, styles and scripts
    "site_security",
    "chapters",
]

# Every request passes through these steps, top to bottom, before reaching the page.
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",               # HTTPS and security headers
    "site_security.limit_requests_per_visitor.LimitRequestsPerVisitor",  # slows down anyone sending too many requests
    "whitenoise.middleware.WhiteNoiseMiddleware",                  # answers requests for pictures, styles, scripts
    "django.contrib.sessions.middleware.SessionMiddleware",        # remembers how far the visitor has got
    "django.middleware.csrf.CsrfViewMiddleware",                   # refuses forged requests (see security_settings.py)
    "django.middleware.csp.ContentSecurityPolicyMiddleware",       # tells the browser which scripts it may run
    "site_security.permissions_policy.PermissionsPolicy",          # which pages may use the microphone
    "django.middleware.clickjacking.XFrameOptionsMiddleware",      # stops other sites putting this page inside theirs
    "django.middleware.common.CommonMiddleware",
]

ROOT_URLCONF = "site_settings.urls"
WSGI_APPLICATION = "site_settings.wsgi.application"
DATABASES = {}  # no database: progress lives in a signed cookie (see security_settings.py)


# --- Page templates ----------------------------------------------------------
# The story is told in chapters (vault, signal, terminal, letter), each a page of its own.
# Every chapter keeps its HTML, CSS and JavaScript together in one folder: chapters/<chapter>/.
# Django normally wants HTML in one place and CSS/JS in another; we point both lookups at the
# same chapter folders instead, so a chapter is never scattered.
CHAPTERS_FOLDER = PROJECT_FOLDER / "chapters"
CHAPTER_FOLDERS = ["shared", "vault", "signal", "terminal", "letter"]

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [CHAPTERS_FOLDER],                              # e.g. "vault/vault.html"
        "APP_DIRS": False,
        "OPTIONS": {
            "context_processors": [
                # Makes {{ csp_nonce }} available: a one-time code that marks
                # our own <script> and <style> tags as trusted (see security_settings.py).
                "django.template.context_processors.csp",
            ],
        },
    },
]


# --- Pictures, styles and scripts ("static files") ---------------------------
STATIC_URL = "/static/"
# Each chapter folder by name (so the Python files next to them are never handed out):
# chapters/vault/vault.js is /static/vault/vault.js, and so on.
STATICFILES_DIRS = [(name, CHAPTERS_FOLDER / name) for name in CHAPTER_FOLDERS]
# When building for the server, all files are copied here in one place.
# (The Dockerfile skips the .html files, so templates are never public.)
STATIC_ROOT = PROJECT_FOLDER / "collected_static"
STORAGES = {
    "staticfiles": {
        # Also saves compressed copies so files download faster.
        "BACKEND": "whitenoise.storage.CompressedStaticFilesStorage",
    },
}


# --- Language and time -------------------------------------------------------
LANGUAGE_CODE = "en"
TIME_ZONE = "UTC"
USE_TZ = True


# --- Logs (what shows up in Render's Logs tab) --------------------------------
# Everything is printed to the console; Render collects the console into its Logs tab.
# Without this, Django hides error details whenever DEBUG is off, so a crash on
# Render would only show "500" in the access log, with no clue why.
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "simple": {"format": "{levelname} {name}: {message}", "style": "{"},
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "simple"},
    },
    "root": {"handlers": ["console"], "level": "INFO"},
    "loggers": {
        # Crashes (500) with their full traceback, and refused requests (4xx) as warnings.
        "django": {"handlers": ["console"], "level": "WARNING", "propagate": False},
    },
}
