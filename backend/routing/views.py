from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone

from .services import (
    preview_routes,
    plan_trip,
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
        "phase": 6,
    })

@api_view(['GET'])
def location_autocomplete(request):
    """
    GET /api/locations/autocomplete/?q=<query>
    Returns location suggestions with names, categories, and coordinates.
    """
    from .services.autocomplete import get_location_suggestions
    query = request.GET.get('q', '').strip()
    limit = int(request.GET.get('limit', 5))
    results = get_location_suggestions(query, limit=limit)
    return Response({"status": "success", "query": query, "suggestions": results})

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

@api_view(['POST'])
def route_plan(request):
    """
    POST /api/routes/plan/
    Production-oriented end-to-end trip planning endpoint.
    Accepts:
        - origin: string or [lon, lat] (required)
        - destination: string or [lon, lat] (required)
        - departure_time: ISO 8601 string with explicit timezone (required)
        - load_weight_lb: float cargo weight in pounds (required, >= 0)
        - sampling_interval_miles: 10, 25, or 50 (required)
        - provider (optional): 'openrouteservice', 'mapbox', or 'osrm'
        - max_alternatives (optional): int (1 to 3, default 3)
    Returns:
        Complete trip planning analysis including genuine routes, road-geometry checkpoints,
        time-aware weather forecasts, load-dependent risks, risk metrics, strict lexicographical
        recommendation, and corridor warnings.
    """
    payload = request.data
    if not isinstance(payload, dict):
        return Response(
            {"error": "invalid_payload", "message": "Expected a JSON object in request body."},
            status=status.HTTP_400_BAD_REQUEST
        )

    origin = payload.get("origin")
    destination = payload.get("destination")
    departure_time = payload.get("departure_time")
    load_weight_lb = payload.get("load_weight_lb")
    sampling_interval_miles = payload.get("sampling_interval_miles")
    provider_name = payload.get("provider")
    raw_max_alt = payload.get("max_alternatives", 3)

    try:
        max_alternatives = min(max(int(raw_max_alt), 1), 3)
    except (TypeError, ValueError):
        max_alternatives = 3

    try:
        result = plan_trip(
            origin=origin,
            destination=destination,
            departure_time=departure_time,
            load_weight_lb=load_weight_lb,
            sampling_interval_miles=sampling_interval_miles,
            provider_name=provider_name,
            max_alternatives=max_alternatives,
        )
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
    except MissingApiKeyError as e:
        return Response(
            {"error": "missing_credentials", "message": str(e)},
            status=status.HTTP_503_SERVICE_UNAVAILABLE
        )
    except ProviderUnavailableError as e:
        return Response(
            {"error": "upstream_provider_unavailable", "message": str(e)},
            status=status.HTTP_502_BAD_GATEWAY
        )
    except Exception as e:
        return Response(
            {"error": "internal_error", "message": f"Unexpected error while planning trip: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# ============================================================================
# TRIP HISTORY ENDPOINTS
# ============================================================================

from django.http import HttpResponse
from django.db.models import Q
from datetime import datetime, timedelta
import csv
import io
import json
from .models import TripPlan
from .services.history_seeds import ensure_seed_trips


@api_view(['GET'])
def trip_history_list(request):
    """
    GET /api/trips/
    Returns a paginated list of saved trips with search, multi-factor filtering, and sorting.
    """
    ensure_seed_trips()

    queryset = TripPlan.objects.all()

    # Search filter (origin, destination, trip_id, route name)
    search_q = request.GET.get('search', '').strip()
    if search_q:
        queryset = queryset.filter(
            Q(origin_name__icontains=search_q) |
            Q(destination_name__icontains=search_q) |
            Q(trip_id__icontains=search_q) |
            Q(recommended_route_name__icontains=search_q)
        )

    # Status filter: 'completed', 'failed', 'in_progress', or 'all'
    status_filter = request.GET.get('status', '').strip().lower()
    if status_filter and status_filter != 'all':
        queryset = queryset.filter(status__iexact=status_filter)

    # Risk level filter: 'Low', 'Moderate', 'High', 'Severe', 'No Travel'
    risk_filter = request.GET.get('risk', '').strip()
    if risk_filter and risk_filter.lower() != 'all':
        if risk_filter.lower() in ['no travel', 'notravel', 'no_travel']:
            queryset = queryset.filter(risk_level__iexact="No Travel")
        else:
            queryset = queryset.filter(risk_level__iexact=risk_filter.title())

    # Date range filter: '7d', '30d', '3m', '6m', '1y', 'custom'
    date_range = request.GET.get('date_range', '').strip().lower()
    from_date_str = request.GET.get('from', '').strip()
    to_date_str = request.GET.get('to', '').strip()
    now = timezone.now()

    if date_range == '7d':
        queryset = queryset.filter(departure_time__gte=now - timedelta(days=7))
    elif date_range == '30d':
        queryset = queryset.filter(departure_time__gte=now - timedelta(days=30))
    elif date_range == '3m':
        queryset = queryset.filter(departure_time__gte=now - timedelta(days=90))
    elif date_range == '6m':
        queryset = queryset.filter(departure_time__gte=now - timedelta(days=180))
    elif date_range == '1y':
        queryset = queryset.filter(departure_time__gte=now - timedelta(days=365))
    elif date_range == 'custom' or from_date_str or to_date_str:
        if from_date_str:
            try:
                from_dt = datetime.strptime(from_date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
                queryset = queryset.filter(departure_time__gte=from_dt)
            except ValueError:
                pass
        if to_date_str:
            try:
                to_dt = datetime.strptime(to_date_str, "%Y-%m-%d").replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
                queryset = queryset.filter(departure_time__lte=to_dt)
            except ValueError:
                pass

    # Sorting
    sort_by = request.GET.get('sort_by', 'departure_time').strip().lower()
    sort_dir = request.GET.get('sort_dir', 'desc').strip().lower()
    sort_map = {
        'departure_time': 'departure_time',
        'date': 'departure_time',
        'distance': 'distance_miles',
        'risk': 'average_risk',
        'status': 'status',
        'trip_id': 'trip_id',
        'created_at': 'created_at',
    }
    db_field = sort_map.get(sort_by, 'departure_time')
    order_clause = f"-{db_field}" if sort_dir == 'desc' else db_field
    queryset = queryset.order_by(order_clause)

    # Pagination
    total_count = queryset.count()
    try:
        page_size = max(1, min(int(request.GET.get('page_size', 10)), 100))
    except (TypeError, ValueError):
        page_size = 10

    total_pages = max(1, (total_count + page_size - 1) // page_size)
    try:
        page = max(1, min(int(request.GET.get('page', 1)), total_pages))
    except (TypeError, ValueError):
        page = 1

    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    page_items = queryset[start_idx:end_idx]

    return Response({
        "status": "success",
        "total_count": total_count,
        "total_pages": total_pages,
        "current_page": page,
        "page_size": page_size,
        "results": [item.to_summary_dict() for item in page_items]
    })


@api_view(['GET', 'DELETE'])
def trip_detail_view(request, trip_id):
    """
    GET /api/trips/{trip_id}/
    DELETE /api/trips/{trip_id}/
    Retrieves full stored trip result without recalculating routes or refetching forecasts,
    or deletes the trip record.
    """
    try:
        trip = TripPlan.objects.get(trip_id=trip_id)
    except TripPlan.DoesNotExist:
        return Response(
            {"error": "not_found", "message": f"Trip plan with ID '{trip_id}' does not exist."},
            status=status.HTTP_404_NOT_FOUND
        )

    if request.method == 'DELETE':
        trip.delete()
        return Response({
            "status": "success",
            "message": f"Trip {trip_id} deleted successfully.",
            "trip_id": trip_id
        }, status=status.HTTP_200_OK)

    # Ensure plan payload contains valid routes
    plan_payload = trip.full_plan_payload or {}
    if not plan_payload or not plan_payload.get("routes"):
        # Synthesize fallback route from stored metrics
        plan_payload = {
            "status": "success",
            "trip_id": trip.trip_id,
            "trip": {
                "origin": {"name": trip.origin_name, "coordinates": [-87.6298, 41.8781]},
                "destination": {"name": trip.destination_name, "coordinates": [-74.0060, 40.7128]},
                "departure_time": trip.departure_time_iso or trip.departure_time.isoformat(),
                "cargo_weight_lb": trip.cargo_weight_lb,
                "checkpoint_interval_miles": trip.checkpoint_interval_miles,
                "status": trip.status,
            },
            "routes_count": trip.routes_count,
            "routes": [
                {
                    "id": trip.recommended_route_id or "route-1",
                    "name": trip.recommended_route_name or "Route A",
                    "distance_miles": trip.distance_miles,
                    "duration_seconds": trip.travel_time_seconds,
                    "duration_formatted": trip.travel_time_formatted,
                    "arrival_time": trip.arrival_time_iso,
                    "is_recommended": True,
                    "is_eligible": trip.status == "completed",
                    "status": "Recommended",
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [[-87.6298, 41.8781], [-74.0060, 40.7128]],
                    },
                    "metrics": {
                        "distance_miles": trip.distance_miles,
                        "duration_seconds": trip.travel_time_seconds,
                        "duration_formatted": trip.travel_time_formatted,
                        "severe_miles": trip.severe_miles,
                        "high_miles": trip.high_miles,
                        "distance_weighted_average_risk": trip.average_risk,
                        "has_no_travel": trip.status == "failed",
                        "is_eligible": trip.status == "completed",
                    },
                    "checkpoints": [],
                }
            ],
            "recommendation": {
                "recommended_route_id": trip.recommended_route_id or "route-1",
                "recommended_route_name": trip.recommended_route_name or "Route A",
                "explanation": f"Historical route plan for {trip.origin_name} to {trip.destination_name} with {trip.risk_level} risk classification.",
                "rankings": []
            },
            "warnings": [],
            "units": {
                "distance": "miles",
                "duration": "seconds",
                "wind_speed": "mph",
                "precipitation": "in/hr",
                "snowfall": "in/hr",
                "load_weight": "lb",
                "temperature": "fahrenheit"
            }
        }

    return Response({
        "status": "success",
        "trip_id": trip.trip_id,
        "summary": trip.to_summary_dict(),
        "plan": plan_payload
    })


@api_view(['POST'])
def trip_replan_view(request, trip_id):
    """
    POST /api/trips/{trip_id}/replan/
    Creates a NEW trip plan using the historical inputs (origin, destination, cargo weight, interval).
    Preserves the original trip record untouched and returns the newly planned trip result.
    """
    try:
        old_trip = TripPlan.objects.get(trip_id=trip_id)
    except TripPlan.DoesNotExist:
        return Response(
            {"error": "not_found", "message": f"Historical trip '{trip_id}' not found."},
            status=status.HTTP_404_NOT_FOUND
        )

    # Use current time as new departure
    now_iso = timezone.now().isoformat()
    try:
        new_result = plan_trip(
            origin=old_trip.origin_name,
            destination=old_trip.destination_name,
            departure_time=now_iso,
            load_weight_lb=old_trip.cargo_weight_lb,
            sampling_interval_miles=old_trip.checkpoint_interval_miles,
            max_alternatives=3,
        )
        return Response({
            "status": "success",
            "message": f"Successfully replanned trip from historical plan {trip_id}.",
            "original_trip_id": old_trip.trip_id,
            "new_trip_id": new_result.get("trip_id"),
            "plan": new_result
        }, status=status.HTTP_201_CREATED)
    except Exception as e:
        return Response(
            {"error": "replan_failed", "message": f"Failed to replan historical trip: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
def trip_export_view(request):
    """
    POST /api/trips/export/
    Exports saved trips to CSV or JSON format.
    Accepts:
        - format: 'csv' | 'json'
        - trip_ids: list of trip IDs (optional)
        - scope: { include_summary: bool, include_routes: bool, include_checkpoints: bool, include_weather: bool }
    """
    data = request.data or {}
    export_format = data.get('format', 'csv').lower()
    trip_ids = data.get('trip_ids', [])
    scope = data.get('scope', {
        'include_summary': True,
        'include_routes': True,
        'include_checkpoints': True,
        'include_weather': False,
    })

    queryset = TripPlan.objects.all()
    if trip_ids:
        queryset = queryset.filter(trip_id__in=trip_ids)

    # If format is CSV
    if export_format == 'csv':
        buffer = io.StringIO()
        writer = csv.writer(buffer)

        # Header row
        writer.writerow([
            "Trip ID",
            "Origin",
            "Destination",
            "Departure Time",
            "Estimated Arrival",
            "Distance (mi)",
            "Travel Time",
            "Recommended Route",
            "Avg Risk Score",
            "Risk Level",
            "Severe Miles",
            "High Miles",
            "Cargo Weight (lb)",
            "Interval (mi)",
            "Status",
            "Created At",
        ])

        for trip in queryset:
            writer.writerow([
                trip.trip_id,
                trip.origin_name,
                trip.destination_name,
                trip.departure_time_iso or trip.departure_time.isoformat(),
                trip.arrival_time_iso,
                round(trip.distance_miles, 1),
                trip.travel_time_formatted,
                trip.recommended_route_name,
                round(trip.average_risk, 2),
                trip.risk_level,
                round(trip.severe_miles, 1),
                round(trip.high_miles, 1),
                trip.cargo_weight_lb,
                trip.checkpoint_interval_miles,
                trip.status.capitalize(),
                trip.created_at.isoformat(),
            ])

        response = HttpResponse(buffer.getvalue(), content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="spotter_trips_export.csv"'
        return response

    # If format is JSON
    export_data = []
    for trip in queryset:
        item = {
            "summary": trip.to_summary_dict() if scope.get('include_summary', True) else {},
        }
        if scope.get('include_routes', True) or scope.get('include_checkpoints', True):
            item["plan"] = trip.full_plan_payload
        export_data.append(item)

    response = HttpResponse(json.dumps(export_data, indent=2), content_type='application/json')
    response['Content-Disposition'] = 'attachment; filename="spotter_trips_export.json"'
    return response


