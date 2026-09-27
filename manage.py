#!/usr/bin/env python
"""Django's command-line tool for this project.

Common commands:
    python manage.py runserver   start the site on your computer (set DJANGO_DEBUG=1 first)
    python manage.py test        run the automatic checks
"""
import os
import sys

if __name__ == "__main__":
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "site_settings.settings")
    from django.core.management import execute_from_command_line

    execute_from_command_line(sys.argv)
