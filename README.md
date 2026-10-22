# Spotter — Weather-Aware Truck Routing
![Spotter Banner](C:\Users\welco\OneDrive\Desktop\Spotter\frontend\src\assets\image.png)

Spotter is a full-stack web application that helps dispatchers evaluate truck routes using weather forecasts, cargo weight, checkpoint-level risk analysis, and route travel time. It generates route alternatives, evaluates weather conditions along each route, and recommends the safest eligible option using a deterministic ranking system.

## Features

### Plan Trip
- Search for origin and destination locations using geocoding autocomplete.
- Specify departure date and time, truck load weight, and checkpoint sampling interval.
- Choose checkpoint intervals of 10, 25, or 50 miles.
- Generate route alternatives and evaluate their weather conditions.

### Route Comparison
- Compare up to three route alternatives returned by the routing provider.
- View route distance, travel duration, estimated arrival, and risk metrics.
- Display route geometries and checkpoint risk markers on an interactive map.
- Identify the recommended route and understand the ranking criteria.
- Distinguish eligible and ineligible routes.

### Route Details
- Inspect checkpoints along a selected route.
- View cumulative distance, estimated arrival time, and weather conditions.
- Examine wind speed, rainfall, snowfall, and associated risk classifications.
- Review route-level safety metrics and load-dependent advisories.
- Select checkpoints on the map and inspect their details.

### Weather Explorer
- Explore available forecasts across a 0–48-hour timeline.
- Play, pause, and navigate between forecast timestamps.
- Switch between overall risk, wind speed, rainfall, and snowfall layers.
- Inspect checkpoint weather conditions and risk warnings.
- Visualize weather risk along the route corridor using available forecast data.

### Trip History
- View previously saved trip plans and their results.
- Search trips by origin, destination, or trip identifier.
- Filter records by status, risk level, and departure date.
- Reopen saved route and checkpoint details.
- Replan a previous trip using current forecasts.
- Export trip records to CSV or JSON where supported.

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | React 19, Vite, JavaScript |
| Styling | Tailwind CSS |
| Maps | Leaflet, React Leaflet |
| Backend | Python, Django, Django REST Framework |
| Routing | OSRM or a configured routing provider |
| Geocoding | OpenStreetMap Nominatim |
| Weather | Open-Meteo |
| Database | SQLite for local development |
| Testing | Django automated tests, Vite production build |

## How It Works

1. **Trip input:** The user provides the origin, destination, departure time, truck load weight, and checkpoint interval.
2. **Route generation:** The backend requests available road-route alternatives from the routing provider.
3. **Checkpoint sampling:** Route geometries are sampled at the selected distance interval, including appropriate endpoints.
4. **ETA calculation:** The backend estimates when the truck will reach each checkpoint.
5. **Weather retrieval:** Weather forecasts are associated with checkpoint locations and their estimated arrival times.
6. **Risk evaluation:** Weather conditions are normalized and evaluated against the configured weather and load-safety rules.
7. **Route ranking:** Eligible routes are compared using the prescribed lexicographical ranking hierarchy.
8. **Results and persistence:** Route summaries, checkpoints, risk metrics, and recommendations are returned to the frontend. Trip results are saved for historical access when persistence is enabled.

## Risk Evaluation

The application evaluates wind, rainfall, and snowfall conditions at route checkpoints.

### Weather thresholds

| Condition | Low | Moderate | High | Severe | No Travel |
|---|---|---|---|---|---|
| Wind | Under 25 mph | 25–34 mph | 35–44 mph | 45–54 mph | 55 mph or more |
| Rainfall | Under 0.10 in/hr | 0.10–0.25 in/hr | 0.25–0.50 in/hr | 0.50–1.00 in/hr | Over 1.00 in/hr |
| Snowfall | Under 0.5 in/hr | 0.5–1.0 in/hr | 1.0–2.0 in/hr | 2.0–3.0 in/hr | Over 3.0 in/hr |

