from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from unittest.mock import patch, MagicMock
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
import requests

from routing.services import (
    OpenRouteServiceProvider,
    MapboxProvider,
    OSRMProvider,
    get_routing_provider,
    preview_routes,
    NormalizedRoute,
    ResolvedLocation,
    MissingApiKeyError,
    GeocodingError,
    ProviderUnavailableError,
    RateLimitError,
    NoRoutesFoundError,
    InvalidTripInputError,
)
from routing.checkpoints import (
    generate_checkpoints,
    haversine_distance_meters,
    interpolate_coordinates,
    compute_cumulative_distances,
    METERS_PER_MILE,
    VALID_SAMPLING_INTERVALS_MILES,
)
from routing.weather import (
    NormalizedWeather,
    OpenMeteoWeatherProvider,
    enrich_checkpoints_with_weather,
)
from routing.risk import (
    RiskLevel,
    RISK_SCORES,
    classify_wind_risk,
    classify_rain_risk,
    classify_snow_risk,
    evaluate_checkpoint_risk,
)
from routing.recommendation import (
    calculate_route_risk_metrics,
    rank_and_recommend_routes,
    get_lexicographical_key,
    RouteRiskMetrics,
    RecommendationResult,
)

class HealthCheckTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_health_check_endpoint(self):
        url = reverse('health-check')
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data.get('status'), 'healthy')
        self.assertEqual(data.get('service'), 'spotter-weather-routing-backend')
        self.assertIn('timestamp', data)
        self.assertEqual(data.get('phase'), 6)

    def test_cors_headers_allowed_origin(self):
        url = reverse('health-check')
        response = self.client.get(url, HTTP_ORIGIN='http://localhost:5173')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers.get('Access-Control-Allow-Origin'), 'http://localhost:5173')

    def test_cors_headers_disallowed_origin(self):
        url = reverse('health-check')
        response = self.client.get(url, HTTP_ORIGIN='http://unauthorized-domain.com')
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.headers.get('Access-Control-Allow-Origin'))


class RoutePreviewInputValidationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = reverse('routes-preview')

    def test_missing_origin(self):
        response = self.client.post(self.url, {"destination": "Boston, MA"}, format='json')
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertEqual(data.get("error"), "missing_field")
        self.assertEqual(data.get("field"), "origin")

    def test_missing_destination(self):
        response = self.client.post(self.url, {"origin": "New York, NY"}, format='json')
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertEqual(data.get("error"), "missing_field")
        self.assertEqual(data.get("field"), "destination")

    def test_same_origin_and_destination(self):
        payload = {
            "origin": [-74.006, 40.7128],
            "destination": [-74.006, 40.7128]
        }
        response = self.client.post(self.url, payload, format='json')
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertEqual(data.get("error"), "invalid_input")
        self.assertIn("cannot be the same location", data.get("message", ""))


class MissingCredentialsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = reverse('routes-preview')

    @patch.dict('os.environ', {'ROUTING_API_KEY': '', 'OPENROUTESERVICE_API_KEY': '', 'ROUTING_PROVIDER': 'openrouteservice'})
    def test_missing_api_key_returns_clear_error(self):
        provider = OpenRouteServiceProvider(api_key="")
        with self.assertRaises(MissingApiKeyError) as ctx:
            provider._require_api_key()
        self.assertIn("ROUTING_API_KEY", str(ctx.exception))

    @patch.dict('os.environ', {'ROUTING_API_KEY': '', 'OPENROUTESERVICE_API_KEY': '', 'ROUTING_PROVIDER': 'openrouteservice'})
    def test_endpoint_returns_503_when_credentials_missing(self):
        payload = {
            "origin": [-74.006, 40.7128],
            "destination": [-71.0589, 42.3601],
            "provider": "openrouteservice"
        }
        response = self.client.post(self.url, payload, format='json')
        self.assertEqual(response.status_code, 503)
        data = response.json()
        self.assertEqual(data.get("error"), "missing_credentials")
        self.assertIn("ROUTING_API_KEY", data.get("message", ""))


class OpenRouteServiceParsingTests(TestCase):
    def setUp(self):
        self.provider = OpenRouteServiceProvider(api_key="mock_test_key")

    @patch('requests.post')
    def test_route_response_parsing_and_normalization(self, mock_post):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "properties": {
                        "summary": {"distance": 348200.0, "duration": 14200.0},
                        "segments": [{"steps": [{"name": "I-95 N"}]}]
                    },
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [[-74.0060, 40.7128], [-72.5, 41.5], [-71.0589, 42.3601]]
                    }
                },
                {
                    "type": "Feature",
                    "properties": {
                        "summary": {"distance": 362000.0, "duration": 15100.0},
                        "segments": [{"steps": [{"name": "I-84 E"}]}]
                    },
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [[-74.0060, 40.7128], [-73.0, 41.7], [-71.0589, 42.3601]]
                    }
                }
            ]
        }
        mock_post.return_value = mock_response

        routes = self.provider.get_routes(
            origin_coords=[-74.0060, 40.7128],
            dest_coords=[-71.0589, 42.3601],
            max_alternatives=3
        )

        self.assertEqual(len(routes), 2)
        r1 = routes[0]
        self.assertEqual(r1.id, "route-1")
        self.assertEqual(r1.distance_meters, 348200.0)
        self.assertAlmostEqual(r1.distance_miles, 216.36, places=1)
        self.assertEqual(r1.duration_seconds, 14200.0)
        self.assertAlmostEqual(r1.duration_hours, 3.94, places=1)
        self.assertEqual(r1.duration_formatted, "3h 57m")
        self.assertIn("I-95 N", r1.name)
        self.assertEqual(r1.geometry["coordinates"][0], [-74.0060, 40.7128])
        self.assertEqual(r1.geometry["coordinates"][-1], [-71.0589, 42.3601])


