"""
Seed historical trips matching trip_history.png.
Provides realistic completed, failed, and multi-risk historical trips.
"""

from datetime import datetime, timezone, timedelta
from routing.models import TripPlan


def generate_chicago_ny_payload():
    """Generates a complete plan payload for TRP-20261020-001 matching Panels 3 and 4."""
    # Build road-like coordinates between Chicago and New York
    start_lon, start_lat = -87.6298, 41.8781
    end_lon, end_lat = -74.0060, 40.7128
    
    # 32 checkpoints along the corridor
    checkpoints_b = []
    coords_b = []
    num_cps = 32
    dep_time = datetime(2026, 10, 20, 8, 0, tzinfo=timezone(timedelta(hours=-5)))
    
    for i in range(num_cps):
        ratio = i / (num_cps - 1)
        # Add slight curvature for highway realism
        arc = 0.8 * (ratio * (1 - ratio))
        lon = start_lon + (end_lon - start_lon) * ratio
        lat = start_lat + (end_lat - start_lat) * ratio + arc
        coords_b.append([round(lon, 4), round(lat, 4)])
        
        cum_dist = round(ratio * 785.0, 1)
        # Checkpoint 12 explicitly matches panel 4: Distance 300 mi, ETA 12:45 PM (CDT)
        if i == 12:
            cum_dist = 300.0
            eta_dt = dep_time + timedelta(hours=4, minutes=45)
            w_speed = 42.0
            w_rain = 0.20
            w_snow = 0.00
            risk_cat = "High"
            risk_score = 3.0
            reason = "Wind speed is in the 40-44 mph range which is classified as High risk."
        elif i == 11 or i == 13:
            eta_dt = dep_time + timedelta(minutes=int(ratio * 44100 / 60))
            w_speed = 36.0
            w_rain = 0.12
            w_snow = 0.00
            risk_cat = "Moderate"
            risk_score = 2.0
            reason = "Wind speed in 35-39 mph range."
        else:
            eta_dt = dep_time + timedelta(minutes=int(ratio * 44100 / 60))
            w_speed = 12.0 + (i % 7) * 2.5
            w_rain = 0.02 if i % 5 == 0 else 0.00
            w_snow = 0.00
            risk_cat = "Low"
            risk_score = 1.0
            reason = "Conditions within safe operating limits."
        hourly_forecasts = []
        for h in range(49):
            fc_dt = dep_time + timedelta(hours=h)
            fc_wind = round(w_speed + (h % 5) * 1.5 - (h % 3), 1)
            fc_rain = 0.20 if (h >= 4 and h <= 8 and i == 12) else (0.02 if (h % 7 == 0) else 0.0)
            fc_snow = 0.0
            hourly_forecasts.append({
                "forecast_time": fc_dt.isoformat(),
                "time": fc_dt.isoformat(),
                "wind_speed_mph": fc_wind,
                "wind_gusts_mph": round(fc_wind * 1.25, 1),
                "precipitation_rate_in_hr": fc_rain,
                "snowfall_rate_in_hr": fc_snow,
                "temperature_f": round(58.0 + (i % 6) + (h % 8) - 4, 1),
                "overall_risk": "High" if (i == 12 and h <= 8) else ("Moderate" if fc_wind >= 35 else "Low"),
                "is_available": True,
            })

        checkpoints_b.append({
            "id": f"cp-b-{i+1}",
            "index": i,
            "name": f"Checkpoint {i+1}",
            "sequence": i + 1,
            "coordinates": [round(lon, 4), round(lat, 4)],
            "cumulative_distance_meters": round(cum_dist * 1609.34, 1),
            "cumulative_distance_miles": cum_dist,
            "segment_distance_miles": 25.0 if i > 0 else 0.0,
            "estimated_arrival_time": eta_dt.isoformat(),
            "eta": eta_dt.isoformat(),
            "eta_formatted": eta_dt.strftime("%I:%M %p (CDT)"),
            "is_origin": i == 0,
            "is_destination": i == num_cps - 1,
            "weather": {
                "wind_speed_mph": w_speed,
                "wind_gusts_mph": round(w_speed * 1.25, 1),
                "precipitation_rate_in_hr": w_rain,
                "snowfall_rate_in_hr": w_snow,
                "temperature_f": 58.0 + (i % 6),
                "weather_condition": "Windy / Rain" if w_rain > 0 else ("Breezy" if w_speed > 25 else "Clear"),
                "forecast_time": eta_dt.isoformat(),
                "is_available": True,
            },
            "risk": {
                "overall_risk": risk_cat,
                "level": risk_cat,
                "score": risk_score,
                "is_no_travel": False,
                "reasons": [reason],
                "advisories": [reason] if risk_cat != "Low" else [],
            },
            "hourly_forecasts": hourly_forecasts,
        })

        
    route_b = {
        "id": "route-2",
        "name": "Route B",
        "summary": "via I-80 E & I-99 N",
        "distance_miles": 785.0,
        "duration_seconds": 44100,
        "duration_formatted": "12h 15m",
        "arrival_time": "2026-10-20T20:15:00-04:00",
        "is_recommended": True,
        "is_eligible": True,
        "status": "Recommended",
        "geometry": {
            "type": "LineString",
            "coordinates": coords_b,
        },
        "metrics": {
            "distance_miles": 785.0,
            "duration_seconds": 44100,
            "duration_formatted": "12h 15m",
            "severe_miles": 0.0,
            "high_miles": 22.0,
            "moderate_miles": 50.0,
            "low_miles": 713.0,
            "distance_weighted_average_risk": 0.68,
            "has_no_travel": False,
            "is_eligible": True,
        },
        "checkpoints": checkpoints_b,
    }

    # Route A (Ineligible due to severe conditions)
    route_a = {
        "id": "route-1",
        "name": "Route A",
        "summary": "via I-90 E",
        "distance_miles": 812.0,
        "duration_seconds": 45600,
        "duration_formatted": "12h 40m",
        "arrival_time": "2026-10-20T20:40:00-04:00",
        "is_recommended": False,
        "is_eligible": False,
        "status": "Ineligible",
        "geometry": {
            "type": "LineString",
            "coordinates": [[c[0], c[1] + 0.35] for c in coords_b],
        },
        "metrics": {
            "distance_miles": 812.0,
            "duration_seconds": 45600,
            "duration_formatted": "12h 40m",
            "severe_miles": 34.0,
            "high_miles": 86.0,
            "moderate_miles": 90.0,
            "low_miles": 602.0,
            "distance_weighted_average_risk": 1.82,
            "has_no_travel": True,
            "is_eligible": False,
        },
        "checkpoints": checkpoints_b[:20],
    }

    # Route C (Eligible alternative)
    route_c = {
        "id": "route-3",
        "name": "Route C",
        "summary": "via I-70 E & I-76 E",
        "distance_miles": 824.0,
        "duration_seconds": 47400,
        "duration_formatted": "13h 10m",
        "arrival_time": "2026-10-20T21:10:00-04:00",
        "is_recommended": False,
        "is_eligible": True,
        "status": "Eligible",
        "geometry": {
            "type": "LineString",
            "coordinates": [[c[0], c[1] - 0.4] for c in coords_b],
        },
        "metrics": {
            "distance_miles": 824.0,
            "duration_seconds": 47400,
            "duration_formatted": "13h 10m",
            "severe_miles": 12.0,
            "high_miles": 58.0,
            "moderate_miles": 120.0,
            "low_miles": 634.0,
            "distance_weighted_average_risk": 1.24,
            "has_no_travel": False,
            "is_eligible": True,
        },
        "checkpoints": checkpoints_b[:25],
    }

    return {
        "status": "success",
        "trip_id": "TRP-20261020-001",
        "trip": {
            "origin": {"display_name": "Chicago, IL, USA", "name": "Chicago, IL, USA", "coordinates": [start_lon, start_lat]},
            "destination": {"display_name": "New York, NY, USA", "name": "New York, NY, USA", "coordinates": [end_lon, end_lat]},
            "departure_time": "2026-10-20T08:00:00-05:00",
            "cargo_weight_lb": 35000,
            "sampling_interval_miles": 25,
            "status": "completed",
        },
        "routes_count": 3,
        "routes": [route_b, route_a, route_c],
        "recommendation": {
            "recommended_route_id": "route-2",
            "recommended_route_name": "Route B",
            "explanation": "Route B is recommended: 0 Severe miles vs 34 Severe miles on Route A and 12 Severe miles on Route C. Fewer High miles (22 mi vs 58 mi on Route C) and lower average risk score (0.68 vs 1.24).",
            "rankings": [
                {"rank": 1, "route_id": "route-2", "name": "Route B", "eligible": True, "severe_miles": 0.0, "high_miles": 22.0, "avg_risk": 0.68},
                {"rank": 2, "route_id": "route-3", "name": "Route C", "eligible": True, "severe_miles": 12.0, "high_miles": 58.0, "avg_risk": 1.24},
                {"rank": 3, "route_id": "route-1", "name": "Route A", "eligible": False, "severe_miles": 34.0, "high_miles": 86.0, "avg_risk": 1.82},
            ]
        },
        "warnings": [],
        "units": {
            "distance": "miles",
            "duration": "seconds",
            "wind_speed": "mph",
            "precipitation": "in/hr",
            "snowfall": "in/hr",
            "load_weight": "lb",
            "temperature": "fahrenheit"
        }
    }