### Load-dependent rules

- Wind speeds of 55 mph or more result in No Travel for any load.
- Wind speeds of 45–54 mph result in No Travel when the truck load exceeds 30,000 lb.
- Wind speeds of 35–44 mph result in Severe risk when the truck load exceeds 40,000 lb.

Boundary conditions should be handled consistently in the classifier and covered by automated tests.

### Route recommendation

Eligible routes are ranked in this order:

1. Fewest severe-risk miles.
2. Fewest high-risk miles.
3. Lowest distance-weighted average risk.
4. Shortest travel duration.

Routes containing a No Travel checkpoint are marked ineligible. If all available routes are ineligible, the application should clearly communicate that no eligible route is available under the evaluated conditions.

## Architecture

```text
React + Vite Frontend
        |
        | HTTP / REST
        v
Django REST Framework
        |
        +---- Trip Planning and ETA Calculation
        |
        +---- Checkpoint Generation
        |
        +---- Weather Retrieval and Normalization
        |
        +---- Risk Classification and Route Ranking
        |
        +---- Trip History and Export
        |
        +---- OSRM / Routing Provider
        |
        +---- Open-Meteo Weather API
        |
        +---- Database
```

The frontend handles user interaction, map visualization, route selection, and forecast controls. The Django backend coordinates external API calls, calculates checkpoints and risk metrics, ranks routes, and manages saved trip records.

## Getting Started

### Prerequisites

- Node.js 18 or later
- Python 3.10–3.12
- npm
- Git

### 1. Clone the repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd YOUR_PROJECT_DIRECTORY
```

Replace the placeholders with your actual repository URL and directory name.

### 2. Set up the backend

```bash
cd backend
python -m venv .venv
```

Activate the environment on Windows:

```powershell
.venv\Scripts\activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

If the repository includes an environment template, copy it:

```powershell
Copy-Item .env.example .env
```

Configure the required environment variables according to your backend settings.

Run database migrations:

```bash
python manage.py migrate
```

Start the development server:

```bash
python manage.py runserver 127.0.0.1:8000
```

The backend will be available at `http://127.0.0.1:8000/`.

### 3. Set up the frontend

Open a second terminal:

```bash
cd frontend
npm install
```

Configure the frontend API base URL using the environment variable expected by the application. For Vite, environment variables exposed to frontend code commonly use the `VITE_` prefix.

Start the development server:

```bash
npm run dev
```

The frontend will be available at `http://127.0.0.1:5173/`.

## API Reference

The following endpoints describe the intended API surface. Confirm the paths and methods against the current Django URL configuration.

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/routes/plan/` | Plan a trip and return route, checkpoint, weather, and recommendation results |
| `GET` | `/api/routes/autocomplete/?q={query}` | Search for origin and destination locations |
| `GET` | `/api/routes/trips/` | Retrieve saved trips with supported search and filters |
| `GET` | `/api/routes/trips/{id}/` | Retrieve a saved trip and its details |
| `POST` | `/api/routes/trips/{id}/replan/` | Re-evaluate a saved trip using current forecasts |
| `DELETE` | `/api/routes/trips/{id}/` | Delete a saved trip, if supported |

## Testing

### Backend tests

From the `backend` directory:

```bash
python manage.py test routing
```

The test suite should cover checkpoint generation, ETA calculations, weather-unit normalization, risk boundaries, load-dependent rules, route ranking, and API behavior.

### Frontend production build

From the `frontend` directory:

```bash
npm run build
```

Verify that the build completes successfully, then test the deployed application separately to confirm that API requests, routing, weather retrieval, and map interactions work correctly.

---

## Deployment on Vercel

The application is pre-configured for Vercel's **Multi-Service Projects** feature ([vercel.com/docs/services](https://vercel.com/docs/services)). Both the **React 19 Vite frontend** and the **Django 6 REST Framework backend** are defined under the top-level `services` key with unified domain routing.

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "services": {
    "backend": {
      "root": "backend",
      "framework": "django"
    },
    "frontend": {
      "root": "frontend",
      "framework": "vite"
    }
  },
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": {
        "service": "backend"
      }
    },
    {
      "source": "/(.*)",
      "destination": {
        "service": "frontend"
      }
    }
  ]
}
```