class CheckpointGenerationTests(TestCase):
    def setUp(self):
        self.coords = [
            [-75.0, 40.0],
            [-74.5, 40.0],
            [-74.0, 40.0],
            [-73.5, 40.0],
            [-73.113, 40.0]
        ]
        self.departure_time = "2026-10-20T08:00:00-04:00"
        self.duration_seconds = 7200.0

    def test_valid_intervals_10_25_50_miles(self):
        for interval in (10, 25, 50):
            checkpoints = generate_checkpoints(
                self.coords,
                departure_time=self.departure_time,
                duration_seconds=self.duration_seconds,
                interval_miles=interval
            )
            self.assertGreater(len(checkpoints), 2)
            self.assertTrue(checkpoints[0].is_origin)
            self.assertEqual(checkpoints[0].cumulative_distance_miles, 0.0)
            self.assertEqual(checkpoints[0].coordinates, self.coords[0])
            self.assertTrue(checkpoints[-1].is_destination)
            self.assertEqual(checkpoints[-1].coordinates, self.coords[-1])

    def test_invalid_interval_raises_value_error(self):
        with self.assertRaises(ValueError):
            generate_checkpoints(self.coords, self.departure_time, self.duration_seconds, interval_miles=15)

    def test_checkpoints_follow_actual_geometry(self):
        detour_coords = [[-75.0, 40.0], [-75.0, 40.5], [-74.5, 40.5]]
        checkpoints = generate_checkpoints(detour_coords, self.departure_time, 3600, interval_miles=10)
        self.assertAlmostEqual(checkpoints[1].coordinates[0], -75.0, places=2)

    def test_always_includes_destination_and_avoids_duplicates(self):
        checkpoints = generate_checkpoints(self.coords, self.departure_time, self.duration_seconds, interval_miles=25)
        self.assertTrue(checkpoints[-1].is_destination)
        if len(checkpoints) >= 2:
            self.assertNotEqual(checkpoints[-1].coordinates, checkpoints[-2].coordinates)

    def test_cumulative_distances_and_etas_increase_monotonically(self):
        checkpoints = generate_checkpoints(self.coords, self.departure_time, self.duration_seconds, interval_miles=25)
        for i in range(len(checkpoints) - 1):
            curr_cp = checkpoints[i]
            next_cp = checkpoints[i + 1]
            self.assertLess(curr_cp.cumulative_distance_meters, next_cp.cumulative_distance_meters)
            self.assertLess(curr_cp.cumulative_distance_miles, next_cp.cumulative_distance_miles)
            self.assertGreater(next_cp.segment_distance_miles, 0.0)

            t1 = datetime.fromisoformat(curr_cp.estimated_arrival_time)
            t2 = datetime.fromisoformat(next_cp.estimated_arrival_time)
            self.assertLess(t1, t2)

    def test_timezone_preservation(self):
        checkpoints = generate_checkpoints(self.coords, "2026-10-20T10:00:00-05:00", 3600, interval_miles=25)
        self.assertIn("-05:00", checkpoints[0].estimated_arrival_time)


class WeatherIntegrationTests(TestCase):
    def setUp(self):
        self.provider = OpenMeteoWeatherProvider()

    def test_weather_normalization_and_matching(self):
        mock_hourly = {
            "time": ["2026-10-20T12:00", "2026-10-20T13:00", "2026-10-20T14:00"],
            "wind_speed_10m": [15.2, 28.4, 35.1],
            "precipitation": [0.05, 0.22, 0.65],
            "snowfall": [0.0, 0.0, 1.2],
            "temperature_2m": [58.5, 62.0, 60.1],
            "weather_code": [61, 63, 73],
        }

        w = self.provider.match_checkpoint_weather(mock_hourly, "2026-10-20T13:10:00Z")
        self.assertTrue(w.is_available)
        self.assertEqual(w.wind_speed_mph, 28.4)
        self.assertEqual(w.precipitation_in_hr, 0.22)
        self.assertEqual(w.snowfall_in_hr, 0.0)
        self.assertEqual(w.temperature_f, 62.0)
        self.assertEqual(w.weather_code, 63)
        self.assertIn("rain", w.weather_description.lower())
        self.assertEqual(w.forecast_time, "2026-10-20T13:00")

    def test_missing_data_marked_explicitly_unavailable(self):
        w_empty = self.provider.match_checkpoint_weather({}, "2026-10-20T12:00:00Z")
        self.assertFalse(w_empty.is_available)
        self.assertIsNone(w_empty.wind_speed_mph)
        self.assertIsNone(w_empty.precipitation_in_hr)
        self.assertNotEqual(w_empty.status, "available")


