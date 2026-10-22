import os
import sys
from pathlib import Path

# Add backend directory to sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django
django.setup()

from django.core.management import call_command
from django.core.wsgi import get_wsgi_application

# Auto-migrate SQLite database in /tmp on Vercel Serverless cold start
if os.getenv("VERCEL"):
    db_path = Path("/tmp/db.sqlite3")
    if not db_path.exists():
        try:
            call_command("migrate", interactive=False)
            try:
                from routing.services.history_seeds import ensure_default_historical_trips
                ensure_default_historical_trips()
            except Exception:
                pass
        except Exception as err:
            print(f"Vercel auto-migration error: {err}")

# Expose WSGI application handler for Vercel
app = get_wsgi_application()
