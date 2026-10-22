"""
OSRM (Open Source Routing Machine) Provider.
Uses OpenStreetMap data for real road geometry, distances, durations, and alternatives.
Uses OpenStreetMap Nominatim for geocoding.
"""

import requests
from typing import List, Tuple, Dict, Any, Union
from urllib.parse import quote
from .base import BaseRoutingProvider, NormalizedRoute, ResolvedLocation, METERS_TO_MILES, format_duration
from .exceptions import (
    GeocodingError,
    ProviderUnavailableError,
    RateLimitError,
    NoRoutesFoundError,
    InvalidTripInputError,
)

class OSRMProvider(BaseRoutingProvider):
    provider_name = "osrm"
    ROUTER_BASE_URL = "https://router.project-osrm.org"
    NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org"

    def __init__(self, timeout: int = 15):
        self.timeout = timeout
        self.headers = {
            "User-Agent": "SpotterTruckRoutingApp/1.0 (Assessment Evaluation)"
        }

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

        # Check if direct coordinates string
        if "," in query:
            parts = [p.strip() for p in query.split(",")]
            if len(parts) == 2:
                try:
                    p1, p2 = float(parts[0]), float(parts[1])
                    if -90 <= p1 <= 90 and -180 <= p2 <= 180:
                        return ResolvedLocation(query=query, display_name=f"({p1:.4f}, {p2:.4f})", coordinates=[p2, p1])
                    if -180 <= p1 <= 180 and -90 <= p2 <= 90:
                        return ResolvedLocation(query=query, display_name=f"({p2:.4f}, {p1:.4f})", coordinates=[p1, p2])
                except ValueError:
                    pass

        url = f"{self.NOMINATIM_BASE_URL}/search"
        params = {
            "q": query,
            "format": "json",
            "limit": 1,
            "addressdetails": 1,
        }

        try:
            response = requests.get(url, params=params, headers=self.headers, timeout=self.timeout)
        except requests.exceptions.Timeout:
            raise ProviderUnavailableError("OSM Nominatim geocoding request timed out.")
        except requests.exceptions.RequestException as e:
            raise ProviderUnavailableError(f"Failed to reach OSM Nominatim geocoding: {str(e)}")

        if response.status_code == 429:
            raise RateLimitError("OSM Nominatim rate limit reached. Please wait a moment.")
        if response.status_code >= 500:
            raise ProviderUnavailableError(f"OSM Nominatim service error: HTTP {response.status_code}")

        data = response.json()
        if not data or not isinstance(data, list):
            raise GeocodingError(f"Location not found: '{query}'")

        place = data[0]
        lon = float(place.get("lon"))
        lat = float(place.get("lat"))
        display_name = place.get("display_name", query)

        return ResolvedLocation(
            query=query,
            display_name=display_name,
            coordinates=[lon, lat]
        )

    def get_routes(
        self,
        origin_coords: List[float],
        dest_coords: List[float],
        max_alternatives: int = 3
    ) -> List[NormalizedRoute]:
        coord_str = f"{origin_coords[0]},{origin_coords[1]};{dest_coords[0]},{dest_coords[1]}"
        url = f"{self.ROUTER_BASE_URL}/route/v1/driving/{coord_str}"
        params = {
            "overview": "full",
            "geometries": "geojson",
            "alternatives": "3" if max_alternatives > 1 else "false",
            "steps": "true",
        }

        try:
            response = requests.get(url, params=params, headers=self.headers, timeout=self.timeout)
        except requests.exceptions.Timeout:
            raise ProviderUnavailableError("OSRM directions request timed out.")
        except requests.exceptions.RequestException as e:
            raise ProviderUnavailableError(f"Failed to reach OSRM routing server: {str(e)}")

        if response.status_code == 429:
            raise RateLimitError("OSRM public rate limit reached. Please wait a moment.")
        if response.status_code >= 500:
            raise ProviderUnavailableError(f"OSRM routing server error: HTTP {response.status_code}")

        data = response.json()
        if data.get("code") != "Ok":
            raise NoRoutesFoundError(f"OSRM could not route trip: {data.get('message', 'No route')}")

        raw_routes = data.get("routes", [])
        if not raw_routes:
            raise NoRoutesFoundError("No routes found between origin and destination.")

        # If OSRM direct query returned fewer than max_alternatives (e.g. 2 routes),
        # query genuine distinct physical road corridors via lateral waypoints
        if len(raw_routes) < max_alternatives and len(raw_routes) > 0:
            import math
            dx = dest_coords[0] - origin_coords[0]
            dy = dest_coords[1] - origin_coords[1]
            dist = math.hypot(dx, dy)
            if dist > 0.1:
                mid_x = (origin_coords[0] + dest_coords[0]) / 2.0
                mid_y = (origin_coords[1] + dest_coords[1]) / 2.0
                perp_x = -dy / dist
                perp_y = dx / dist

                for factor in [-0.10, 0.10, -0.18, 0.18, -0.25, 0.25]:
                    if len(raw_routes) >= max_alternatives:
                        break
                    via_x = mid_x + perp_x * dist * factor
                    via_y = mid_y + perp_y * dist * factor
                    via_coord_str = f"{origin_coords[0]},{origin_coords[1]};{via_x:.4f},{via_y:.4f};{dest_coords[0]},{dest_coords[1]}"
                    via_url = f"{self.ROUTER_BASE_URL}/route/v1/driving/{via_coord_str}"
                    via_params = {
                        "overview": "full",
                        "geometries": "geojson",
                        "steps": "true",
                    }
                    try:
                        v_resp = requests.get(via_url, params=via_params, headers=self.headers, timeout=self.timeout)
                        if v_resp.status_code == 200:
                            v_data = v_resp.json()
                            if v_data.get("code") == "Ok" and v_data.get("routes"):
                                cand = v_data["routes"][0]
                                cand_dist = cand.get("distance", 0.0)
                                if not any(abs(existing.get("distance", 0.0) - cand_dist) < 8000 for existing in raw_routes):
                                    raw_routes.append(cand)
                    except Exception:
                        continue

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