class WindRiskThresholdAndLoadRulesTests(TestCase):
    def test_wind_below_25_is_low(self):
        for wind in [0.0, 10.0, 24.9]:
            eval_res = classify_wind_risk(wind, load_weight_lb=50000)
            self.assertEqual(eval_res.risk, RiskLevel.LOW)
            self.assertEqual(eval_res.score, 0)
            self.assertFalse(eval_res.elevated_by_load)

    def test_wind_25_to_34_is_moderate(self):
        for wind in [25.0, 29.5, 34.9]:
            eval_res = classify_wind_risk(wind, load_weight_lb=50000)
            self.assertEqual(eval_res.risk, RiskLevel.MODERATE)
            self.assertEqual(eval_res.score, 1)

    def test_wind_35_to_44_standard_and_load_boundary_40k(self):
        for wind in [35.0, 40.0, 44.9]:
            # Exact 40,000 lb -> High
            res_exact = classify_wind_risk(wind, load_weight_lb=40000)
            self.assertEqual(res_exact.risk, RiskLevel.HIGH)
            self.assertFalse(res_exact.elevated_by_load)

            # Above 40,000 lb -> Severe
            res_above = classify_wind_risk(wind, load_weight_lb=40001)
            self.assertEqual(res_above.risk, RiskLevel.SEVERE)
            self.assertTrue(res_above.elevated_by_load)

    def test_wind_45_to_54_standard_and_load_boundary_30k(self):
        for wind in [45.0, 50.0, 54.9]:
            # Exact 30,000 lb -> Severe
            res_exact = classify_wind_risk(wind, load_weight_lb=30000)
            self.assertEqual(res_exact.risk, RiskLevel.SEVERE)
            self.assertFalse(res_exact.elevated_by_load)

            # Above 30,000 lb -> No Travel
            res_above = classify_wind_risk(wind, load_weight_lb=30001)
            self.assertEqual(res_above.risk, RiskLevel.NO_TRAVEL)
            self.assertTrue(res_above.elevated_by_load)

    def test_wind_55_and_above_is_always_no_travel(self):
        for wind in [55.0, 58.5, 75.0]:
            for load in [0, 10000, 30000, 40000, 80000]:
                eval_res = classify_wind_risk(wind, load_weight_lb=load)
                self.assertEqual(eval_res.risk, RiskLevel.NO_TRAVEL)


class RainRiskThresholdTests(TestCase):
    def test_rain_thresholds(self):
        self.assertEqual(classify_rain_risk(0.05).risk, RiskLevel.LOW)
        self.assertEqual(classify_rain_risk(0.10).risk, RiskLevel.MODERATE)
        self.assertEqual(classify_rain_risk(0.25).risk, RiskLevel.HIGH)
        self.assertEqual(classify_rain_risk(0.50).risk, RiskLevel.SEVERE)
        self.assertEqual(classify_rain_risk(1.00).risk, RiskLevel.SEVERE)
        self.assertEqual(classify_rain_risk(1.05).risk, RiskLevel.NO_TRAVEL)


class SnowRiskThresholdTests(TestCase):
    def test_snow_thresholds(self):
        self.assertEqual(classify_snow_risk(0.2).risk, RiskLevel.LOW)
        self.assertEqual(classify_snow_risk(0.5).risk, RiskLevel.MODERATE)
        self.assertEqual(classify_snow_risk(1.0).risk, RiskLevel.HIGH)
        self.assertEqual(classify_snow_risk(2.0).risk, RiskLevel.SEVERE)
        self.assertEqual(classify_snow_risk(3.0).risk, RiskLevel.SEVERE)
        self.assertEqual(classify_snow_risk(3.5).risk, RiskLevel.NO_TRAVEL)


class OverallCheckpointRiskTests(TestCase):
    def test_worst_condition_determines_overall_risk(self):
        w1 = {"wind_speed_mph": 48.0, "precipitation_in_hr": 0.02, "snowfall_in_hr": 0.0, "is_available": True}
        cp1 = evaluate_checkpoint_risk(w1, load_weight_lb=25000)
        self.assertEqual(cp1.overall_risk, RiskLevel.SEVERE)

        w3 = {"wind_speed_mph": 5.0, "precipitation_in_hr": 0.0, "snowfall_in_hr": 3.8, "is_available": True}
        cp3 = evaluate_checkpoint_risk(w3, load_weight_lb=20000)
        self.assertEqual(cp3.overall_risk, RiskLevel.NO_TRAVEL)
        self.assertTrue(cp3.is_no_travel)


# =========================================================================
# PHASE 5: RECOMMENDATION ENGINE AND STRICT LEXICOGRAPHICAL RANKING TESTS
# =========================================================================

def make_test_checkpoint(index: int, cum_miles: float, risk_str: str, score: int) -> Dict[str, Any]:
    return {
        "index": index,
        "name": f"Checkpoint {index}",
        "cumulative_distance_miles": cum_miles,
        "risk": {
            "overall_risk": risk_str,
            "overall_score": score,
            "is_safe": (risk_str not in ("No Travel", "Unknown")),
            "is_no_travel": (risk_str == "No Travel"),
            "explanation": f"Risk level is {risk_str}."
        }
    }

class RecommendationTier1SevereMilesPriorityTests(TestCase):
    """
    Tier 1 Test: Fewest Severe miles takes priority over everything else.
    Route A has 0 Severe miles and 40 High miles, but is longer (5 hours).
    Route B has 10 Severe miles and 0 High miles, and is shorter (2 hours).
    Route A MUST be recommended because Severe miles is Tier 1.
    """
    def test_fewest_severe_miles_beats_everything(self):
        # Route A: 0 to 50 mi (Low), 50 to 90 mi (High: 40 mi), 90 to 100 mi (Low)
        # Total Severe miles = 0.0, Duration = 5h (18000s)
        cp_a = [
            make_test_checkpoint(0, 0.0, "Low", 0),
            make_test_checkpoint(1, 50.0, "Low", 0),
            make_test_checkpoint(2, 90.0, "High", 2),
            make_test_checkpoint(3, 100.0, "Low", 0),
        ]
        route_a = {
            "id": "route-a",
            "name": "Route A (Longer, 0 Severe mi)",
            "distance_miles": 100.0,
            "duration_seconds": 18000.0,
            "duration_formatted": "5h 00m",
            "checkpoints": cp_a,
        }

        # Route B: 0 to 40 mi (Low), 40 to 50 mi (Severe: 10 mi), 50 to 70 mi (Low)
        # Total Severe miles = 10.0, Duration = 2h (7200s) - MUCH faster!
        cp_b = [
            make_test_checkpoint(0, 0.0, "Low", 0),
            make_test_checkpoint(1, 40.0, "Low", 0),
            make_test_checkpoint(2, 50.0, "Severe", 3),
            make_test_checkpoint(3, 70.0, "Low", 0),
        ]
        route_b = {
            "id": "route-b",
            "name": "Route B (Fast, but 10 Severe mi)",
            "distance_miles": 70.0,
            "duration_seconds": 7200.0,
            "duration_formatted": "2h 00m",
            "checkpoints": cp_b,
        }

        routes = [route_b, route_a]
        ranked, rec = rank_and_recommend_routes(routes)

        self.assertEqual(rec.status, "recommended")
        self.assertEqual(rec.recommended_route_id, "route-a")
        self.assertEqual(rec.decision_criterion, "fewest_severe_miles")
        self.assertIn("Route A", rec.explanation)
        self.assertIn("Severe miles", rec.explanation)


