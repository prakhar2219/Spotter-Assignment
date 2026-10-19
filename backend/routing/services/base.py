"""
Base Routing Provider and Data Normalization Models.
Standardizes route representations across providers.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, asdict
from typing import List, Tuple, Dict, Any, Union

METERS_TO_MILES = 1.0 / 1609.344

@dataclass
class ResolvedLocation:
    query: str
    display_name: str
    coordinates: List[float]  # [longitude, latitude]

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

@dataclass
class NormalizedRoute:
    id: str
    name: str
    distance_meters: float
    distance_miles: float
    duration_seconds: float
    duration_hours: float
    duration_formatted: str
    summary: str
    geometry: Dict[str, Any]  # GeoJSON LineString: {"type": "LineString", "coordinates": [[lon, lat], ...]}

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

def format_duration(seconds: float) -> str:
    """Formats duration in seconds into human-readable hours and minutes."""
    total_minutes = int(round(seconds / 60))
    hours = total_minutes // 60
    minutes = total_minutes % 60
    if hours > 0:
        return f"{hours}h {minutes}m"
    return f"{minutes}m"

class BaseRoutingProvider(ABC):
    """
    Abstract Base Class for routing providers.
    All providers must output GeoJSON [longitude, latitude] coordinates.
    """
    provider_name: str = "base"

    @abstractmethod
    def geocode(self, location: Union[str, List[float], Tuple[float, float], Dict[str, float]]) -> ResolvedLocation:
        """
        Resolves an address, place name, or coordinate pair to a ResolvedLocation.
        Coordinates must be [longitude, latitude].
        """
        pass

    @abstractmethod
    def get_routes(
        self,
        origin_coords: List[float],
        dest_coords: List[float],
        max_alternatives: int = 3
    ) -> List[NormalizedRoute]:
        """
        Requests alternative routes between origin and destination coordinates.
        Never fabricates or duplicates routes. Returns between 1 and max_alternatives routes.
        """
        pass
