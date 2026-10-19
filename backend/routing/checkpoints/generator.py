"""
Route Checkpoint Generation along Road Geometry.
Samples checkpoints at configured intervals (10, 25, 50 miles) and computes ETAs.
"""

from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Union
from .geometry import (
    haversine_distance_meters,
    interpolate_coordinates,
    compute_cumulative_distances,
    METERS_PER_MILE,
)
from .models import Checkpoint

VALID_SAMPLING_INTERVALS_MILES = (10, 25, 50)
MIN_DESTINATION_SEPARATION_METERS = 800.0  # ~0.5 miles threshold to prevent duplicate near-destination points

def parse_departure_time(departure_time: Union[str, datetime]) -> datetime:
    """
    Parses ISO 8601 string or validates datetime, guaranteeing timezone awareness.
    If naive datetime is provided, UTC timezone is attached.
    """
    if isinstance(departure_time, datetime):
        dt = departure_time
    elif isinstance(departure_time, str):
        # Handle trailing 'Z' if present
        clean_str = departure_time.strip()
        if clean_str.endswith("Z"):
            clean_str = clean_str[:-1] + "+00:00"
        dt = datetime.fromisoformat(clean_str)
    else:
        raise ValueError(f"Invalid departure_time format: {departure_time}. Expected ISO 8601 string or datetime.")

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt

def generate_checkpoints(
    route_coordinates: List[List[float]],
    departure_time: Union[str, datetime],
    duration_seconds: float,
    interval_miles: int = 25,
) -> List[Checkpoint]:
    """
    Generates time-aware checkpoints along actual route geometry.
    - Always includes origin (0 miles).
    - Samples points along road geometry every interval_miles.
    - Always includes destination (total route distance).
    - Avoids duplicate points at the destination.
    - Computes timezone-aware ETA for each checkpoint.
    """
    if not route_coordinates or len(route_coordinates) < 2:
        raise ValueError("Route coordinates must contain at least 2 points (origin and destination).")

    if interval_miles not in VALID_SAMPLING_INTERVALS_MILES:
        raise ValueError(
            f"Invalid sampling interval: {interval_miles} miles. "
            f"Supported intervals are: {VALID_SAMPLING_INTERVALS_MILES} miles."
        )

    dep_dt = parse_departure_time(departure_time)
    duration_s = max(0.0, float(duration_seconds))

    # 1. Compute cumulative distance along all route vertices
    vertex_distances = compute_cumulative_distances(route_coordinates)
    total_distance_meters = vertex_distances[-1]
    total_distance_miles = total_distance_meters / METERS_PER_MILE
    interval_meters = interval_miles * METERS_PER_MILE

    # 2. Origin Checkpoint (Index 0)
    checkpoints: List[Checkpoint] = [
        Checkpoint(
            index=0,
            name="Checkpoint 0 (Origin)",
            coordinates=route_coordinates[0],
            cumulative_distance_meters=0.0,
            cumulative_distance_miles=0.0,
            segment_distance_miles=0.0,
            estimated_arrival_time=dep_dt.isoformat(),
            is_origin=True,
            is_destination=False,
        )
    ]

    # If the route is trivial / zero distance
    if total_distance_meters <= 0.0:
        checkpoints.append(
            Checkpoint(
                index=1,
                name="Checkpoint 1 (Destination)",
                coordinates=route_coordinates[-1],
                cumulative_distance_meters=0.0,
                cumulative_distance_miles=0.0,
                segment_distance_miles=0.0,
                estimated_arrival_time=(dep_dt + timedelta(seconds=duration_s)).isoformat(),
                is_origin=False,
                is_destination=True,
            )
        )
        return checkpoints

    # 3. Sample along road geometry
    target_dist = interval_meters
    vertex_idx = 0
    num_vertices = len(route_coordinates)

    while target_dist < total_distance_meters:
        # Check if target is too close to destination
        if (total_distance_meters - target_dist) < MIN_DESTINATION_SEPARATION_METERS:
            break

        # Advance vertex_idx until vertex_distances[vertex_idx] <= target_dist <= vertex_distances[vertex_idx + 1]
        while vertex_idx < num_vertices - 1 and vertex_distances[vertex_idx + 1] < target_dist:
            vertex_idx += 1

        v1_dist = vertex_distances[vertex_idx]
        v2_dist = vertex_distances[vertex_idx + 1]
        seg_len = v2_dist - v1_dist

        if seg_len > 0:
            fraction = (target_dist - v1_dist) / seg_len
            sampled_coords = interpolate_coordinates(
                route_coordinates[vertex_idx],
                route_coordinates[vertex_idx + 1],
                fraction
            )
        else:
            sampled_coords = route_coordinates[vertex_idx]

        # Calculate ETA
        travel_fraction = target_dist / total_distance_meters
        eta_seconds = travel_fraction * duration_s
        eta_dt = dep_dt + timedelta(seconds=eta_seconds)

        cum_miles = round(target_dist / METERS_PER_MILE, 2)
        prev_cum_miles = checkpoints[-1].cumulative_distance_miles
        seg_miles = round(cum_miles - prev_cum_miles, 2)

        checkpoint_idx = len(checkpoints)
        checkpoints.append(
            Checkpoint(
                index=checkpoint_idx,
                name=f"Checkpoint {checkpoint_idx}",
                coordinates=sampled_coords,
                cumulative_distance_meters=round(target_dist, 1),
                cumulative_distance_miles=cum_miles,
                segment_distance_miles=seg_miles,
                estimated_arrival_time=eta_dt.isoformat(),
                is_origin=False,
                is_destination=False,
            )
        )

        target_dist += interval_meters

    # 4. Destination Checkpoint (Always included as the final point)
    dest_eta_dt = dep_dt + timedelta(seconds=duration_s)
    dest_cum_miles = round(total_distance_miles, 2)
    prev_cum_miles = checkpoints[-1].cumulative_distance_miles
    dest_seg_miles = round(dest_cum_miles - prev_cum_miles, 2)

    dest_idx = len(checkpoints)
    checkpoints.append(
        Checkpoint(
            index=dest_idx,
            name=f"Checkpoint {dest_idx} (Destination)",
            coordinates=route_coordinates[-1],
            cumulative_distance_meters=round(total_distance_meters, 1),
            cumulative_distance_miles=dest_cum_miles,
            segment_distance_miles=dest_seg_miles,
            estimated_arrival_time=dest_eta_dt.isoformat(),
            is_origin=False,
            is_destination=True,
        )
    )

    return checkpoints