class RecommendationTier2HighMilesTests(TestCase):
    """
    Tier 2 Test: When Severe miles are equal, Fewest High miles decides.
    Route A has 0 Severe miles and 15 High miles (4 hours).
    Route B has 0 Severe miles and 30 High miles (2.5 hours).
    Route A MUST win!
    """
    def test_fewest_high_miles_when_severe_tied(self):
        cp_a = [
            make_test_checkpoint(0, 0.0, "Low", 0),
            make_test_checkpoint(1, 50.0, "Low", 0),
            make_test_checkpoint(2, 65.0, "High", 2),  # 15 High miles
            make_test_checkpoint(3, 100.0, "Low", 0),
        ]
        route_a = {
            "id": "route-a",
            "name": "Route A (15 High mi)",
            "distance_miles": 100.0,
            "duration_seconds": 14400.0,
            "checkpoints": cp_a,
        }

        cp_b = [
            make_test_checkpoint(0, 0.0, "Low", 0),
            make_test_checkpoint(1, 30.0, "High", 2),  # 30 High miles
            make_test_checkpoint(2, 60.0, "Low", 0),
        ]
        route_b = {
            "id": "route-b",
            "name": "Route B (30 High mi, Faster)",
            "distance_miles": 60.0,
            "duration_seconds": 9000.0,
            "checkpoints": cp_b,
        }

        routes = [route_b, route_a]
        ranked, rec = rank_and_recommend_routes(routes)

        self.assertEqual(rec.recommended_route_id, "route-a")
        self.assertEqual(rec.decision_criterion, "fewest_high_miles")


class RecommendationTier3AverageRiskTests(TestCase):
    """
    Tier 3 Test: When Severe miles and High miles are tied, Lowest Distance-Weighted Average Risk decides.
    Route A has 0 Severe, 0 High, 20 Moderate miles, 80 Low miles -> Avg Risk = 0.20
    Route B has 0 Severe, 0 High, 60 Moderate miles, 40 Low miles -> Avg Risk = 0.60
    Route A MUST win!
    """
    def test_lowest_average_risk_when_severe_and_high_tied(self):
        cp_a = [
            make_test_checkpoint(0, 0.0, "Low", 0),
            make_test_checkpoint(1, 80.0, "Low", 0),
            make_test_checkpoint(2, 100.0, "Moderate", 1),  # 20 Moderate miles
        ]
        route_a = {
            "id": "route-a",
            "name": "Route A (Lower Avg Risk)",
            "distance_miles": 100.0,
            "duration_seconds": 12000.0,
            "checkpoints": cp_a,
        }

        cp_b = [
            make_test_checkpoint(0, 0.0, "Low", 0),
            make_test_checkpoint(1, 40.0, "Low", 0),
            make_test_checkpoint(2, 100.0, "Moderate", 1), # 60 Moderate miles
        ]
        route_b = {
            "id": "route-b",
            "name": "Route B (Higher Avg Risk)",
            "distance_miles": 100.0,
            "duration_seconds": 10000.0,
            "checkpoints": cp_b,
        }

        routes = [route_b, route_a]
        ranked, rec = rank_and_recommend_routes(routes)

        self.assertEqual(rec.recommended_route_id, "route-a")
        self.assertEqual(rec.decision_criterion, "lowest_average_risk")


class RecommendationTier4TravelTimeTests(TestCase):
    """
    Tier 4 Test: When safety metrics (Severe miles, High miles, Avg risk) are completely identical,
    Shortest Travel Time is the tie-breaker.
    """
    def test_shortest_travel_time_when_all_safety_metrics_identical(self):
        # Both routes have identical 100 miles, 0 Severe, 0 High, identical Moderate miles
        cp_a = [
            make_test_checkpoint(0, 0.0, "Low", 0),
            make_test_checkpoint(1, 100.0, "Low", 0),
        ]
        route_a = {
            "id": "route-a",
            "name": "Route A (3 hours)",
            "distance_miles": 100.0,
            "duration_seconds": 10800.0,
            "checkpoints": cp_a,
        }

        cp_b = [
            make_test_checkpoint(0, 0.0, "Low", 0),
            make_test_checkpoint(1, 100.0, "Low", 0),
        ]
        route_b = {
            "id": "route-b",
            "name": "Route B (2.5 hours)",
            "distance_miles": 100.0,
            "duration_seconds": 9000.0,
            "checkpoints": cp_b,
        }

        routes = [route_a, route_b]
        ranked, rec = rank_and_recommend_routes(routes)

        # Route B is faster, so Route B wins on Tier 4!
        self.assertEqual(rec.recommended_route_id, "route-b")
        self.assertEqual(rec.decision_criterion, "shortest_travel_time")


