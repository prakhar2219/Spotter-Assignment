"""
Trip Planning Service Pipeline.
Coordinates routing, checkpoint generation, time-aware weather fetching,
load-dependent risk evaluation, and strict lexicographical route ranking.
Decoupled from Django views and UI frameworks.
"""

from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Union, Tuple
from .routing_service import get_routing_provider
from .exceptions import (
    InvalidTripInputError,
    GeocodingError,
    NoRoutesFoundError,
    MissingApiKeyError,
    ProviderUnavailableError,
    RateLimitError,
)
from routing.checkpoints import generate_checkpoints, VALID_SAMPLING_INTERVALS_MILES
from routing.weather import enrich_checkpoints_with_weather
from routing.risk import evaluate_checkpoint_risk, RiskLevel
from routing.recommendation import rank_and_recommend_routes, calculate_route_risk_metrics

STANDARD_UNITS = {
    "distance": "miles",
    "distance_meters": "meters",
    "duration": "seconds",
    "duration_hours": "hours",
    "wind_speed": "mph",
    "precipitation": "in/hr",
    "snowfall": "in/hr",
    "temperature": "fahrenheit",
    "load_weight": "lb",
    "risk_scale": "Low=0, Moderate=1, High=2, Severe=3, No Travel=4",
}

COORDINATE_CONVENTION = {
    "format": "GeoJSON standard [longitude, latitude]",
    "leaflet_usage": "Leaflet Polyline expects [latitude, longitude]. Invert coordinates or use L.geoJSON().",
}

def validate_departure_time_with_timezone(raw_departure: Any) -> Tuple[datetime, str]:
    """
    Validates departure_time ISO 8601 string and enforces an explicit timezone.
    Rejects naive datetime strings without timezone offsets.
    Returns:
        (datetime_object, normalized_iso_string)
    """
    if raw_departure is None or raw_departure == "":
        raise InvalidTripInputError("'departure_time' is required.")

    if not isinstance(raw_departure, str):
        raise InvalidTripInputError("'departure_time' must be a valid ISO 8601 string.")

    cleaned = raw_departure.strip()
    if not cleaned:
        raise InvalidTripInputError("'departure_time' cannot be empty.")

    try:
        # Handle 'Z' suffix consistently
        dt = datetime.fromisoformat(cleaned.replace("Z", "+00:00"))
    except Exception as e:
        raise InvalidTripInputError(
            f"Invalid ISO 8601 format for 'departure_time': '{raw_departure}'. "
            "Expected format with explicit timezone (e.g. '2026-10-20T08:00:00Z' or '2026-10-20T08:00:00-04:00')."
        )

    if dt.tzinfo is None or dt.tzinfo.utcoffset(dt) is None:
        raise InvalidTripInputError(
            f"'departure_time' ('{raw_departure}') is missing an explicit timezone offset. "
            "Naive timestamps are not permitted. Please supply an explicit UTC offset "
            "(e.g. '2026-10-20T08:00:00Z' or '2026-10-20T08:00:00-04:00')."
        )

    return dt, dt.isoformat()

