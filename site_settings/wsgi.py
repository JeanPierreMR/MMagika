"""The entry point the server program (gunicorn) uses to start the site."""
import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "site_settings.settings")
application = get_wsgi_application()