class RecommendationIneligibilityNoTravelTests(TestCase):
    """
    Tests that any route with a No Travel checkpoint is excluded from recommendation.
    """
    def test_route_with_no_travel_excluded(self):
        # Route A: Very short, fast, but contains 1 No Travel checkpoint
        cp_a = [
            make_test_checkpoint(0, 0.0, "Low", 0),
            make_test_checkpoint(1, 30.0, "No Travel", 4),
            make_test_checkpoint(2, 50.0, "Low", 0),
        ]
        route_a = {
            "id": "route-a",
            "name": "Route A (Fast, but No Travel hazard)",
            "distance_miles": 50.0,
            "duration_seconds": 3600.0,
            "checkpoints": cp_a,
        }

        # Route B: Longer, 10 Severe miles, but ELIGIBLE (No 'No Travel' checkpoints)
        cp_b = [
            make_test_checkpoint(0, 0.0, "Low", 0),
            make_test_checkpoint(1, 40.0, "Severe", 3),
            make_test_checkpoint(2, 100.0, "Low", 0),
        ]
        route_b = {
            "id": "route-b",
            "name": "Route B (Eligible)",
            "distance_miles": 100.0,
            "duration_seconds": 7200.0,
            "checkpoints": cp_b,
        }

        routes = [route_a, route_b]
        ranked, rec = rank_and_recommend_routes(routes)

        # Route A is excluded; Route B must win!
        self.assertEqual(rec.recommended_route_id, "route-b")
        self.assertIn("route-a", rec.ineligible_route_ids)


class RecommendationAllIneligibleWarningTests(TestCase):
    """
    Tests when ALL candidate routes encounter No Travel checkpoints.
    Must return recommended_route_id = None and clear warning.
    """
    def test_all_ineligible_returns_clear_warning(self):
        cp_a = [
            make_test_checkpoint(0, 0.0, "Low", 0),
            make_test_checkpoint(1, 50.0, "No Travel", 4),
        ]
        route_a = {"id": "route-a", "distance_miles": 50.0, "duration_seconds": 3600.0, "checkpoints": cp_a}

        cp_b = [
            make_test_checkpoint(0, 0.0, "Low", 0),
            make_test_checkpoint(1, 60.0, "No Travel", 4),
        ]
        route_b = {"id": "route-b", "distance_miles": 60.0, "duration_seconds": 4000.0, "checkpoints": cp_b}

        routes = [route_a, route_b]
        ranked, rec = rank_and_recommend_routes(routes)

        self.assertIsNone(rec.recommended_route_id)
        self.assertEqual(rec.status, "no_eligible_routes")
        self.assertIn("No route meets the configured safety rules", rec.explanation)
        self.assertEqual(len(rec.ineligible_route_ids), 2)


class ConsistentRiskMilesAndSegmentSumTests(TestCase):
    """
    Verifies risk miles sum consistently to total route distance and checkpoint locations
    are not counted as miles.
    """
    def test_risk_miles_sum_to_total_distance(self):
        checkpoints = [
            make_test_checkpoint(0, 0.0, "Low", 0),
            make_test_checkpoint(1, 25.0, "Moderate", 1),
            make_test_checkpoint(2, 50.0, "High", 2),
            make_test_checkpoint(3, 75.0, "Severe", 3),
            make_test_checkpoint(4, 100.0, "Low", 0),
        ]
        metrics = calculate_route_risk_metrics(checkpoints, total_distance_miles=100.0, travel_time_seconds=7200.0)

        sum_miles = (
            metrics.low_miles
            + metrics.moderate_miles
            + metrics.high_miles
            + metrics.severe_miles
            + metrics.no_travel_miles
            + metrics.unknown_miles
        )
        self.assertAlmostEqual(sum_miles, 100.0, places=1)
        self.assertEqual(metrics.total_distance_miles, 100.0)


class RecommendationMissingDataTests(TestCase):
    """
    Engineering rule: Never present missing weather data as safe weather.
    A route containing checkpoints with unknown or missing weather forecasts
    must be flagged as ineligible.
    """
    def test_missing_weather_data_makes_route_ineligible(self):
        cp_with_missing = [
            make_test_checkpoint(0, 0.0, "Low", 0),
            {
                "index": 1,
                "name": "Checkpoint 1",
                "cumulative_distance_miles": 50.0,
                "risk": {
                    "overall_risk": "Unknown",
                    "overall_score": -1,
                    "is_safe": False,
                    "is_no_travel": False,
                    "explanation": "Weather forecast unavailable beyond 48h horizon."
                }
            },
            make_test_checkpoint(2, 100.0, "Low", 0),
        ]
        route_missing = {
            "id": "route-missing",
            "name": "Route With Missing Weather",
            "distance_miles": 100.0,
            "duration_seconds": 5000.0,
            "checkpoints": cp_with_missing,
        }

        cp_valid = [
            make_test_checkpoint(0, 0.0, "Low", 0),
            make_test_checkpoint(1, 100.0, "Moderate", 1),
        ]
        route_valid = {
            "id": "route-valid",
            "name": "Route With Known Weather",
            "distance_miles": 100.0,
            "duration_seconds": 6000.0,
            "checkpoints": cp_valid,
        }

        routes = [route_missing, route_valid]
        ranked, rec = rank_and_recommend_routes(routes)

        self.assertEqual(rec.recommended_route_id, "route-valid")
        self.assertIn("route-missing", rec.ineligible_route_ids)


