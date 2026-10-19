"""
OpenRouteService Routing Provider.
Implements geocoding and alternative routes generation via OpenRouteService API.
"""

import os
import requests
from typing import List, Tuple, Dict, Any, Union
from .base import BaseRoutingProvider, NormalizedRoute, ResolvedLocation, METERS_TO_MILES, format_duration
from .exceptions import (
    MissingApiKeyError,
    GeocodingError,
    ProviderUnavailableError,
    RateLimitError,
    NoRoutesFoundError,
    InvalidTripInputError,
)

class OpenRouteServiceProvider(BaseRoutingProvider):
    provider_name = "openrouteservice"
    BASE_URL = "https://api.openrouteservice.org"

    def __init__(self, api_key: str = None, timeout: int = 15):
        self.api_key = api_key or os.getenv("ROUTING_API_KEY") or os.getenv("OPENROUTESERVICE_API_KEY")
        self.timeout = timeout

    def _require_api_key(self):
        if not self.api_key or self.api_key.strip() == "" or "your_" in self.api_key.lower():
            raise MissingApiKeyError(
                "Routing provider 'openrouteservice' requires a valid ROUTING_API_KEY in backend/.env. "
                "Please configure an OpenRouteService API key or use ROUTING_PROVIDER=osrm."
            )

    def geocode(self, location: Union[str, List[float], Tuple[float, float], Dict[str, float]]) -> ResolvedLocation:
        """
        Resolves location string or coordinate pair to a ResolvedLocation with [lon, lat].
        """
        # If coordinates are already supplied as list or tuple
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

        # Check if string is direct "lat,lon" or "lon,lat"
        if "," in query:
            parts = [p.strip() for p in query.split(",")]
            if len(parts) == 2:
                try:
                    p1, p2 = float(parts[0]), float(parts[1])
                    # If first part is lat (-90 to 90) and second is lon (-180 to 180)
                    if -90 <= p1 <= 90 and -180 <= p2 <= 180 and not (-180 <= p1 <= 180 and -90 <= p2 <= 90):
                        return ResolvedLocation(query=query, display_name=f"({p1:.4f}, {p2:.4f})", coordinates=[p2, p1])
                    if -180 <= p1 <= 180 and -90 <= p2 <= 90:
                        return ResolvedLocation(query=query, display_name=f"({p2:.4f}, {p1:.4f})", coordinates=[p1, p2])
                except ValueError:
                    pass  # Not raw numbers, treat as textual place query

        self._require_api_key()

        url = f"{self.BASE_URL}/geocode/search"
        params = {
            "api_key": self.api_key,
            "text": query,
            "size": 1,
        }

        try:
            response = requests.get(url, params=params, timeout=self.timeout)
        except requests.exceptions.Timeout:
            raise ProviderUnavailableError("OpenRouteService geocoding request timed out.")
        except requests.exceptions.RequestException as e:
            raise ProviderUnavailableError(f"Failed to reach OpenRouteService geocoding: {str(e)}")

        if response.status_code == 429:
            raise RateLimitError("OpenRouteService rate limit exceeded during geocoding.")
        if response.status_code in (401, 403):
            raise MissingApiKeyError("Invalid or unauthorized OpenRouteService API key.")
        if response.status_code >= 500:
            raise ProviderUnavailableError(f"OpenRouteService geocode service error: HTTP {response.status_code}")

        data = response.json()
        features = data.get("features", [])
        if not features:
            raise GeocodingError(f"Location not found: '{query}'")

        feature = features[0]
        coords = feature.get("geometry", {}).get("coordinates", [])
        if len(coords) < 2:
            raise GeocodingError(f"Malformed geocoding response for '{query}'")

        label = feature.get("properties", {}).get("label") or query
        return ResolvedLocation(
            query=query,
            display_name=label,
            coordinates=[float(coords[0]), float(coords[1])]
        )

    def get_routes(
        self,
        origin_coords: List[float],
        dest_coords: List[float],
        max_alternatives: int = 3
    ) -> List[NormalizedRoute]:
        self._require_api_key()

        url = f"{self.BASE_URL}/v2/directions/driving-car/geojson"
        headers = {
            "Authorization": self.api_key,
            "Content-Type": "application/json",
            "Accept": "application/json, application/geo+json",
        }

        body: Dict[str, Any] = {
            "coordinates": [origin_coords, dest_coords],
        }

        if max_alternatives > 1:
            body["alternative_routes"] = {
                "target_count": min(max_alternatives, 3),
                "weight_factor": 1.4,
                "share_factor": 0.6
            }

        try:
            response = requests.post(url, json=body, headers=headers, timeout=self.timeout)
        except requests.exceptions.Timeout:
            raise ProviderUnavailableError("OpenRouteService directions request timed out.")
        except requests.exceptions.RequestException as e:
            raise ProviderUnavailableError(f"Failed to reach OpenRouteService directions: {str(e)}")

        if response.status_code == 429:
            raise RateLimitError("OpenRouteService rate limit exceeded.")
        if response.status_code in (401, 403):
            raise MissingApiKeyError("Invalid or unauthorized OpenRouteService API key.")
        if response.status_code == 404 or response.status_code == 400:
            err_msg = response.text
            try:
                err_json = response.json()
                err_msg = err_json.get("error", {}).get("message") or err_msg
            except Exception:
                pass
            raise NoRoutesFoundError(f"No route found between coordinates: {err_msg}")
        if response.status_code >= 500:
            raise ProviderUnavailableError(f"OpenRouteService upstream server error: HTTP {response.status_code}")

        data = response.json()
        features = data.get("features", [])
        if not features:
            raise NoRoutesFoundError("No routes returned by OpenRouteService.")

        normalized_routes: List[NormalizedRoute] = []
        for idx, feat in enumerate(features[:max_alternatives]):
            props = feat.get("properties", {})
            summary = props.get("summary", {})
            geom = feat.get("geometry", {})
            coords = geom.get("coordinates", [])

            dist_m = float(summary.get("distance", 0.0))
            dur_s = float(summary.get("duration", 0.0))

            route_id = f"route-{idx + 1}"
            route_name = f"Route {idx + 1}"
            summary_desc = f"Via alternative {idx + 1}"

            # Attempt to extract road names from segments if available
            segments = props.get("segments", [])
            if segments and isinstance(segments, list):
                steps = segments[0].get("steps", [])
                major_roads = [
                    s.get("name") for s in steps
                    if s.get("name") and s.get("name") not in ("-", "unnamed", "")
                ]
                if major_roads:
                    # Pick most frequent or prominent road name
                    summary_desc = f"Via {major_roads[0]}"
                    route_name = f"Route {idx + 1} ({major_roads[0]})"

            normalized_routes.append(
                NormalizedRoute(
                    id=route_id,
                    name=route_name,
                    distance_meters=round(dist_m, 1),
                    distance_miles=round(dist_m * METERS_TO_MILES, 2),
                    duration_seconds=round(dur_s, 1),
                    duration_hours=round(dur_s / 3600.0, 2),
                    duration_formatted=format_duration(dur_s),
                    summary=summary_desc,
                    geometry={
                        "type": "LineString",
                        "coordinates": coords
                    }
                )
            )

        return normalized_routes
