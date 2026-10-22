"""
Location Autocomplete Service.
Provides fast, resilient suggestions for freight origins and destinations.
Blends curated major US transport hubs and airports with OSM Nominatim geocoding.
"""

import requests
from typing import List, Dict, Any

# Curated high-frequency logistics hubs and airports matching standard dispatch queries
CURATED_LOCATIONS = [
    {"name": "Chicago, IL, USA", "category": "city", "coordinates": [-87.6298, 41.8781]},
    {"name": "Chicago Midway International Airport (MDW)", "category": "airport", "coordinates": [-87.7522, 41.7868]},
    {"name": "Chicago O'Hare International Airport (ORD)", "category": "airport", "coordinates": [-87.9073, 41.9742]},
    {"name": "Chicago, IN, USA", "category": "city", "coordinates": [-87.4539, 41.6425]},
    {"name": "Chicago Heights, IL, USA", "category": "city", "coordinates": [-87.6328, 41.5061]},

    {"name": "New York, NY, USA", "category": "city", "coordinates": [-74.0060, 40.7128]},
    {"name": "John F. Kennedy International Airport (JFK)", "category": "airport", "coordinates": [-73.7781, 40.6413]},
    {"name": "Newark Liberty International Airport (EWR)", "category": "airport", "coordinates": [-74.1745, 40.6895]},
    {"name": "Philadelphia, PA, USA", "category": "city", "coordinates": [-75.1652, 39.9526]},
    {"name": "Philadelphia International Airport (PHL)", "category": "airport", "coordinates": [-75.2411, 39.8721]},
    {"name": "Baltimore, MD, USA", "category": "city", "coordinates": [-76.6122, 39.2904]},
    {"name": "Baltimore/Washington International Airport (BWI)", "category": "airport", "coordinates": [-76.6684, 39.1774]},
    {"name": "Atlanta, GA, USA", "category": "city", "coordinates": [-84.3880, 33.7490]},
    {"name": "Hartsfield-Jackson Atlanta International Airport (ATL)", "category": "airport", "coordinates": [-84.4277, 33.6407]},
    {"name": "Dallas, TX, USA", "category": "city", "coordinates": [-96.7970, 32.7767]},
    {"name": "Dallas/Fort Worth International Airport (DFW)", "category": "airport", "coordinates": [-97.0403, 32.8998]},
    {"name": "Houston, TX, USA", "category": "city", "coordinates": [-95.3698, 29.7604]},
    {"name": "Denver, CO, USA", "category": "city", "coordinates": [-104.9903, 39.7392]},
    {"name": "Denver International Airport (DEN)", "category": "airport", "coordinates": [-104.6737, 39.8561]},
    {"name": "Los Angeles, CA, USA", "category": "city", "coordinates": [-118.2437, 34.0522]},
    {"name": "Los Angeles International Airport (LAX)", "category": "airport", "coordinates": [-118.4085, 33.9416]},
    {"name": "Seattle, WA, USA", "category": "city", "coordinates": [-122.3321, 47.6062]},
    {"name": "Seattle-Tacoma International Airport (SEA)", "category": "airport", "coordinates": [-122.3088, 47.4502]},
    {"name": "Indianapolis, IN, USA", "category": "city", "coordinates": [-86.1581, 39.7684]},
    {"name": "Columbus, OH, USA", "category": "city", "coordinates": [-82.9988, 39.9612]},
    {"name": "Kansas City, MO, USA", "category": "city", "coordinates": [-94.5786, 39.0997]},
    {"name": "Memphis, TN, USA", "category": "city", "coordinates": [-90.0490, 35.1495]},
    {"name": "St. Louis, MO, USA", "category": "city", "coordinates": [-90.1994, 38.6270]},
    {"name": "Detroit, MI, USA", "category": "city", "coordinates": [-83.0458, 42.3314]},
    {"name": "Minneapolis, MN, USA", "category": "city", "coordinates": [-93.2650, 44.9778]},
]

POPULAR_HUBS = [
    {"name": "Chicago, IL, USA", "category": "city", "coordinates": [-87.6298, 41.8781]},
    {"name": "New York, NY, USA", "category": "city", "coordinates": [-74.0060, 40.7128]},
    {"name": "Dallas, TX, USA", "category": "city", "coordinates": [-96.7970, 32.7767]},
    {"name": "Atlanta, GA, USA", "category": "city", "coordinates": [-84.3880, 33.7490]},
    {"name": "Los Angeles, CA, USA", "category": "city", "coordinates": [-118.2437, 34.0522]},
]

_autocomplete_cache: Dict[str, List[Dict[str, Any]]] = {}

def get_location_suggestions(query: str, limit: int = 5) -> List[Dict[str, Any]]:
    """
    Returns up to `limit` location suggestions for a search string.
    If query is empty, returns curated popular logistics hubs.
    Checks curated catalog first, then queries OSM Nominatim if needed.
    """
    clean_q = query.strip().lower()
    if not clean_q:
        return POPULAR_HUBS[:limit]

    if clean_q in _autocomplete_cache:
        return _autocomplete_cache[clean_q]

    matched: List[Dict[str, Any]] = []

    # 1. Match curated
    for loc in CURATED_LOCATIONS:
        if clean_q in loc["name"].lower():
            matched.append(loc)
            if len(matched) >= limit:
                break

    if len(clean_q) < 2:
        _autocomplete_cache[clean_q] = matched[:limit]
        return matched[:limit]

    # 2. If fewer than limit, optionally fetch from Nominatim
    if len(matched) < limit:
        try:
            url = "https://nominatim.openstreetmap.org/search"
            headers = {"User-Agent": "SpotterTruckRoutingApp/1.0 (Assessment Autocomplete)"}
            params = {
                "q": query.strip(),
                "format": "json",
                "limit": limit - len(matched),
                "addressdetails": 1,
            }
            resp = requests.get(url, params=params, headers=headers, timeout=2.5)
            if resp.status_code == 200:
                data = resp.json()
                for item in data:
                    display = item.get("display_name", "")
                    # Shorten verbose OpenStreetMap display names
                    parts = [p.strip() for p in display.split(",")]
                    short_name = ", ".join(parts[:3]) if len(parts) >= 3 else display
                    lon = float(item.get("lon", 0))
                    lat = float(item.get("lat", 0))
                    if not any(m["name"] == short_name for m in matched):
                        matched.append({
                            "name": short_name,
                            "category": "location",
                            "coordinates": [lon, lat],
                        })
        except Exception:
            # Silently degrade to curated results on network/rate-limit error
            pass

    _autocomplete_cache[clean_q] = matched[:limit]
    return matched[:limit]
