# Spotter — Weather-Aware Truck Routing & Safety Intelligence Platform

A full-stack freight routing and dispatch intelligence application that evaluates commercial truck routes using time-aware weather forecasts, load-dependent safety rules, checkpoint-level hazard detection, and deterministic route recommendations.

Built with **React 19**, **Vite**, **Tailwind CSS**, **Leaflet**, **Python 3**, **Django**, and **Django REST Framework**.

---

## Table of Contents
1. [Core Features](#core-features)
2. [Safety & Risk Evaluation Engine](#safety--risk-evaluation-engine)
3. [Lexicographical Recommendation Hierarchy](#lexicographical-recommendation-hierarchy)
4. [Architecture & System Design](#architecture--system-design)
5. [Application Views](#application-views)
6. [Getting Started](#getting-started)
   - [Prerequisites](#prerequisites)
   - [Backend Setup](#backend-setup)
   - [Frontend Setup](#frontend-setup)
   - [Running Tests](#running-tests)
7. [API Reference](#api-reference)
8. [Project Structure](#project-structure)
9. [License](#license)

---

## Core Features

- **Multi-Route Analysis**: Requests up to 3 genuine alternative highway corridors (using OSRM / OpenRouteService routing engines) without fabricating or duplicating routes.
- **Road Geometry Checkpoint Sampling**: Samples road geometries at strict user-selected intervals (10, 25, or 50 miles) plus origin and destination points.
- **Time-Aware Forecast Mapping**: Estimates arrival times (ETAs) at each individual checkpoint along the route and queries hourly weather predictions for the exact forecasted arrival time window.
- **Cargo-Weight-Adjusted Wind Safety Rules**: Evaluates crosswind and wind gust risks dynamically based on vehicle gross weight (empty/light vs. medium vs. heavy).
- **Multi-Dimensional Risk Matrix**: Analyzes wind speeds, gusts, rainfall rate, snowfall rate, and surface visibility.
- **Dynamic 0–48h Weather Scrubber**: Interactive timeline slider allowing dispatchers to scrub forward up to 48 hours to assess changing weather fronts along all corridors.
- **Trip History & Persistence**: Full CRUD management of planned trips stored in SQLite with full-text search, multi-factor filtering (risk tier, status, date), CSV/JSON export, and one-click replanning.

---

## Safety & Risk Evaluation Engine

### 1. Load-Dependent Wind Thresholds
Lighter trailers are substantially more vulnerable to rollover accidents caused by crosswinds and high gusts. The platform dynamically applies wind risk thresholds based on cargo gross weight:

| Truck Load (lbs) | Classification | Low Risk | Medium Risk | High Risk | Severe Risk |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **< 20,000 lbs** | Empty / Light | < 20 mph | 20 – 29 mph | 30 – 39 mph | ≥ 40 mph |
| **20,000 – 45,000 lbs** | Medium Load | < 25 mph | 25 – 34 mph | 35 – 44 mph | ≥ 45 mph |
| **> 45,000 lbs** | Heavy Load | < 30 mph | 30 – 39 mph | 40 – 49 mph | ≥ 50 mph |

### 2. Precipitation & Snow Thresholds
- **Rainfall Rate**:
  - `Low`: < 0.10 in/hr
  - `Medium`: 0.10 – 0.30 in/hr
  - `High`: 0.30 – 0.50 in/hr
  - `Severe`: > 0.50 in/hr
- **Snowfall Rate**:
  - `Low`: 0.00 in/hr
  - `Medium`: 0.01 – 0.50 in/hr
  - `High`: 0.50 – 1.00 in/hr
  - `Severe`: > 1.00 in/hr

---

## Lexicographical Recommendation Hierarchy

Routes are ranked using a strict, non-negotiable four-tier decision order:

1. **Fewest Severe Risk Miles**: Routes with less exposure to extreme hazard zones are preferred first.
2. **Fewest High Risk Miles**: If Severe miles are tied, the route with fewer High-risk miles is chosen.
3. **Lowest Distance-Weighted Average Risk**: If High miles are tied, the route with the lowest composite distance-weighted risk score is selected.
4. **Shortest Travel Duration**: If risk metrics are identical, the fastest corridor is selected.

> **Ineligibility Rule**: Any route containing a "No Travel" checkpoint (e.g. winds ≥ 60 mph or blizzard conditions exceeding safety thresholds) is marked **Ineligible**. If all available corridors contain "No Travel" checkpoints, the system displays an explicit warning stating that no route safely accommodates the trip under configured parameters.

---

## Architecture & System Design

```
                     ┌─────────────────────────────────────────┐
                     │          React 19 + Vite Frontend       │
                     │  (Tailwind CSS v4, React-Leaflet, DRF)  │
                     └────────────────────┬────────────────────┘
                                          │ HTTP / REST
                                          ▼
                     ┌─────────────────────────────────────────┐
                     │         Django REST Framework API       │
                     │                                         │
                     │  ┌───────────────────────────────────┐  │
                     │  │        Trip Planning Engine       │  │
                     │  │  - Checkpoint Sampling (10/25/50) │  │
                     │  │  - ETA Progression Calculator     │  │
                     │  │  - Load-Dependent Wind Analyzer   │  │
                     │  │  - 4-Tier Recommendation Ranker   │  │
                     │  └─────────────────┬─────────────────┘  │
                     │                    │                    │
                     │  ┌─────────────────┴─────────────────┐  │
                     │  │      Trip History & Persistence   │  │
                     │  │  - SQLite3 Database               │  │
                     │  │  - Multi-Filter & Search Engine   │  │
                     │  │  - Export (JSON/CSV) Generator    │  │
                     │  └───────────────────────────────────┘  │
                     └─────────┬─────────────────────┬─────────┘
                               │                     │
                     OSRM API  │                     │ Open-Meteo API
                               ▼                     ▼
                     ┌──────────────────┐  ┌──────────────────┐
                     │ Multi-Corridor   │  │ Hourly Forecast  │
                     │ Geometry Engine  │  │ Weather Provider │
                     └──────────────────┘  └──────────────────┘
```

---

## Application Views

### 1. Plan Trip
- Origin and Destination inputs with real-time geocoding autocomplete.
- Quick origin/destination swap and current-time departure presets.
- Truck load in pounds with cargo category badges (Empty, Partial, Full).
- Checkpoint sampling interval selector (10, 25, or 50 miles).

### 2. Route Comparison
- Side-by-side comparison cards with safety badges (`RECOMMENDED`, `ELIGIBLE`, `INELIGIBLE`).
- Distance, travel duration, Severe miles, High miles, and distance-weighted risk scores.
- Interactive multi-route Leaflet map rendering all alternative corridors with distinct colors and risk heatmaps.
- Detailed metric breakdown table for dispatcher review.

### 3. Route Details
- Comprehensive checkpoint-by-checkpoint table with cumulative mileages and estimated arrival times.
- Interactive pin inspection showing temperature, precipitation, wind speed, wind gusts, and road safety advisories.
- Dynamic Load Advisory Banner detailing the exact crosswind tolerances enforced for the current trailer weight.
- Chronological Route Risk Timeline illustrating hazard progression over time and distance.

### 4. Weather Explorer
- Interactive 0–48 hour forecast scrubber slider with Play / Pause simulation.
- Layer toggles for Temperature, Precipitation, and Wind radar contours.
- Time-aware inspection of weather fronts along all route geometries simultaneously.

### 5. Trip History
- Central repository of previously planned trips stored in the backend database.
- Search by origin, destination, or trip identifier.
- Multi-factor filtering by risk level (`Low`, `Medium`, `High`, `Severe`), status (`Completed`, `Scheduled`, `In-Transit`, `Cancelled`), and departure dates.
- One-click replan feature to re-evaluate past trips under current live forecasts.
- One-click CSV and JSON export for dispatch logs and safety auditing.

---

## Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **Python**: v3.10, v3.11, or v3.12
- **npm** or **yarn**

---

### Backend Setup

1. **Navigate to the backend directory**:
   ```bash
   cd backend
   ```

2. **Create and activate a Python virtual environment**:
   ```bash
   # Windows
   python -m venv .venv
   .venv\Scripts\activate

   # macOS / Linux
   python3 -m venv .venv
   source .venv/bin/activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure Environment Variables**:
   ```bash
   cp .env.example .env
   ```
   *(The default `.env.example` comes pre-configured for standard local development with zero external API key requirements).*

5. **Apply database migrations**:
   ```bash
   python manage.py migrate
   ```

6. **Start the Django development server**:
   ```bash
   python manage.py runserver 127.0.0.1:8000
   ```
   The backend API will be available at `http://127.0.0.1:8000/api/routes/`.

---

### Frontend Setup

1. **Navigate to the frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the Vite development server**:
   ```bash
   npm run dev
   ```
   The frontend application will be running at `http://127.0.0.1:5173/`.

---

### Running Tests

#### Backend Test Suite (58 Automated Unit & Integration Tests)
Tests cover risk classification boundaries, cargo load thresholds, ETA estimation, checkpoint sampling intervals, OSRM routing fallbacks, and 4-tier recommendation rankings:
```bash
cd backend
python manage.py test routing
```

#### Frontend Production Build Verification
Verifies TypeScript/JavaScript syntax, Tailwind CSS compilation, and React asset bundling:
```bash
cd frontend
npm run build
```

---

## API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/routes/plan/` | Calculate up to 3 routes, checkpoints, weather ETAs, and recommendation ranking |
| `GET` | `/api/routes/autocomplete/?q={query}` | Geocoding autocomplete for origin and destination cities/addresses |
| `GET` | `/api/routes/trips/` | List historical trips with search, status/risk filtering, and pagination |
| `GET` | `/api/routes/trips/{id}/` | Retrieve full checkpoint and route details for a persisted trip |
| `POST` | `/api/routes/trips/{id}/replan/` | Re-evaluate an existing trip using live weather forecasts |
| `DELETE` | `/api/routes/trips/{id}/` | Delete a historical trip record |

---

## Project Structure

```
Spotter/
├── README.md                           # System overview & operational guide
├── .gitignore                          # Git ignore rules for Python, Node, and envs
├── backend/
│   ├── manage.py                       # Django management script
│   ├── requirements.txt                # Python backend dependencies
│   ├── .env.example                    # Sample environment configurations
│   ├── spotter_backend/                # Core Django project settings & ASGI/WSGI
│   │   ├── settings.py
│   │   ├── urls.py
│   │   └── wsgi.py
│   └── routing/                        # Truck routing & weather application
│       ├── models.py                   # Historical trip persistence schema
│       ├── views.py                    # REST API endpoints & viewsets
│       ├── urls.py                     # Route URL dispatching
│       ├── tests.py                    # 58 comprehensive unit & integration tests
│       ├── services/
│       │   ├── autocomplete.py         # Nominatim geocoding & location suggestions
│       │   ├── checkpoints.py          # Geometry interpolation & checkpoint sampling
│       │   ├── history_seeds.py        # Default historical trip seed generator
│       │   ├── osrm.py                 # Multi-alternative route corridor client
│       │   ├── planner.py              # Trip coordination & ETA calculation
│       │   └── weather.py              # Open-Meteo hourly forecast client
│       └── recommendation/
│           ├── classifier.py           # Wind, rain, snow & load rule classification
│           ├── metrics.py              # Severe/High miles & distance-weighted risk
│           └── ranker.py               # 4-tier lexicographical recommendation
└── frontend/
    ├── package.json                    # Node.js dependencies & scripts
    ├── vite.config.js                  # Vite build configuration
    ├── index.html                      # HTML entrypoint
    └── src/
        ├── main.jsx                    # React root rendering
        ├── App.jsx                     # Top-level state & navigation controller
        ├── index.css                   # Tailwind CSS styling & animations
        ├── components/
        │   ├── Header.jsx              # Modernized navigation bar with status badges
        │   ├── Sidebar.jsx             # Dispatch navigation drawer
        │   ├── PlanTripPage.jsx        # Trip planning form with cargo & interval options
        │   ├── RouteComparisonPage.jsx # Multi-route comparison dashboard & map
        │   ├── RouteDetailsPage.jsx    # Checkpoints table, pin inspection, timeline
        │   ├── WeatherExplorerPage.jsx # 0–48h forecast scrubber & radar layer view
        │   ├── TripHistoryPage.jsx     # Persisted trip history, filters, and exports
        │   ├── ExportTripModal.jsx     # CSV/JSON trip export dialog
        │   └── RouteMap.jsx            # Interactive Leaflet map component
        └── services/
            └── api.js                  # Axios/Fetch client with backend API endpoints
```

---

## License

This project is licensed under the MIT License — see the repository for full details.