SAMPLE_HISTORICAL_TRIPS = [
    {
        "trip_id": "TRP-20261020-001",
        "origin_name": "Chicago, IL, USA",
        "destination_name": "New York, NY, USA",
        "departure_time": datetime(2026, 10, 20, 8, 0, tzinfo=timezone(timedelta(hours=-5))),
        "departure_time_iso": "2026-10-20T08:00:00-05:00",
        "arrival_time_iso": "2026-10-20T20:15:00-04:00",
        "cargo_weight_lb": 35000,
        "checkpoint_interval_miles": 25,
        "status": "completed",
        "recommended_route_id": "route-2",
        "recommended_route_name": "Route B",
        "distance_miles": 785.0,
        "travel_time_seconds": 44100,
        "travel_time_formatted": "12h 15m",
        "severe_miles": 0.0,
        "high_miles": 22.0,
        "average_risk": 0.68,
        "risk_level": "Low",
        "routes_count": 3,
    },
    {
        "trip_id": "TRP-20261015-002",
        "origin_name": "Dallas, TX, USA",
        "destination_name": "Denver, CO, USA",
        "departure_time": datetime(2026, 10, 15, 7, 30, tzinfo=timezone(timedelta(hours=-5))),
        "departure_time_iso": "2026-10-15T07:30:00-05:00",
        "arrival_time_iso": "2026-10-15T21:10:00-06:00",
        "cargo_weight_lb": 40000,
        "checkpoint_interval_miles": 25,
        "status": "completed",
        "recommended_route_id": "route-1",
        "recommended_route_name": "Route A",
        "distance_miles": 789.0,
        "travel_time_seconds": 49200,
        "travel_time_formatted": "13h 40m",
        "severe_miles": 12.0,
        "high_miles": 35.0,
        "average_risk": 1.24,
        "risk_level": "Moderate",
        "routes_count": 3,
    },
    {
        "trip_id": "TRP-20261010-003",
        "origin_name": "Los Angeles, CA, USA",
        "destination_name": "Phoenix, AZ, USA",
        "departure_time": datetime(2026, 10, 10, 6, 0, tzinfo=timezone(timedelta(hours=-7))),
        "departure_time_iso": "2026-10-10T06:00:00-07:00",
        "arrival_time_iso": "2026-10-10T12:20:00-07:00",
        "cargo_weight_lb": 28000,
        "checkpoint_interval_miles": 25,
        "status": "completed",
        "recommended_route_id": "route-1",
        "recommended_route_name": "Route A",
        "distance_miles": 373.0,
        "travel_time_seconds": 22800,
        "travel_time_formatted": "6h 20m",
        "severe_miles": 0.0,
        "high_miles": 0.0,
        "average_risk": 0.42,
        "risk_level": "Low",
        "routes_count": 2,
    },
    {
        "trip_id": "TRP-20261005-004",
        "origin_name": "Seattle, WA, USA",
        "destination_name": "Portland, OR, USA",
        "departure_time": datetime(2026, 10, 5, 9, 0, tzinfo=timezone(timedelta(hours=-7))),
        "departure_time_iso": "2026-10-05T09:00:00-07:00",
        "arrival_time_iso": "2026-10-05T12:10:00-07:00",
        "cargo_weight_lb": 32000,
        "checkpoint_interval_miles": 10,
        "status": "completed",
        "recommended_route_id": "route-1",
        "recommended_route_name": "Route A",
        "distance_miles": 173.0,
        "travel_time_seconds": 11400,
        "travel_time_formatted": "3h 10m",
        "severe_miles": 0.0,
        "high_miles": 0.0,
        "average_risk": 0.35,
        "risk_level": "Low",
        "routes_count": 2,
    },
    {
        "trip_id": "TRP-20260928-005",
        "origin_name": "Houston, TX, USA",
        "destination_name": "Atlanta, GA, USA",
        "departure_time": datetime(2026, 9, 28, 6, 0, tzinfo=timezone(timedelta(hours=-5))),
        "departure_time_iso": "2026-09-28T06:00:00-05:00",
        "arrival_time_iso": "2026-09-28T19:50:00-04:00",
        "cargo_weight_lb": 42000,
        "checkpoint_interval_miles": 50,
        "status": "completed",
        "recommended_route_id": "route-3",
        "recommended_route_name": "Route C",
        "distance_miles": 810.0,
        "travel_time_seconds": 49800,
        "travel_time_formatted": "13h 50m",
        "severe_miles": 18.0,
        "high_miles": 45.0,
        "average_risk": 1.86,
        "risk_level": "High",
        "routes_count": 3,
    },
    {
        "trip_id": "TRP-20260920-006",
        "origin_name": "Miami, FL, USA",
        "destination_name": "Charlotte, NC, USA",
        "departure_time": datetime(2026, 9, 20, 7, 0, tzinfo=timezone(timedelta(hours=-4))),
        "departure_time_iso": "2026-09-20T07:00:00-04:00",
        "arrival_time_iso": "2026-09-20T18:45:00-04:00",
        "cargo_weight_lb": 38000,
        "checkpoint_interval_miles": 25,
        "status": "completed",
        "recommended_route_id": "route-2",
        "recommended_route_name": "Route B",
        "distance_miles": 650.0,
        "travel_time_seconds": 42300,
        "travel_time_formatted": "11h 45m",
        "severe_miles": 0.0,
        "high_miles": 15.0,
        "average_risk": 0.78,
        "risk_level": "Low",
        "routes_count": 3,
    },
    {
        "trip_id": "TRP-20260912-007",
        "origin_name": "San Francisco, CA, USA",
        "destination_name": "Reno, NV, USA",
        "departure_time": datetime(2026, 9, 12, 8, 30, tzinfo=timezone(timedelta(hours=-7))),
        "departure_time_iso": "2026-09-12T08:30:00-07:00",
        "arrival_time_iso": "2026-09-12T12:35:00-07:00",
        "cargo_weight_lb": 30000,
        "checkpoint_interval_miles": 25,
        "status": "completed",
        "recommended_route_id": "route-1",
        "recommended_route_name": "Route A",
        "distance_miles": 218.0,
        "travel_time_seconds": 14700,
        "travel_time_formatted": "4h 5m",
        "severe_miles": 0.0,
        "high_miles": 0.0,
        "average_risk": 0.22,
        "risk_level": "Low",
        "routes_count": 2,
    },
    {
        "trip_id": "TRP-20260905-008",
        "origin_name": "Chicago, IL, USA",
        "destination_name": "Omaha, NE, USA",
        "departure_time": datetime(2026, 9, 5, 7, 0, tzinfo=timezone(timedelta(hours=-5))),
        "departure_time_iso": "2026-09-05T07:00:00-05:00",
        "arrival_time_iso": "2026-09-05T14:30:00-05:00",
        "cargo_weight_lb": 45000,
        "checkpoint_interval_miles": 25,
        "status": "failed",
        "recommended_route_id": "route-2",
        "recommended_route_name": "Route B",
        "distance_miles": 463.0,
        "travel_time_seconds": 27000,
        "travel_time_formatted": "7h 30m",
        "severe_miles": 35.0,
        "high_miles": 60.0,
        "average_risk": 2.45,
        "risk_level": "No Travel",
        "routes_count": 2,
    },
    {
        "trip_id": "TRP-20260828-009",
        "origin_name": "Boston, MA, USA",
        "destination_name": "Washington, DC, USA",
        "departure_time": datetime(2026, 8, 28, 7, 0, tzinfo=timezone(timedelta(hours=-4))),
        "departure_time_iso": "2026-08-28T07:00:00-04:00",
        "arrival_time_iso": "2026-08-28T15:15:00-04:00",
        "cargo_weight_lb": 34000,
        "checkpoint_interval_miles": 25,
        "status": "completed",
        "recommended_route_id": "route-1",
        "recommended_route_name": "Route A",
        "distance_miles": 440.0,
        "travel_time_seconds": 29700,
        "travel_time_formatted": "8h 15m",
        "severe_miles": 0.0,
        "high_miles": 10.0,
        "average_risk": 0.55,
        "risk_level": "Low",
        "routes_count": 2,
    },
    {
        "trip_id": "TRP-20260815-010",
        "origin_name": "Minneapolis, MN, USA",
        "destination_name": "Kansas City, MO, USA",
        "departure_time": datetime(2026, 8, 15, 6, 30, tzinfo=timezone(timedelta(hours=-5))),
        "departure_time_iso": "2026-08-15T06:30:00-05:00",
        "arrival_time_iso": "2026-08-15T13:50:00-05:00",
        "cargo_weight_lb": 39000,
        "checkpoint_interval_miles": 25,
        "status": "completed",
        "recommended_route_id": "route-1",
        "recommended_route_name": "Route A",
        "distance_miles": 450.0,
        "travel_time_seconds": 26400,
        "travel_time_formatted": "7h 20m",
        "severe_miles": 0.0,
        "high_miles": 18.0,
        "average_risk": 0.85,
        "risk_level": "Moderate",
        "routes_count": 2,
    },
    {
        "trip_id": "TRP-20260802-011",
        "origin_name": "Salt Lake City, UT, USA",
        "destination_name": "Las Vegas, NV, USA",
        "departure_time": datetime(2026, 8, 2, 8, 0, tzinfo=timezone(timedelta(hours=-6))),
        "departure_time_iso": "2026-08-02T08:00:00-06:00",
        "arrival_time_iso": "2026-08-02T14:15:00-07:00",
        "cargo_weight_lb": 31000,
        "checkpoint_interval_miles": 25,
        "status": "completed",
        "recommended_route_id": "route-2",
        "recommended_route_name": "Route B",
        "distance_miles": 420.0,
        "travel_time_seconds": 22500,
        "travel_time_formatted": "6h 15m",
        "severe_miles": 0.0,
        "high_miles": 0.0,
        "average_risk": 0.40,
        "risk_level": "Low",
        "routes_count": 2,
    },
    {
        "trip_id": "TRP-20260720-012",
        "origin_name": "Nashville, TN, USA",
        "destination_name": "Memphis, TN, USA",
        "departure_time": datetime(2026, 7, 20, 9, 0, tzinfo=timezone(timedelta(hours=-5))),
        "departure_time_iso": "2026-07-20T09:00:00-05:00",
        "arrival_time_iso": "2026-07-20T12:25:00-05:00",
        "cargo_weight_lb": 25000,
        "checkpoint_interval_miles": 10,
        "status": "completed",
        "recommended_route_id": "route-1",
        "recommended_route_name": "Route A",
        "distance_miles": 212.0,
        "travel_time_seconds": 12300,
        "travel_time_formatted": "3h 25m",
        "severe_miles": 0.0,
        "high_miles": 0.0,
        "average_risk": 0.30,
        "risk_level": "Low",
        "routes_count": 1,
    },
]


