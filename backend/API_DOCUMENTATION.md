# Spotter Planning API Documentation

## Endpoint: `POST /api/routes/plan/`

Executes the complete weather-aware truck route planning pipeline in a single transaction:
1. Resolves origin and destination coordinates using geocoding.
2. Requests up to 3 genuine alternative routes from the configured routing provider.
3. Generates checkpoints along actual road geometry at 10, 25, or 50 mile intervals, estimating arrival time (ETA) for each point.
4. Retrieves time-aware meteorological forecasts from Open-Meteo for each checkpoint's coordinates and ETA.
5. Classifies wind, rain, and snow risks using the assessment's thresholds and load-dependent boundary rules.
6. Computes Severe miles, High miles, distance-weighted average risk, and travel duration.
7. Disqualifies routes containing any No Travel checkpoint.
8. Ranks eligible routes using strict 4-tier lexicographical priority:
   - **Tier 1**: Fewest Severe miles
   - **Tier 2**: Fewest High miles
   - **Tier 3**: Lowest distance-weighted average risk
   - **Tier 4**: Shortest travel time (tie-breaker only)
9. Generates human-readable explanations and tradeoff summaries.

---

## 1. Request Specification

- **Method**: `POST`
- **URL**: `/api/routes/plan/`
- **Content-Type**: `application/json`

### Request Fields

| Field | Type | Required | Description | Example / Values |
| :--- | :--- | :--- | :--- | :--- |
| `origin` | `string` \| `[lon, lat]` | **Yes** | Starting place query or GeoJSON coordinate pair. | `"Philadelphia, PA"` or `[-75.1635, 39.9527]` |
| `destination` | `string` \| `[lon, lat]` | **Yes** | Destination place query or GeoJSON coordinate pair. | `"Baltimore, MD"` or `[-76.6108, 39.2909]` |
| `departure_time` | `string` (ISO 8601) | **Yes** | Departure timestamp **with explicit timezone offset**. Naive timestamps are rejected. | `"2026-10-20T14:00:00Z"` or `"2026-10-20T10:00:00-04:00"` |
| `load_weight_lb` | `number` | **Yes** | Gross cargo load weight in pounds ($\ge 0$). Triggers load-dependent crosswind rules at 30k & 40k lb. | `42000` |
| `sampling_interval_miles` | `integer` | **Yes** | Checkpoint sampling interval along route geometry. | `10`, `25`, or `50` |
| `provider` | `string` | No | Optional provider override. Defaults to backend configuration. | `"osrm"`, `"openrouteservice"`, `"mapbox"` |
| `max_alternatives` | `integer` | No | Target alternative route count (1–3, default 3). | `3` |

### Example Request Body

```json
{
  "origin": "Philadelphia, PA",
  "destination": "Baltimore, MD",
  "departure_time": "2026-10-20T14:00:00Z",
  "load_weight_lb": 42000,
  "sampling_interval_miles": 25,
  "provider": "osrm"
}
```

---

## 2. Response Schema

### Top-Level Fields

| Field | Type | Description |
| :--- | :--- | :--- |
| `status` | `string` | `"success"` |
| `trip` | `object` | Trip request metadata, geocoded endpoints, and coordinate conventions. |
| `routes_count` | `integer` | Number of genuine alternative routes returned by provider ($\le 3$). |
| `routes` | `array[object]` | List of analyzed routes with geometry, checkpoints, weather, risk, and metrics. |
| `recommendation` | `object` | Recommended route decision, status, rationale, and tradeoffs. |
| `warnings` | `array[string]` | Corridor notices, unavailable weather warnings, or provider limitations. |
| `units` | `object` | Measurement units used across all metrics. |

### Route Object (`routes[]`)

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Unique identifier (e.g. `"route-1"`). |
| `name` | `string` | Human-readable route name based on major roadways. |
| `distance_meters` | `number` | Total route road distance in meters. |
| `distance_miles` | `number` | Total route road distance in miles. |
| `duration_seconds` | `number` | Estimated travel duration in seconds. |
| `duration_formatted` | `string` | Formatted driving duration (e.g. `"2h 11m"`). |
| `geometry` | `object` | GeoJSON LineString `{"type": "LineString", "coordinates": [[lon, lat], ...]}`. |
| `checkpoints` | `array[object]` | Sequence of sampled checkpoints along route road geometry. |
| `metrics` | `object` | Route risk metrics (Severe miles, High miles, distance-weighted average risk). |
| `is_recommended` | `boolean` | `true` if this route is the winning recommendation. |