class RecommendationTiedRoutesTests(TestCase):
    """
    Test behavior when multiple eligible routes have identical metrics across all four tiers.
    """
    def test_completely_identical_routes_handled_gracefully(self):
        cp_1 = [
            make_test_checkpoint(0, 0.0, "Low", 0),
            make_test_checkpoint(1, 100.0, "Low", 0),
        ]
        route_1 = {
            "id": "route-1",
            "name": "Route 1",
            "distance_miles": 100.0,
            "duration_seconds": 7200.0,
            "checkpoints": cp_1,
        }

        cp_2 = [
            make_test_checkpoint(0, 0.0, "Low", 0),
            make_test_checkpoint(1, 100.0, "Low", 0),
        ]
        route_2 = {
            "id": "route-2",
            "name": "Route 2",
            "distance_miles": 100.0,
            "duration_seconds": 7200.0,
            "checkpoints": cp_2,
        }

        routes = [route_1, route_2]
        ranked, rec = rank_and_recommend_routes(routes)

        self.assertEqual(rec.status, "recommended")
        self.assertIn(rec.recommended_route_id, ["route-1", "route-2"])
        self.assertEqual(rec.decision_criterion, "identical")
        self.assertEqual(len(rec.ranked_route_ids), 2)


class RouteRecommendationApiIntegrationTests(TestCase):
    """
    Integration tests verifying POST /api/routes/preview/ with departure_time
    produces fully calculated metrics and recommendation payloads.
    """
    def setUp(self):
        self.client = APIClient()
        self.url = reverse('routes-preview')

    @patch('routing.views.preview_routes')
    @patch('routing.views.enrich_checkpoints_with_weather')
    def test_preview_endpoint_returns_metrics_and_recommendation(self, mock_enrich, mock_preview):
        mock_preview.return_value = {
            "provider": "mock",
            "origin": {"query": "New York, NY", "coordinates": [-74.006, 40.7128]},
            "destination": {"query": "Boston, MA", "coordinates": [-71.0589, 42.3601]},
            "routes_count": 2,
            "routes": [
                {
                    "id": "route-1",
                    "name": "Route 1",
                    "distance_miles": 200.0,
                    "duration_seconds": 14000.0,
                    "duration_formatted": "3h 53m",
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [[-74.006, 40.7128], [-72.5, 41.5], [-71.0589, 42.3601]]
                    }
                },
                {
                    "id": "route-2",
                    "name": "Route 2",
                    "distance_miles": 210.0,
                    "duration_seconds": 15000.0,
                    "duration_formatted": "4h 10m",
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [[-74.006, 40.7128], [-73.0, 41.7], [-71.0589, 42.3601]]
                    }
                }
            ]
        }

        # enrich_checkpoints_with_weather populates cp.weather with safe low weather
        def fake_enrich(cps):
            for cp in cps:
                cp.weather = NormalizedWeather(
                    wind_speed_mph=15.0,
                    precipitation_in_hr=0.01,
                    snowfall_in_hr=0.0,
                    temperature_f=65.0,
                    weather_code=0,
                    weather_description="Clear sky",
                    forecast_time="2026-10-20T10:00:00+00:00",
                    is_available=True,
                )
        mock_enrich.side_effect = fake_enrich

        payload = {
            "origin": "New York, NY",
            "destination": "Boston, MA",
            "departure_time": "2026-10-20T10:00:00Z",
            "load_weight_lb": 42000.0,
            "sampling_interval_miles": 25,
        }

        response = self.client.post(self.url, payload, format='json')
        self.assertEqual(response.status_code, 200)
        data = response.json()

        self.assertIn("recommendation", data)
        rec = data["recommendation"]
        self.assertIn("recommended_route_id", rec)
        self.assertIn("decision_criterion", rec)
        self.assertIn("explanation", rec)
        self.assertIn("tradeoffs_summary", rec)

        for route in data["routes"]:
            self.assertIn("metrics", route)
            metrics = route["metrics"]
            self.assertIn("severe_miles", metrics)
            self.assertIn("high_miles", metrics)
            self.assertIn("distance_weighted_average_risk", metrics)
            self.assertIn("is_eligible", metrics)


# =========================================================================
# PHASE 6: END-TO-END PLANNING ENDPOINT (POST /api/routes/plan/) TESTS
# =========================================================================

