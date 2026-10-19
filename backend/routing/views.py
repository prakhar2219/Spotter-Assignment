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

@api_view(['GET'])
def health_check(request):
    """
    Health check endpoint for Phase 1 verification.
    Returns status, service identifier, server timestamp, and active phase.
    """
    return Response({
        "status": "healthy",
        "service": "spotter-weather-routing-backend",
        "timestamp": timezone.now().isoformat(),
        "phase": 2,
    })

@api_view(['POST'])
def route_preview(request):
    """
    POST /api/routes/preview/
    Accepts:
        - origin: string (place name) or list [lon, lat]
        - destination: string (place name) or list [lon, lat]
        - provider (optional): 'openrouteservice', 'mapbox', or 'osrm'
        - max_alternatives (optional, default 3, max 3)
    Returns:
        - origin and destination with resolved coordinates
        - up to 3 genuine alternative routes with normalized geometry, distances, and durations.
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

    try:
        max_alternatives = min(max(int(raw_max_alt), 1), 3)
    except (TypeError, ValueError):
        max_alternatives = 3

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
