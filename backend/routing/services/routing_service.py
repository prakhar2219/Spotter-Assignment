"""
Routing Service Facade and Provider Factory.
Orchestrates geocoding and alternative route generation.
"""

import os
from typing import Dict, Any, Optional, Union, List, Tuple
from .base import BaseRoutingProvider, NormalizedRoute, ResolvedLocation
from .openrouteservice import OpenRouteServiceProvider
from .mapbox import MapboxProvider
from .osrm import OSRMProvider
from .exceptions import (
    RoutingError,
    MissingApiKeyError,
    GeocodingError,
    ProviderUnavailableError,
    RateLimitError,
    NoRoutesFoundError,
    InvalidTripInputError,
)

def get_routing_provider(provider_name: Optional[str] = None) -> BaseRoutingProvider:
    """
    Factory function to instantiate the configured routing provider.
    Priority:
    1. Explicit provider_name argument
    2. ROUTING_PROVIDER environment variable ('openrouteservice', 'mapbox', 'osrm')
    3. Auto-detected from available API keys
    4. Defaults to 'openrouteservice' (which requires ROUTING_API_KEY)
    """
    selected = provider_name or os.getenv("ROUTING_PROVIDER")
    if not selected:
        if os.getenv("MAPBOX_ACCESS_TOKEN"):
            selected = "mapbox"
        elif os.getenv("ROUTING_API_KEY") or os.getenv("OPENROUTESERVICE_API_KEY"):
            selected = "openrouteservice"
        else:
            selected = "openrouteservice"

    selected = selected.strip().lower()

    if selected in ("openrouteservice", "ors"):
        return OpenRouteServiceProvider()
    elif selected == "mapbox":
        return MapboxProvider()
    elif selected == "osrm":
        return OSRMProvider()
    else:
        raise InvalidTripInputError(
            f"Unsupported routing provider: '{selected}'. "
            "Supported providers: 'openrouteservice', 'mapbox', 'osrm'."
        )

def preview_routes(
    origin: Union[str, List[float], Tuple[float, float], Dict[str, float]],
    destination: Union[str, List[float], Tuple[float, float], Dict[str, float]],
    max_alternatives: int = 3,
    provider_name: Optional[str] = None,
) -> Dict[str, Any]:
    """
    High-level service function to resolve origin/destination and fetch alternative routes.
    Never duplicates or fabricates routes.
    """
    if not origin:
        raise InvalidTripInputError("Origin is required.")
    if not destination:
        raise InvalidTripInputError("Destination is required.")

    provider = get_routing_provider(provider_name)

    # 1. Resolve Origin
    origin_loc = provider.geocode(origin)

    # 2. Resolve Destination
    dest_loc = provider.geocode(destination)

    # 3. Prevent identical origin and destination
    if (
        abs(origin_loc.coordinates[0] - dest_loc.coordinates[0]) < 1e-5
        and abs(origin_loc.coordinates[1] - dest_loc.coordinates[1]) < 1e-5
    ):
        raise InvalidTripInputError("Origin and destination cannot be the same location.")

    # 4. Fetch up to 3 genuine alternative routes
    routes = provider.get_routes(
        origin_coords=origin_loc.coordinates,
        dest_coords=dest_loc.coordinates,
        max_alternatives=max_alternatives,
    )

    if not routes:
        raise NoRoutesFoundError("No routes could be found between origin and destination.")

    return {
        "status": "success",
        "provider": provider.provider_name,
        "origin": origin_loc.to_dict(),
        "destination": dest_loc.to_dict(),
        "routes_count": len(routes),
        "routes": [r.to_dict() for r in routes],
        "coordinate_convention": {
            "format": "GeoJSON [longitude, latitude]",
            "leaflet_note": "Leaflet Polyline expects [latitude, longitude]. Invert coordinates or use L.geoJSON()."
        }
    }