class PlanEndpointSuccessTests(TestCase):
    """
    Verifies full end-to-end execution of POST /api/routes/plan/
    and complete schema serialization.
    """
    def setUp(self):
        self.client = APIClient()
        self.url = reverse('routes-plan')

    @patch('routing.services.planner.get_routing_provider')
    @patch('routing.services.planner.enrich_checkpoints_with_weather')
    def test_plan_endpoint_complete_pipeline_success(self, mock_enrich, mock_get_provider):
        mock_provider = MagicMock()
        mock_provider.provider_name = "mock_provider"
        mock_provider.geocode.side_effect = [
            ResolvedLocation("Philadelphia, PA", "Philadelphia, PA, USA", [-75.1635, 39.9527]),
            ResolvedLocation("Baltimore, MD", "Baltimore, MD, USA", [-76.6108, 39.2909]),
        ]
        mock_provider.get_routes.return_value = [
            NormalizedRoute(
                id="route-1",
                name="Route 1 (I-95 S)",
                distance_meters=157000.0,
                distance_miles=97.56,
                duration_seconds=7200.0,
                duration_hours=2.0,
                duration_formatted="2h 00m",
                summary="I-95 S",
                geometry={
                    "type": "LineString",
                    "coordinates": [[-75.1635, 39.9527], [-75.8, 39.6], [-76.6108, 39.2909]]
                },
            ),
            NormalizedRoute(
                id="route-2",
                name="Route 2 (US-1 S)",
                distance_meters=170000.0,
                distance_miles=105.63,
                duration_seconds=8400.0,
                duration_hours=2.33,
                duration_formatted="2h 20m",
                summary="US-1 S",
                geometry={
                    "type": "LineString",
                    "coordinates": [[-75.1635, 39.9527], [-75.9, 39.7], [-76.6108, 39.2909]]
                },
            )
        ]
        mock_get_provider.return_value = mock_provider

        def fake_enrich(cps):
            for cp in cps:
                cp.weather = NormalizedWeather(
                    wind_speed_mph=18.0,
                    precipitation_in_hr=0.02,
                    snowfall_in_hr=0.0,
                    temperature_f=65.0,
                    weather_code=0,
                    weather_description="Clear sky",
                    forecast_time="2026-10-20T10:00:00+00:00",
                    is_available=True,
                )
        mock_enrich.side_effect = fake_enrich

        payload = {
            "origin": "Philadelphia, PA",
            "destination": "Baltimore, MD",
            "departure_time": "2026-10-20T10:00:00Z",
            "load_weight_lb": 42000,
            "sampling_interval_miles": 25,
        }

        response = self.client.post(self.url, payload, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        data = response.json()

        # 1. Status & Trip metadata
        self.assertEqual(data.get("status"), "success")
        self.assertIn("trip", data)
        trip = data["trip"]
        self.assertEqual(trip["departure_time"], "2026-10-20T10:00:00+00:00")
        self.assertEqual(trip["load_weight_lb"], 42000.0)
        self.assertEqual(trip["sampling_interval_miles"], 25)
        self.assertEqual(trip["provider"], "mock_provider")
        self.assertIn("requested_at", trip)
        self.assertIn("coordinate_convention", trip)

        # 2. Routes
        self.assertEqual(data.get("routes_count"), 2)
        self.assertEqual(len(data.get("routes")), 2)
        r1 = data["routes"][0]
        self.assertIn("geometry", r1)
        self.assertIn("distance_miles", r1)
        self.assertIn("duration_formatted", r1)
        self.assertIn("checkpoints", r1)
        self.assertTrue(len(r1["checkpoints"]) >= 2)

        # Checkpoints schema
        cp0 = r1["checkpoints"][0]
        self.assertIn("cumulative_distance_miles", cp0)
        self.assertIn("estimated_arrival_time", cp0)
        self.assertIn("coordinates", cp0)
        self.assertIn("weather", cp0)
        self.assertIn("risk", cp0)
        self.assertIn("overall_risk", cp0["risk"])

        # Metrics schema
        self.assertIn("metrics", r1)
        m = r1["metrics"]
        self.assertIn("severe_miles", m)
        self.assertIn("high_miles", m)
        self.assertIn("distance_weighted_average_risk", m)
        self.assertIn("is_eligible", m)
        self.assertTrue(m["is_eligible"])

        # 3. Recommendation schema
        self.assertIn("recommendation", data)
        rec = data["recommendation"]
        self.assertEqual(rec["status"], "recommended")
        self.assertIsNotNone(rec["recommended_route_id"])
        self.assertIn("decision_criterion", rec)
        self.assertIn("explanation", rec)
        self.assertIn("tradeoffs_summary", rec)

        # 4. Warnings and Units
        self.assertIn("warnings", data)
        self.assertIn("units", data)


class PlanEndpointInputValidationTests(TestCase):
    """
    Tests input validation and HTTP 400 error responses for POST /api/routes/plan/.
    """
    def setUp(self):
        self.client = APIClient()
        self.url = reverse('routes-plan')
        self.valid_payload = {
            "origin": "Philadelphia, PA",
            "destination": "Baltimore, MD",
            "departure_time": "2026-10-20T10:00:00Z",
            "load_weight_lb": 40000,
            "sampling_interval_miles": 25,
        }

    def test_missing_origin(self):
        payload = dict(self.valid_payload)
        del payload["origin"]
        response = self.client.post(self.url, payload, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json().get("error"), "invalid_input")
        self.assertIn("'origin' field is required", response.json().get("message", ""))

    def test_missing_destination(self):
        payload = dict(self.valid_payload)
        del payload["destination"]
        response = self.client.post(self.url, payload, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json().get("error"), "invalid_input")
        self.assertIn("'destination' field is required", response.json().get("message", ""))

    def test_missing_departure_time(self):
        payload = dict(self.valid_payload)
        del payload["departure_time"]
        response = self.client.post(self.url, payload, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json().get("error"), "invalid_input")
        self.assertIn("'departure_time' is required", response.json().get("message", ""))

    def test_naive_departure_time_without_timezone_rejected(self):
        # Naive datetime without timezone offset (e.g. 2026-10-20T10:00:00) MUST return 400
        payload = dict(self.valid_payload)
        payload["departure_time"] = "2026-10-20T10:00:00"
        response = self.client.post(self.url, payload, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json().get("error"), "invalid_input")
        self.assertIn("explicit timezone offset", response.json().get("message", ""))

    def test_invalid_departure_time_string_rejected(self):
        payload = dict(self.valid_payload)
        payload["departure_time"] = "invalid-date-not-iso"
        response = self.client.post(self.url, payload, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json().get("error"), "invalid_input")

    def test_missing_load_weight_lb(self):
        payload = dict(self.valid_payload)
        del payload["load_weight_lb"]
        response = self.client.post(self.url, payload, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json().get("error"), "invalid_input")
        self.assertIn("load_weight_lb", response.json().get("message", ""))

    def test_negative_load_weight_lb(self):
        payload = dict(self.valid_payload)
        payload["load_weight_lb"] = -500.0
        response = self.client.post(self.url, payload, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json().get("error"), "invalid_input")
        self.assertIn("non-negative", response.json().get("message", ""))

    def test_invalid_sampling_interval(self):
        payload = dict(self.valid_payload)
        payload["sampling_interval_miles"] = 15  # Only 10, 25, 50 valid
        response = self.client.post(self.url, payload, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json().get("error"), "invalid_input")
        self.assertIn("sampling_interval_miles", response.json().get("message", ""))

    def test_non_dictionary_payload_rejected(self):
        response = self.client.post(self.url, ["not", "a", "dict"], format='json')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json().get("error"), "invalid_payload")