### Checkpoint Object (`checkpoints[]`)

| Field | Type | Description |
| :--- | :--- | :--- |
| `index` | `integer` | 0-indexed checkpoint position along the route. |
| `name` | `string` | Checkpoint label (`"Checkpoint 0 (Origin)"`, `"Checkpoint 1"`, etc.). |
| `coordinates` | `[lon, lat]` | Coordinates in standard GeoJSON format `[longitude, latitude]`. |
| `cumulative_distance_miles` | `number` | Road distance from trip origin to this checkpoint in miles. |
| `segment_distance_miles` | `number` | Road distance from previous checkpoint in miles. |
| `estimated_arrival_time` | `string` | Estimated arrival timestamp (ISO 8601 with timezone). |
| `weather` | `object` | Hourly forecast: `wind_speed_mph`, `precipitation_in_hr`, `snowfall_in_hr`, `temperature_f`, `is_available`. |
| `risk` | `object` | Evaluated risk: `overall_risk`, `overall_score`, `is_safe`, `is_no_travel`, `governing_factor`, `explanation`. |

### Route Risk Metrics Object (`metrics`)

| Field | Type | Description |
| :--- | :--- | :--- |
| `severe_miles` | `number` | Total road miles subject to Severe risk conditions. |
| `high_miles` | `number` | Total road miles subject to High risk conditions. |
| `moderate_miles` | `number` | Total road miles subject to Moderate risk conditions. |
| `low_miles` | `number` | Total road miles subject to Low risk conditions. |
| `no_travel_miles` | `number` | Road miles subject to No Travel conditions. |
| `distance_weighted_average_risk` | `number` | Average risk score weighted by segment distance ($0.00$ to $4.00$). |
| `is_eligible` | `boolean` | `true` if eligible for recommendation (no No Travel checkpoints and complete weather). |
| `ineligibility_reasons` | `array[string]` | Explanations if disqualified. |

---

## 3. Real Example Response (Live Output)

