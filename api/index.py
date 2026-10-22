import os
import sys
from pathlib import Path

# Locate root and backend directory
ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT_DIR / "backend"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

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

# Expose WSGI application handler for Vercel Python runtime
app = get_wsgi_application()
