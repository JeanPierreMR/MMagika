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
# There are no user accounts, no database and no forms, so we leave out
# everything Django normally adds for those.
INSTALLED_APPS = [
    "django.contrib.staticfiles",   # hands out pictures, styles and scripts
    "site_security",
    "magic_page",
]

# Every request passes through these steps, top to bottom, before reaching the page.
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",               # HTTPS and security headers
    "site_security.limit_requests_per_visitor.LimitRequestsPerVisitor",  # slows down anyone sending too many requests
    "whitenoise.middleware.WhiteNoiseMiddleware",                  # answers requests for pictures, styles, scripts
    "django.middleware.csp.ContentSecurityPolicyMiddleware",       # tells the browser which scripts it may run
    "django.middleware.clickjacking.XFrameOptionsMiddleware",      # stops other sites putting this page inside theirs
    "django.middleware.common.CommonMiddleware",
]

ROOT_URLCONF = "site_settings.urls"
WSGI_APPLICATION = "site_settings.wsgi.application"
DATABASES = {}  # no database: the page stores nothing


# --- Page templates ----------------------------------------------------------
# Each visible part of the page keeps its HTML, CSS and JavaScript together in
# one folder: magic_page/parts/<part name>/. Django normally wants HTML in one
# place and CSS/JS in another; we point both lookups at the same "parts" folder
# instead, so a part is never scattered.
PAGE_PARTS_FOLDER = PROJECT_FOLDER / "magic_page" / "parts"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [PROJECT_FOLDER / "magic_page", PAGE_PARTS_FOLDER],
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
STATICFILES_DIRS = [
    PAGE_PARTS_FOLDER,                                        # /static/night_sky/night_sky.js, ...
    ("vendor", PROJECT_FOLDER / "magic_page" / "vendor"),     # /static/vendor/pdollar.js, ...
]
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
