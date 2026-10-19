"""
Geometric utilities for route distance calculation and interpolation.
"""

import math
from typing import List, Tuple

EARTH_RADIUS_METERS = 6371000.0
METERS_PER_MILE = 1609.344

def haversine_distance_meters(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    """
    Computes great-circle distance between two (lon, lat) points in meters using the Haversine formula.
    """
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2.0) ** 2)
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))

    return EARTH_RADIUS_METERS * c

def interpolate_coordinates(
    coord1: List[float], coord2: List[float], fraction: float
) -> List[float]:
    """
    Linearly interpolates between coord1=[lon1, lat1] and coord2=[lon2, lat2] by fraction (0.0 to 1.0).
    Returns [lon, lat].
    """
    fraction = max(0.0, min(1.0, fraction))
    lon = coord1[0] + fraction * (coord2[0] - coord1[0])
    lat = coord1[1] + fraction * (coord2[1] - coord1[1])
    return [round(lon, 6), round(lat, 6)]

def compute_cumulative_distances(coordinates: List[List[float]]) -> List[float]:
    """
    Computes cumulative distance in meters at each vertex along coordinates=[[lon, lat], ...].
    Index 0 is 0.0. Length of output matches length of coordinates.
    """
    if not coordinates:
        return []
    
    cumulative = [0.0]
    total = 0.0
    for i in range(len(coordinates) - 1):
        c1 = coordinates[i]
        c2 = coordinates[i + 1]
        dist = haversine_distance_meters(c1[0], c1[1], c2[0], c2[1])
        total += dist
        cumulative.append(total)
    
    return cumulative