```json
{
  "status": "success",
  "trip": {
    "origin": {
      "query": "Philadelphia, PA",
      "display_name": "Philadelphia, Philadelphia County, Pennsylvania, United States",
      "coordinates": [
        -75.1635,
        39.9527
      ]
    },
    "destination": {
      "query": "Baltimore, MD",
      "display_name": "Baltimore, Maryland, United States",
      "coordinates": [
        -76.6108,
        39.2909
      ]
    },
    "departure_time": "2026-10-20T14:00:00+00:00",
    "load_weight_lb": 42000.0,
    "sampling_interval_miles": 25,
    "provider": "osrm",
    "requested_at": "2026-10-19T18:37:18.437341+00:00",
    "coordinate_convention": {
      "format": "GeoJSON standard [longitude, latitude]",
      "leaflet_usage": "Leaflet Polyline expects [latitude, longitude]. Invert coordinates or use L.geoJSON()."
    }
  },
  "routes_count": 2,
  "routes": [
    {
      "id": "route-1",
      "name": "Route 1 (Delaware Expressway, John F. Kennedy Memorial Highway)",
      "distance_meters": 157105.9,
      "distance_miles": 97.62,
      "duration_seconds": 7882.1,
      "duration_hours": 2.19,
      "duration_formatted": "2h 11m",
      "summary": "Via Delaware Expressway, John F. Kennedy Memorial Highway",
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-75.163486, 39.953347],
          [-75.163761, 39.953387],
          [-76.610759, 39.2908816]
        ]
      },
      "checkpoints_count": 5,
      "checkpoints": [
        {
          "index": 0,
          "name": "Checkpoint 0 (Origin)",
          "coordinates": [-75.163486, 39.953347],
          "cumulative_distance_miles": 0.0,
          "segment_distance_miles": 0.0,
          "estimated_arrival_time": "2026-10-20T14:00:00+00:00",
          "weather": {
            "wind_speed_mph": 9.2,
            "precipitation_in_hr": 0.0,
            "snowfall_in_hr": 0.0,
            "temperature_f": 64.2,
            "weather_code": 1,
            "weather_description": "Mainly clear",
            "forecast_time": "2026-10-20T14:00",
            "is_available": true
          },
          "risk": {
            "overall_risk": "Low",
            "overall_score": 0,
            "is_safe": true,
            "is_no_travel": false,
            "governing_factor": "Wind (9.2 mph)",
            "explanation": "Safe conditions. Governing factor: Wind (9.2 mph)"
          }
        },
        {
          "index": 1,
          "name": "Checkpoint 1",
          "coordinates": [-75.4802, 39.7541],
          "cumulative_distance_miles": 25.0,
          "segment_distance_miles": 25.0,
          "estimated_arrival_time": "2026-10-20T14:33:00+00:00",
          "weather": {
            "wind_speed_mph": 8.1,
            "precipitation_in_hr": 0.0,
            "snowfall_in_hr": 0.0,
            "temperature_f": 65.1,
            "weather_code": 1,
            "weather_description": "Mainly clear",
            "forecast_time": "2026-10-20T15:00",
            "is_available": true
          },
          "risk": {
            "overall_risk": "Low",
            "overall_score": 0,
            "is_safe": true,
            "is_no_travel": false,
            "governing_factor": "Wind (8.1 mph)",
            "explanation": "Safe conditions. Governing factor: Wind (8.1 mph)"
          }
        }
      ],
      "metrics": {
        "total_distance_miles": 97.62,
        "travel_time_seconds": 7882.1,
        "travel_time_formatted": "2h 11m",
        "severe_miles": 0.0,
        "high_miles": 0.0,
        "moderate_miles": 0.0,
        "low_miles": 97.62,
        "no_travel_miles": 0.0,
        "unknown_miles": 0.0,
        "distance_weighted_average_risk": 0.0,
        "has_no_travel": false,
        "has_unknown": false,
        "is_eligible": true,
        "ineligibility_reasons": [],
        "segment_risk_assignment_method": "Conservative Max-Bound: max(risk(C_{k-1}), risk(C_k))"
      },
      "is_recommended": true
    }
  ],
  "recommendation": {
    "recommended_route_id": "route-1",
    "winning_route_name": "Route 1 (Delaware Expressway, John F. Kennedy Memorial Highway)",
    "status": "recommended",
    "explanation": "Route 1 is recommended as all safety and travel metrics are equal across eligible routes.",
    "tradeoffs_summary": "Excluded 1 alternative route(s) (Route 2) due to No Travel hazard rules.",
    "decision_criterion": "shortest_travel_time",
    "ranked_route_ids": [
      "route-1"
    ],
    "ineligible_route_ids": [
      "route-2"
    ]
  },
  "warnings": [
    "Routing provider returned 2 genuine alternative route(s) for this corridor (target was 3). No routes were duplicated or fabricated."
  ],
  "units": {
    "distance": "miles",
    "distance_meters": "meters",
    "duration": "seconds",
    "duration_hours": "hours",
    "wind_speed": "mph",
    "precipitation": "in/hr",
    "snowfall": "in/hr",
    "temperature": "fahrenheit",
    "load_weight": "lb",
    "risk_scale": "Low=0, Moderate=1, High=2, Severe=3, No Travel=4"
  }
}
```

---

## 4. Error Responses

| HTTP Status | Error Code | Description / Example |
| :--- | :--- | :--- |
| **`400 Bad Request`** | `invalid_input` | Missing required fields, negative load weight, invalid sampling interval, or naive timestamp without timezone.<br>`{"error": "invalid_input", "message": "'departure_time' is missing an explicit timezone offset."}` |
| **`404 Not Found`** | `geocoding_failed` | Origin or destination could not be resolved by geocoding.<br>`{"error": "geocoding_failed", "message": "Could not resolve location: 'NonexistentPlaceXYZ'"}` |
| **`404 Not Found`** | `no_routes_found` | No road route could be found between points (e.g. across ocean).<br>`{"error": "no_routes_found", "message": "No routes could be found between origin and destination."}` |
| **`429 Too Many Requests`** | `rate_limit_exceeded` | Upstream routing provider rate limit reached.<br>`{"error": "rate_limit_exceeded", "message": "Upstream rate limit exceeded."}` |
| **`502 Bad Gateway`** | `upstream_provider_unavailable` | Routing or weather provider API timed out or returned HTTP 5xx.<br>`{"error": "upstream_provider_unavailable", "message": "Routing provider connection failed."}` |
| **`503 Service Unavailable`** | `missing_credentials` | Required routing provider API key is not configured.<br>`{"error": "missing_credentials", "message": "ROUTING_API_KEY environment variable is required."}` |
| **`500 Internal Error`** | `internal_error` | Unexpected server execution exception. |
