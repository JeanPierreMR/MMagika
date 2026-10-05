"""
Tells the browser which powerful features (microphone, camera, location) each page may use.

What starts it:   every request passes through it (see MIDDLEWARE in settings.py).
What it uses:     MICROPHONE_ALLOWED_ON in security_settings.py.
What it does:     adds a "Permissions-Policy" header to every answer. The pages listed in
                  MICROPHONE_ALLOWED_ON may ask for the microphone; everything else may not,
                  and no page may use the camera or the visitor's location.
What changes:     nothing is stored.
"""

from django.conf import settings


class PermissionsPolicy:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        may_listen = any(request.path.startswith(page) for page in settings.MICROPHONE_ALLOWED_ON)
        microphone = "(self)" if may_listen else "()"
        response["Permissions-Policy"] = f"microphone={microphone}, camera=(), geolocation=()"
        return response
