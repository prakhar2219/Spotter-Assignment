"""
Mapbox Routing Provider.
Implements geocoding and alternative routes generation via Mapbox Directions API.
"""

import os
import requests
from typing import List, Tuple, Dict, Any, Union
from urllib.parse import quote
from .base import BaseRoutingProvider, NormalizedRoute, ResolvedLocation, METERS_TO_MILES, format_duration
from .exceptions import (
    MissingApiKeyError,
    GeocodingError,
    ProviderUnavailableError,
    RateLimitError,
    NoRoutesFoundError,
    InvalidTripInputError,
)

class MapboxProvider(BaseRoutingProvider):
    provider_name = "mapbox"
    BASE_URL = "https://api.mapbox.com"

    def __init__(self, api_key: str = None, timeout: int = 15):
        self.api_key = api_key or os.getenv("MAPBOX_ACCESS_TOKEN") or os.getenv("ROUTING_API_KEY")
        self.timeout = timeout

    def _require_api_key(self):
        if not self.api_key or self.api_key.strip() == "" or "your_" in self.api_key.lower():
            raise MissingApiKeyError(
                "Routing provider 'mapbox' requires a valid MAPBOX_ACCESS_TOKEN or ROUTING_API_KEY in backend/.env."
            )

    def geocode(self, location: Union[str, List[float], Tuple[float, float], Dict[str, float]]) -> ResolvedLocation:
        if isinstance(location, (list, tuple)) and len(location) == 2:
            lon, lat = float(location[0]), float(location[1])
            return ResolvedLocation(
                query=f"{lon},{lat}",
                display_name=f"Coordinates ({lat:.4f}, {lon:.4f})",
                coordinates=[lon, lat]
            )

        if isinstance(location, dict) and "lon" in location and "lat" in location:
            lon, lat = float(location["lon"]), float(location["lat"])
            return ResolvedLocation(
                query=f"{lon},{lat}",
                display_name=f"Coordinates ({lat:.4f}, {lon:.4f})",
                coordinates=[lon, lat]
            )

        if not isinstance(location, str) or not location.strip():
            raise InvalidTripInputError(f"Invalid location input: {location}")

        query = location.strip()
        self._require_api_key()

        url = f"{self.BASE_URL}/geocoding/v5/mapbox.places/{quote(query)}.json"
        params = {
            "access_token": self.api_key,
            "limit": 1,
        }

        try:
            response = requests.get(url, params=params, timeout=self.timeout)
        except requests.exceptions.Timeout:
            raise ProviderUnavailableError("Mapbox geocoding request timed out.")
        except requests.exceptions.RequestException as e:
            raise ProviderUnavailableError(f"Failed to reach Mapbox geocoding: {str(e)}")

        if response.status_code == 429:
            raise RateLimitError("Mapbox rate limit exceeded during geocoding.")
        if response.status_code in (401, 403):
            raise MissingApiKeyError("Invalid or unauthorized Mapbox access token.")
        if response.status_code >= 500:
            raise ProviderUnavailableError(f"Mapbox geocode service error: HTTP {response.status_code}")

        data = response.json()
        features = data.get("features", [])
        if not features:
            raise GeocodingError(f"Location not found: '{query}'")

        feature = features[0]
        center = feature.get("center", [])
        if len(center) < 2:
            raise GeocodingError(f"Malformed geocoding response for '{query}'")

        return ResolvedLocation(
            query=query,
            display_name=feature.get("place_name", query),
            coordinates=[float(center[0]), float(center[1])]
        )

    def get_routes(
        self,
        origin_coords: List[float],
        dest_coords: List[float],
        max_alternatives: int = 3
    ) -> List[NormalizedRoute]:
        self._require_api_key()

        # Mapbox format: {lon1},{lat1};{lon2},{lat2}
        coord_str = f"{origin_coords[0]},{origin_coords[1]};{dest_coords[0]},{dest_coords[1]}"
        url = f"{self.BASE_URL}/directions/v5/mapbox/driving/{coord_str}"
        params = {
            "access_token": self.api_key,
            "alternatives": "true" if max_alternatives > 1 else "false",
            "geometries": "geojson",
            "overview": "full",
            "steps": "true",
        }

        try:
            response = requests.get(url, params=params, timeout=self.timeout)
        except requests.exceptions.Timeout:
            raise ProviderUnavailableError("Mapbox directions request timed out.")
        except requests.exceptions.RequestException as e:
            raise ProviderUnavailableError(f"Failed to reach Mapbox directions: {str(e)}")

        if response.status_code == 429:
            raise RateLimitError("Mapbox rate limit exceeded.")
        if response.status_code in (401, 403):
            raise MissingApiKeyError("Invalid or unauthorized Mapbox access token.")
        if response.status_code >= 500:
            raise ProviderUnavailableError(f"Mapbox upstream server error: HTTP {response.status_code}")

        data = response.json()
        if data.get("code") != "Ok":
            raise NoRoutesFoundError(f"Mapbox could not route trip: {data.get('message', 'Unknown error')}")

        raw_routes = data.get("routes", [])
        if not raw_routes:
            raise NoRoutesFoundError("No routes returned by Mapbox.")

        normalized_routes: List[NormalizedRoute] = []
        for idx, r in enumerate(raw_routes[:max_alternatives]):
            dist_m = float(r.get("distance", 0.0))
            dur_s = float(r.get("duration", 0.0))
            geom = r.get("geometry", {})
            coords = geom.get("coordinates", [])

            legs = r.get("legs", [])
            summary = legs[0].get("summary", f"Alternative {idx + 1}") if legs else f"Alternative {idx + 1}"
            route_name = f"Route {idx + 1} ({summary})" if summary else f"Route {idx + 1}"

            normalized_routes.append(
                NormalizedRoute(
                    id=f"route-{idx + 1}",
                    name=route_name,
                    distance_meters=round(dist_m, 1),
                    distance_miles=round(dist_m * METERS_TO_MILES, 2),
                    duration_seconds=round(dur_s, 1),
                    duration_hours=round(dur_s / 3600.0, 2),
                    duration_formatted=format_duration(dur_s),
                    summary=f"Via {summary}",
                    geometry={
                        "type": "LineString",
                        "coordinates": coords
                    }
                )
            )

        return normalized_routes
