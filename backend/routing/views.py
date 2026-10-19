from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone

from .services import (
    preview_routes,
    InvalidTripInputError,
    GeocodingError,
    MissingApiKeyError,
    NoRoutesFoundError,
    RateLimitError,
    ProviderUnavailableError,
)
from .checkpoints import (
    generate_checkpoints,
    VALID_SAMPLING_INTERVALS_MILES,
)
from .weather import (
    enrich_checkpoints_with_weather,
)
from .risk import (
    evaluate_checkpoint_risk,
)
from .recommendation import (
    rank_and_recommend_routes,
    calculate_route_risk_metrics,
)

@api_view(['GET'])
def health_check(request):
    """
    Health check endpoint.
    Returns status, service identifier, server timestamp, and active phase.
    """
    return Response({
        "status": "healthy",
        "service": "spotter-weather-routing-backend",
        "timestamp": timezone.now().isoformat(),
        "phase": 5,
    })

@api_view(['POST'])
def route_preview(request):
    """
    POST /api/routes/preview/
    Accepts:
        - origin: string or [lon, lat]
        - destination: string or [lon, lat]
        - provider (optional): 'openrouteservice', 'mapbox', or 'osrm'
        - max_alternatives (optional, default 3, max 3)
        - departure_time (optional): ISO 8601 string
        - load_weight_lb (optional, default 40,000 lb)
        - sampling_interval_miles (optional): 10, 25, or 50
    """
    payload = request.data
    if not isinstance(payload, dict):
        return Response(
            {"error": "invalid_payload", "message": "Expected a JSON object in request body."},
            status=status.HTTP_400_BAD_REQUEST
        )

    origin = payload.get("origin")
    destination = payload.get("destination")
    provider_name = payload.get("provider")
    raw_max_alt = payload.get("max_alternatives", 3)
    departure_time = payload.get("departure_time")
    raw_interval = payload.get("sampling_interval_miles", 25)
    raw_load = payload.get("load_weight_lb", 40000.0)

    try:
        max_alternatives = min(max(int(raw_max_alt), 1), 3)
    except (TypeError, ValueError):
        max_alternatives = 3

    try:
        load_weight_lb = max(0.0, float(raw_load))
    except (TypeError, ValueError):
        load_weight_lb = 40000.0

    try:
        interval_miles = int(raw_interval)
        if interval_miles not in VALID_SAMPLING_INTERVALS_MILES:
            return Response(
                {
                    "error": "invalid_interval",
                    "message": f"sampling_interval_miles must be one of {VALID_SAMPLING_INTERVALS_MILES}. Received: {raw_interval}"
                },
                status=status.HTTP_400_BAD_REQUEST
            )
    except (TypeError, ValueError):
        interval_miles = 25

    if not origin:
        return Response(
            {"error": "missing_field", "field": "origin", "message": "'origin' field is required."},
            status=status.HTTP_400_BAD_REQUEST
        )

    if not destination:
        return Response(
            {"error": "missing_field", "field": "destination", "message": "'destination' field is required."},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        result = preview_routes(
            origin=origin,
            destination=destination,
            max_alternatives=max_alternatives,
            provider_name=provider_name,
        )

        routes = result.get("routes", [])

        # If departure_time is provided, sample checkpoints and enrich with weather & risk
        if departure_time:
            result["load_weight_lb"] = load_weight_lb
            for rt in routes:
                coords = rt.get("geometry", {}).get("coordinates", [])
                duration_s = rt.get("duration_seconds", 0.0)
                try:
                    checkpoints = generate_checkpoints(
                        route_coordinates=coords,
                        departure_time=departure_time,
                        duration_seconds=duration_s,
                        interval_miles=interval_miles,
                    )
                    enrich_checkpoints_with_weather(checkpoints)

                    cp_dicts = []
                    has_no_travel = False
                    for cp in checkpoints:
                        risk_eval = evaluate_checkpoint_risk(cp.weather, load_weight_lb)
                        if risk_eval.is_no_travel:
                            has_no_travel = True
                        cp_d = cp.to_dict()
                        cp_d["risk"] = risk_eval.to_dict()
                        cp_dicts.append(cp_d)

                    rt["checkpoints_count"] = len(cp_dicts)
                    rt["checkpoints"] = cp_dicts
                    rt["has_no_travel"] = has_no_travel
                except Exception as cp_err:
                    rt["checkpoints_error"] = str(cp_err)
                    rt["checkpoints"] = []

            # Perform strict lexicographical route ranking and recommendation
            routes, recommendation = rank_and_recommend_routes(routes)
            for rt in routes:
                rt["is_recommended"] = (rt.get("id") == recommendation.recommended_route_id)

            result["routes"] = routes
            result["recommendation"] = recommendation.to_dict()

        return Response(result, status=status.HTTP_200_OK)

    except InvalidTripInputError as e:
        return Response(
            {"error": "invalid_input", "message": str(e)},
            status=status.HTTP_400_BAD_REQUEST
        )
    except GeocodingError as e:
        return Response(
            {"error": "geocoding_failed", "message": str(e)},
            status=status.HTTP_404_NOT_FOUND
        )
    except MissingApiKeyError as e:
        return Response(
            {"error": "missing_credentials", "message": str(e)},
            status=status.HTTP_503_SERVICE_UNAVAILABLE
        )
    except NoRoutesFoundError as e:
        return Response(
            {"error": "no_routes_found", "message": str(e)},
            status=status.HTTP_404_NOT_FOUND
        )
    except RateLimitError as e:
        return Response(
            {"error": "rate_limit_exceeded", "message": str(e)},
            status=status.HTTP_429_TOO_MANY_REQUESTS
        )
    except ProviderUnavailableError as e:
        return Response(
            {"error": "upstream_provider_unavailable", "message": str(e)},
            status=status.HTTP_502_BAD_GATEWAY
        )
    except Exception as e:
        return Response(
            {"error": "internal_error", "message": f"Unexpected error while processing route preview: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
def route_checkpoints(request):
    """
    POST /api/routes/checkpoints/
    Generates time-aware checkpoints, retrieves weather forecasts, and classifies risks.
    Accepts:
        - route_coordinates: list of [lon, lat] points (at least 2 points)
        - departure_time: ISO 8601 string
        - duration_seconds: float
        - load_weight_lb: float (default: 40000.0)
        - sampling_interval_miles: 10, 25, or 50 (default: 25)
        - include_weather: bool (default: True)
    """
    payload = request.data
    if not isinstance(payload, dict):
        return Response(
            {"error": "invalid_payload", "message": "Expected a JSON object in request body."},
            status=status.HTTP_400_BAD_REQUEST
        )

    coords = payload.get("route_coordinates")
    departure_time = payload.get("departure_time")
    duration_s = payload.get("duration_seconds")
    raw_interval = payload.get("sampling_interval_miles", 25)
    raw_load = payload.get("load_weight_lb", 40000.0)
    include_weather = payload.get("include_weather", True)

    if not coords or not isinstance(coords, list) or len(coords) < 2:
        return Response(
            {"error": "invalid_coordinates", "message": "route_coordinates must be a list containing at least 2 [lon, lat] points."},
            status=status.HTTP_400_BAD_REQUEST
        )

    if not departure_time:
        return Response(
            {"error": "missing_field", "field": "departure_time", "message": "'departure_time' is required."},
            status=status.HTTP_400_BAD_REQUEST
        )

    if duration_s is None:
        return Response(
            {"error": "missing_field", "field": "duration_seconds", "message": "'duration_seconds' is required."},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        load_weight_lb = max(0.0, float(raw_load))
    except (TypeError, ValueError):
        load_weight_lb = 40000.0

    try:
        interval_miles = int(raw_interval)
        if interval_miles not in VALID_SAMPLING_INTERVALS_MILES:
            return Response(
                {
                    "error": "invalid_interval",
                    "message": f"sampling_interval_miles must be one of {VALID_SAMPLING_INTERVALS_MILES}. Received: {raw_interval}"
                },
                status=status.HTTP_400_BAD_REQUEST
            )
    except (TypeError, ValueError):
        return Response(
            {"error": "invalid_interval", "message": "sampling_interval_miles must be an integer (10, 25, or 50)."},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        checkpoints = generate_checkpoints(
            route_coordinates=coords,
            departure_time=departure_time,
            duration_seconds=float(duration_s),
            interval_miles=interval_miles,
        )

        if include_weather:
            enrich_checkpoints_with_weather(checkpoints)

        checkpoint_results = []
        for cp in checkpoints:
            cp_dict = cp.to_dict()
            risk_eval = evaluate_checkpoint_risk(cp.weather, load_weight_lb)
            cp_dict["risk"] = risk_eval.to_dict()
            checkpoint_results.append(cp_dict)

        # Compute route metrics for these checkpoints
        total_dist_miles = float(checkpoints[-1].cumulative_distance_miles) if checkpoints else 0.0
        metrics = calculate_route_risk_metrics(
            checkpoint_results,
            total_distance_miles=total_dist_miles,
            travel_time_seconds=float(duration_s),
        )

        return Response({
            "status": "success",
            "sampling_interval_miles": interval_miles,
            "load_weight_lb": load_weight_lb,
            "checkpoints_count": len(checkpoint_results),
            "checkpoints": checkpoint_results,
            "metrics": metrics.to_dict(),
            "units": {
                "wind_speed": "mph",
                "precipitation": "in/hr",
                "snowfall": "in/hr",
                "load_weight": "lb",
                "temperature": "fahrenheit",
                "cumulative_distance": "miles",
                "segment_distance": "miles"
            }
        }, status=status.HTTP_200_OK)

    except ValueError as e:
        return Response({"error": "invalid_input", "message": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response({"error": "checkpoint_generation_failed", "message": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