def plan_trip(
    origin: Union[str, List[float], Tuple[float, float], Dict[str, float]],
    destination: Union[str, List[float], Tuple[float, float], Dict[str, float]],
    departure_time: str,
    load_weight_lb: Union[float, int],
    sampling_interval_miles: int = 25,
    provider_name: Optional[str] = None,
    max_alternatives: int = 3,
) -> Dict[str, Any]:
    """
    Executes the complete weather-aware truck route planning pipeline:
      1. Validates inputs, coordinates, timezone-aware departure, and load weight.
      2. Resolves origin/destination via geocoding and fetches up to 3 genuine alternative routes.
      3. Generates checkpoints along actual route geometry at 10, 25, or 50 mile intervals with ETAs.
      4. Retrieves normalized hourly weather forecasts for each checkpoint.
      5. Classifies wind, rain, snow, and load-dependent risk boundaries.
      6. Calculates Severe miles, High miles, distance-weighted average risk, and travel time.
      7. Applies strict 4-tier lexicographical recommendation and excludes No Travel routes.
      8. Assembles warnings for unavailable forecasts or corridor constraints.

    Returns:
        Structured response dictionary matching the production planning API schema.
    """
    # 1. Input Validation
    if not origin:
        raise InvalidTripInputError("'origin' field is required.")
    if isinstance(origin, str) and not origin.strip():
        raise InvalidTripInputError("'origin' cannot be empty.")

    if not destination:
        raise InvalidTripInputError("'destination' field is required.")
    if isinstance(destination, str) and not destination.strip():
        raise InvalidTripInputError("'destination' cannot be empty.")

    # Timezone-aware departure validation
    dep_dt, normalized_dep_str = validate_departure_time_with_timezone(departure_time)

    # Cargo load weight validation
    if load_weight_lb is None or load_weight_lb == "":
        raise InvalidTripInputError("'load_weight_lb' is required (truck cargo weight in pounds).")
    try:
        load_lb = float(load_weight_lb)
    except (TypeError, ValueError):
        raise InvalidTripInputError(
            f"Invalid 'load_weight_lb': '{load_weight_lb}'. Must be a positive numeric value in pounds."
        )
    if load_lb < 0:
        raise InvalidTripInputError(
            f"'load_weight_lb' must be non-negative. Received: {load_lb}"
        )

    # Sampling interval validation
    if sampling_interval_miles is None or sampling_interval_miles == "":
        raise InvalidTripInputError(
            f"'sampling_interval_miles' is required and must be one of {VALID_SAMPLING_INTERVALS_MILES}."
        )
    try:
        interval_mi = int(sampling_interval_miles)
        if interval_mi not in VALID_SAMPLING_INTERVALS_MILES:
            raise InvalidTripInputError(
                f"'sampling_interval_miles' must be one of {VALID_SAMPLING_INTERVALS_MILES}. Received: {sampling_interval_miles}"
            )
    except (TypeError, ValueError):
        raise InvalidTripInputError(
            f"'sampling_interval_miles' must be an integer ({VALID_SAMPLING_INTERVALS_MILES}). Received: {sampling_interval_miles}"
        )

    # Max alternatives bound
    try:
        bounded_max_alt = min(max(int(max_alternatives), 1), 3)
    except (TypeError, ValueError):
        bounded_max_alt = 3

    # 2. Routing Provider Resolution & Route Alternatives
    provider = get_routing_provider(provider_name)
    origin_loc = provider.geocode(origin)
    dest_loc = provider.geocode(destination)

    # Prevent identical coordinates
    if (
        abs(origin_loc.coordinates[0] - dest_loc.coordinates[0]) < 1e-5
        and abs(origin_loc.coordinates[1] - dest_loc.coordinates[1]) < 1e-5
    ):
        raise InvalidTripInputError("Origin and destination cannot be the same location.")

    # Fetch up to 3 genuine alternative routes (never duplicate or fabricate)
    raw_routes = provider.get_routes(
        origin_coords=origin_loc.coordinates,
        dest_coords=dest_loc.coordinates,
        max_alternatives=bounded_max_alt,
    )
    if not raw_routes:
        raise NoRoutesFoundError("No routes could be found between origin and destination.")

    warnings: List[str] = []

    if len(raw_routes) < bounded_max_alt:
        warnings.append(
            f"Routing provider returned {len(raw_routes)} genuine alternative route(s) for this corridor "
            f"(target was {bounded_max_alt}). No routes were duplicated or fabricated."
        )

    # Horizon warnings
    now_utc = datetime.now(timezone.utc)
    hours_to_departure = (dep_dt - now_utc).total_seconds() / 3600.0
    if hours_to_departure < -24:
        warnings.append("Departure time is more than 24 hours in the past; historical forecast accuracy may vary.")
    elif hours_to_departure > 140:
        warnings.append("Departure time approaches the 168-hour (7-day) forecast horizon; late checkpoints may lack forecast data.")

    # 3. Checkpoint Generation, Weather Enrichment, and Risk Evaluation for each route
    route_dicts: List[Dict[str, Any]] = []

    for r in raw_routes:
        rt_dict = r.to_dict()
        coords = rt_dict.get("geometry", {}).get("coordinates", [])
        duration_s = rt_dict.get("duration_seconds", 0.0)

        # Generate checkpoints along actual road geometry
        checkpoints = generate_checkpoints(
            route_coordinates=coords,
            departure_time=normalized_dep_str,
            duration_seconds=duration_s,
            interval_miles=interval_mi,
        )

        # Retrieve normalized hourly forecasts from Open-Meteo
        try:
            enrich_checkpoints_with_weather(
                checkpoints,
                reference_time_iso=normalized_dep_str,
                load_weight_lb=load_lb,
                include_timeline=True,
            )
        except TypeError:
            enrich_checkpoints_with_weather(checkpoints)

        cp_results = []
        has_no_travel = False
        unavailable_cp_indices: List[int] = []

        for cp in checkpoints:
            cp_d = cp.to_dict()
            risk_eval = evaluate_checkpoint_risk(cp.weather, load_weight_lb=load_lb)
            if risk_eval.is_no_travel:
                has_no_travel = True

            # Safely check is_available whether cp.weather is a dict or NormalizedWeather object
            w_avail = True
            if cp.weather:
                if isinstance(cp.weather, dict):
                    w_avail = cp.weather.get("is_available", False)
                else:
                    w_avail = getattr(cp.weather, "is_available", False)
            else:
                w_avail = False

            if not w_avail:
                unavailable_cp_indices.append(cp.index)

            cp_d["risk"] = risk_eval.to_dict()
            cp_results.append(cp_d)

        if unavailable_cp_indices:
            warnings.append(
                f"{rt_dict.get('name', rt_dict.get('id'))}: Weather forecast unavailable for checkpoint(s) "
                f"{unavailable_cp_indices}. Route safety cannot be guaranteed; route excluded from recommendation."
            )

        rt_dict["checkpoints_count"] = len(cp_results)
        rt_dict["checkpoints"] = cp_results
        rt_dict["has_no_travel"] = has_no_travel

        dest_arrival_iso = cp_results[-1].get("estimated_arrival_time") if cp_results else None
        rt_dict["arrival_time"] = dest_arrival_iso
        rt_dict["estimated_arrival_time"] = dest_arrival_iso

        # Compute risk metrics across segments
        total_dist_miles = float(rt_dict.get("distance_miles", 0.0))
        metrics = calculate_route_risk_metrics(
            checkpoints=cp_results,
            total_distance_miles=total_dist_miles,
            travel_time_seconds=duration_s,
            travel_time_formatted=rt_dict.get("duration_formatted", ""),
        )
        metrics_dict = metrics.to_dict()
        if dest_arrival_iso:
            metrics_dict["estimated_arrival_formatted"] = dest_arrival_iso
        rt_dict["metrics"] = metrics_dict
        route_dicts.append(rt_dict)

    # 4. Strict 4-Tier Lexicographical Recommendation
    ranked_routes, recommendation = rank_and_recommend_routes(route_dicts)

    for rt in ranked_routes:
        rt["is_recommended"] = (rt.get("id") == recommendation.recommended_route_id)

    # 5. Generate Stable Sequential Trip ID (e.g. TRP-YYYYMMDD-001)
    now_utc = datetime.now(timezone.utc)
    date_code = now_utc.strftime("%Y%m%d")
    trip_id = f"TRP-{date_code}-001"
    try:
        from routing.models import TripPlan
        count_today = TripPlan.objects.filter(trip_id__startswith=f"TRP-{date_code}").count()
        trip_id = f"TRP-{date_code}-{count_today + 1:03d}"
    except Exception:
        pass

    # 6. Assemble Production Response
    response_payload = {
        "status": "success",
        "trip": {
            "trip_id": trip_id,
            "origin": origin_loc.to_dict(),
            "destination": dest_loc.to_dict(),
            "departure_time": normalized_dep_str,
            "forecast_reference_time": normalized_dep_str,
            "forecast_horizon_hours": 48,
            "load_weight_lb": load_lb,
            "sampling_interval_miles": interval_mi,
            "provider": provider.provider_name,
            "requested_at": now_utc.isoformat(),
            "coordinate_convention": COORDINATE_CONVENTION,
        },
        "routes_count": len(ranked_routes),
        "routes": ranked_routes,
        "recommendation": recommendation.to_dict(),
        "warnings": warnings,
        "units": STANDARD_UNITS,
    }

    # 7. Persist Trip Record in SQLite
    try:
        from routing.models import TripPlan
        winning_rt = next((r for r in ranked_routes if r.get("id") == recommendation.recommended_route_id), ranked_routes[0])
        w_metrics = winning_rt.get("metrics", {})
        w_risk_level = "Low"
        if w_metrics.get("has_no_travel"):
            w_risk_level = "No Travel"
        elif w_metrics.get("severe_miles", 0) > 0:
            w_risk_level = "Severe"
        elif w_metrics.get("high_miles", 0) > 0:
            w_risk_level = "High"
        elif w_metrics.get("moderate_miles", 0) > 0:
            w_risk_level = "Moderate"

        TripPlan.objects.create(
            trip_id=trip_id,
            origin_name=origin_loc.display_name,
            destination_name=dest_loc.display_name,
            departure_time=dep_dt,
            departure_time_iso=normalized_dep_str,
            arrival_time_iso=winning_rt.get("arrival_time", ""),
            cargo_weight_lb=load_lb,
            checkpoint_interval_miles=interval_mi,
            status="completed" if not w_metrics.get("has_no_travel") else "failed",
            recommended_route_id=winning_rt.get("id", ""),
            recommended_route_name=winning_rt.get("name", "Route A"),
            distance_miles=float(winning_rt.get("distance_miles", 0.0)),
            travel_time_seconds=float(winning_rt.get("duration_seconds", 0.0)),
            travel_time_formatted=winning_rt.get("duration_formatted", ""),
            severe_miles=float(w_metrics.get("severe_miles", 0.0)),
            high_miles=float(w_metrics.get("high_miles", 0.0)),
            average_risk=float(w_metrics.get("distance_weighted_average_risk", 0.0)),
            risk_level=w_risk_level,
            routes_count=len(ranked_routes),
            full_plan_payload=response_payload,
        )
    except Exception as db_err:
        print(f"Warning: Could not persist trip to database: {db_err}")

    return response_payload