def ensure_seed_trips():
    """Seeds historical trips if database has fewer than 12 trips or is missing TRP-20261020-001."""
    chicago_payload = generate_chicago_ny_payload()
    
    for item in SAMPLE_HISTORICAL_TRIPS:
        trip, created = TripPlan.objects.get_or_create(
            trip_id=item["trip_id"],
            defaults={
                "origin_name": item["origin_name"],
                "destination_name": item["destination_name"],
                "departure_time": item["departure_time"],
                "departure_time_iso": item["departure_time_iso"],
                "arrival_time_iso": item["arrival_time_iso"],
                "cargo_weight_lb": item["cargo_weight_lb"],
                "checkpoint_interval_miles": item["checkpoint_interval_miles"],
                "status": item["status"],
                "recommended_route_id": item["recommended_route_id"],
                "recommended_route_name": item["recommended_route_name"],
                "distance_miles": item["distance_miles"],
                "travel_time_seconds": item["travel_time_seconds"],
                "travel_time_formatted": item["travel_time_formatted"],
                "severe_miles": item["severe_miles"],
                "high_miles": item["high_miles"],
                "average_risk": item["average_risk"],
                "risk_level": item["risk_level"],
                "routes_count": item["routes_count"],
                "full_plan_payload": chicago_payload if item["trip_id"] == "TRP-20261020-001" else {},
            }
        )
        if not created and item["trip_id"] == "TRP-20261020-001" and not trip.full_plan_payload:
            trip.full_plan_payload = chicago_payload
            trip.save(update_fields=["full_plan_payload"])
