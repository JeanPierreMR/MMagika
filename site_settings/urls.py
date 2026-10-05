"""Which web address shows what."""
from django.urls import path

from chapters import views

urlpatterns = [
    path("", views.show_current_chapter),                     # sends you to the chapter you're up to
    path("vault", views.show_vault),                          # 1. the vault and its combination lock
    path("vault/open", views.try_vault_combination),          #    the dials send their combination here
    path("signal", views.show_signal),                        # 2. the mockingjay console, then the crash
    path("signal/done", views.finish_signal),
    path("terminal", views.show_terminal),                    # 3. the glitched terminal
    path("terminal/done", views.finish_terminal),
    path("letter", views.show_letter),                        # 4. the letter (the end)
    path("healthz", views.show_health_check),                 # Render asks this every few seconds: "are you alive?"
]
