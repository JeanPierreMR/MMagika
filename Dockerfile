# How to build the box ("container") the site runs in on Render.
# Each line is one step, run in order when Render builds the site.

# Start from a small Linux with Python 3.14 already installed.
FROM python:3.14-slim

# Python: don't write cache files, print logs straight away.
# DJANGO_PRODUCTION=1 switches on the strict production settings (see site_security/security_settings.py).
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_PRODUCTION=1

WORKDIR /app

# Install the Python packages first. Docker remembers this step, so it only
# repeats it when requirements.txt changes, which makes rebuilds quick.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the site's code in.
COPY . .

# Gather every picture, style and script into one folder for serving.
# The .html files are left out so the page templates are never public.
# (A throwaway secret key is enough for this step; the real one is only given when the site runs.)
RUN DJANGO_SECRET_KEY=only-used-while-building python manage.py collectstatic --noinput --ignore "*.html"

# Don't run as the all-powerful "root" user: if something went wrong, it can do less damage.
RUN useradd --create-home magician
USER magician

# Start the site. Render tells us which port to listen on in $PORT (10000 by default).
# 2 workers × 4 threads = up to 8 requests handled at the same time.
EXPOSE 10000
CMD ["sh", "-c", "exec gunicorn site_settings.wsgi --bind 0.0.0.0:${PORT:-10000} --workers 2 --threads 4 --timeout 30 --access-logfile -"]