### Option A: Import via Vercel Dashboard (Multi-Service Project)

Deploy the multi-service project in 1 click:

1. Push your repository to GitHub (`https://github.com/prakhar2219/Spotter-Assignment.git`).
2. Go to the [Vercel Dashboard](https://vercel.com/dashboard) and click **"Add New..."** → **"Project"**.
3. Import the `Spotter-Assignment` repository.
4. Vercel will detect the top-level `services` configuration in [vercel.json](file:///c:/Users/welco/OneDrive/Desktop/Spotter/vercel.json).
5. Review the detected services:
   - `frontend` (Root: `frontend`, Framework: `vite`, Public: `/(.*)`)
   - `backend` (Root: `backend`, Framework: `django`, Public: `/api/(.*)`)
6. (Optional) Set Environment Variables:
   - `DEBUG`: `False`
   - `SECRET_KEY`: `your-production-secret-key-here`
   - `ALLOWED_HOSTS`: `.vercel.app`
7. Click **Deploy**. Vercel will build both services independently and route incoming requests automatically.

---

### Option B: Deploying via Vercel CLI

You can also deploy directly from your local terminal using the Vercel CLI:

```bash
# 1. Install Vercel CLI globally
npm install -g vercel

# 2. Log in to your Vercel account
vercel login

# 3. Deploy preview build from the project root
vercel

# 4. Deploy production build
vercel --prod
```

---

### Option C: Separate Frontend & Backend Projects (If Preferred)

If you prefer two separate Vercel projects:

#### 1. Backend Project
- In Vercel, set **Root Directory** to `backend`.
- Vercel uses [backend/vercel.json](file:///c:/Users/welco/OneDrive/Desktop/Spotter/backend/vercel.json) and [backend/api/index.py](file:///c:/Users/welco/OneDrive/Desktop/Spotter/backend/api/index.py).
- Note the resulting URL (e.g. `https://spotter-backend.vercel.app`).

#### 2. Frontend Project
- In Vercel, set **Root Directory** to `frontend`.
- Set the Environment Variable:
  - `VITE_API_BASE_URL` = `https://spotter-backend.vercel.app`
- Deploy. The frontend connects directly to your backend project over HTTPS with pre-configured CORS support.

---

### Vercel Serverless Architecture Highlights

- **Serverless WSGI Adapter**: [api/index.py](file:///c:/Users/welco/OneDrive/Desktop/Spotter/api/index.py) boots Django using `get_wsgi_application()` wrapped for Vercel's Python runtime.
- **Serverless SQLite in `/tmp`**: When running on Vercel (`VERCEL=1`), Django automatically maps `db.sqlite3` to `/tmp/db.sqlite3` and executes migrations on cold start, preserving trip history persistence in serverless environments.
- **Unified Domain Routing**: All `/api/*` traffic routes internally to Django serverless functions, eliminating CORS latency and origin mismatch errors in production.
- **SPA Fallback**: Deep link reloads automatically fall back to `index.html` via Vercel rewrite rules.


## Project Structure

```text
Spotter/
├── backend/
│   ├── manage.py
│   ├── requirements.txt
│   ├── .env.example
│   ├── spotter_backend/
│   └── routing/
│       ├── models.py
│       ├── views.py
│       ├── urls.py
│       ├── tests.py
│       ├── services/
│       └── recommendation/
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── assets/
│       ├── App.jsx
│       ├── index.css
│       ├── components/
│       └── services/
├── .gitignore
└── README.md
```

