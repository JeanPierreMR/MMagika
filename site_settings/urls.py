"""Which web address shows what. The site has only two addresses."""
from django.urls import path

from magic_page.views import show_health_check, show_magic_page

urlpatterns = [
    path("", show_magic_page),               # the magic page itself
    path("healthz", show_health_check),      # Render asks this every few seconds: "are you alive?"
]