class PlanEndpointProviderFailuresTests(TestCase):
    """
    Tests upstream provider failures returning proper HTTP status codes:
    502 (ProviderUnavailableError), 429 (RateLimitError), 503 (MissingApiKeyError), 404 (GeocodingError / NoRoutesFoundError).
    """
    def setUp(self):
        self.client = APIClient()
        self.url = reverse('routes-plan')
        self.payload = {
            "origin": "Philadelphia, PA",
            "destination": "Baltimore, MD",
            "departure_time": "2026-10-20T10:00:00Z",
            "load_weight_lb": 40000,
            "sampling_interval_miles": 25,
        }

    @patch('routing.services.planner.get_routing_provider')
    def test_provider_unavailable_returns_502(self, mock_get_provider):
        mock_provider = MagicMock()
        mock_provider.geocode.side_effect = ProviderUnavailableError("ORS connection timed out.")
        mock_get_provider.return_value = mock_provider

        response = self.client.post(self.url, self.payload, format='json')
        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.json().get("error"), "upstream_provider_unavailable")

    @patch('routing.services.planner.get_routing_provider')
    def test_rate_limit_exceeded_returns_429(self, mock_get_provider):
        mock_provider = MagicMock()
        mock_provider.geocode.side_effect = RateLimitError("Rate limit exceeded for provider.")
        mock_get_provider.return_value = mock_provider

        response = self.client.post(self.url, self.payload, format='json')
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.json().get("error"), "rate_limit_exceeded")

    @patch('routing.services.planner.get_routing_provider')
    def test_missing_api_key_returns_503(self, mock_get_provider):
        mock_get_provider.side_effect = MissingApiKeyError("ROUTING_API_KEY required.")

        response = self.client.post(self.url, self.payload, format='json')
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json().get("error"), "missing_credentials")

    @patch('routing.services.planner.get_routing_provider')
    def test_geocoding_failure_returns_404(self, mock_get_provider):
        mock_provider = MagicMock()
        mock_provider.geocode.side_effect = GeocodingError("Could not resolve location: Atlantis")
        mock_get_provider.return_value = mock_provider

        response = self.client.post(self.url, self.payload, format='json')
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json().get("error"), "geocoding_failed")

    @patch('routing.services.planner.get_routing_provider')
    def test_no_routes_found_returns_404(self, mock_get_provider):
        mock_provider = MagicMock()
        mock_provider.geocode.side_effect = [
            ResolvedLocation("Hawaii", "Honolulu, HI", [-157.8583, 21.3069]),
            ResolvedLocation("California", "San Francisco, CA", [-122.4194, 37.7749]),
        ]
        mock_provider.get_routes.return_value = []
        mock_get_provider.return_value = mock_provider

        response = self.client.post(self.url, self.payload, format='json')
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json().get("error"), "no_routes_found")


class PlanEndpointUnavailableWeatherAndSafetyTests(TestCase):
    """
    Engineering rule: Never present missing weather data as safe weather.
    If weather is unavailable for checkpoints, route must be marked ineligible,
    warnings populated, and route excluded from recommendation.
    """
    def setUp(self):
        self.client = APIClient()
        self.url = reverse('routes-plan')

    @patch('routing.services.planner.get_routing_provider')
    @patch('routing.services.planner.enrich_checkpoints_with_weather')
    def test_unavailable_weather_marks_route_ineligible_and_adds_warning(self, mock_enrich, mock_get_provider):
        mock_provider = MagicMock()
        mock_provider.provider_name = "mock_provider"
        mock_provider.geocode.side_effect = [
            ResolvedLocation("A", "Loc A", [-75.0, 40.0]),
            ResolvedLocation("B", "Loc B", [-74.0, 40.0]),
        ]
        mock_provider.get_routes.return_value = [
            NormalizedRoute(
                id="route-1",
                name="Route 1",
                distance_meters=100000.0,
                distance_miles=62.14,
                duration_seconds=3600.0,
                duration_hours=1.0,
                duration_formatted="1h 00m",
                summary="Route 1",
                geometry={"type": "LineString", "coordinates": [[-75.0, 40.0], [-74.0, 40.0]]},
            )
        ]
        mock_get_provider.return_value = mock_provider

        # Checkpoints with unavailable weather
        def fake_enrich_unavailable(cps):
            for cp in cps:
                cp.weather = NormalizedWeather.unavailable(
                    status="outside_forecast_horizon",
                    error_message="Forecast beyond horizon",
                )
        mock_enrich.side_effect = fake_enrich_unavailable

        payload = {
            "origin": "Loc A",
            "destination": "Loc B",
            "departure_time": "2026-10-20T10:00:00Z",
            "load_weight_lb": 35000,
            "sampling_interval_miles": 25,
        }

        response = self.client.post(self.url, payload, format='json')
        self.assertEqual(response.status_code, 200)
        data = response.json()

        # Route should be ineligible
        r1 = data["routes"][0]
        self.assertFalse(r1["metrics"]["is_eligible"])
        self.assertTrue(r1["metrics"]["has_unknown"])

        # Recommendation should be no_eligible_routes
        rec = data["recommendation"]
        self.assertEqual(rec["status"], "no_eligible_routes")
        self.assertIsNone(rec["recommended_route_id"])

        # Warnings should contain an explicit notice
        warnings = data.get("warnings", [])
        self.assertTrue(any("Weather forecast unavailable" in w for w in warnings))



