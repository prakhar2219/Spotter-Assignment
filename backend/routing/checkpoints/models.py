"""
Checkpoint data models.
"""

from dataclasses import dataclass, asdict
from typing import List, Optional, Dict, Any

@dataclass
class Checkpoint:
    index: int
    name: str
    coordinates: List[float]  # [longitude, latitude]
    cumulative_distance_meters: float
    cumulative_distance_miles: float
    segment_distance_miles: float
    estimated_arrival_time: str  # ISO 8601 with timezone
    is_origin: bool = False
    is_destination: bool = False
    weather: Optional[Dict[str, Any]] = None
    hourly_forecasts: Optional[List[Dict[str, Any]]] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
