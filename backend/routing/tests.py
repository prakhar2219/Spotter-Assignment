from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from unittest.mock import patch, MagicMock
from datetime import datetime, timezone, timedelta
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
        self.assertEqual(data.get('phase'), 4)

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

        mock_hourly = {
            "time": ["2026-10-20T12:00"],
            "wind_speed_10m": [10.0],
            "precipitation": [0.0],
            "snowfall": [0.0],
            "temperature_2m": [60.0],
            "weather_code": [0],
        }
        w_out = self.provider.match_checkpoint_weather(mock_hourly, "2029-01-01T00:00:00Z")
        self.assertFalse(w_out.is_available)
        self.assertEqual(w_out.status, "outside_forecast_horizon")


class WindRiskThresholdAndLoadRulesTests(TestCase):
    """
    Tests all wind speed thresholds and strict load boundaries:
    - Below 25 mph: Low
    - 25–34 mph: Moderate
    - 35–44 mph: High (Elevated to Severe if load > 40,000 lb)
    - 45–54 mph: Severe (Elevated to No Travel if load > 30,000 lb)
    - >= 55 mph: No Travel (All loads)
    - Tests exactly 30,000 lb and 40,000 lb separately from values above them.
    """

    def test_wind_below_25_is_low(self):
        for wind in [0.0, 10.0, 24.9]:
            eval_res = classify_wind_risk(wind, load_weight_lb=50000)
            self.assertEqual(eval_res.risk, RiskLevel.LOW, f"Failed at wind {wind}")
            self.assertEqual(eval_res.score, 0)
            self.assertFalse(eval_res.elevated_by_load)

    def test_wind_25_to_34_is_moderate(self):
        for wind in [25.0, 29.5, 34.9]:
            eval_res = classify_wind_risk(wind, load_weight_lb=50000)
            self.assertEqual(eval_res.risk, RiskLevel.MODERATE, f"Failed at wind {wind}")
            self.assertEqual(eval_res.score, 1)
            self.assertFalse(eval_res.elevated_by_load)

    def test_wind_35_to_44_standard_and_load_boundary_40k(self):
        # 1. At load <= 40,000 lb: Risk is High
        for wind in [35.0, 40.0, 44.9]:
            # Test light load
            res_light = classify_wind_risk(wind, load_weight_lb=20000)
            self.assertEqual(res_light.risk, RiskLevel.HIGH)
            self.assertEqual(res_light.score, 2)
            self.assertFalse(res_light.elevated_by_load)

            # Test EXACTLY 40,000 lb -> MUST remain High!
            res_exact = classify_wind_risk(wind, load_weight_lb=40000)
            self.assertEqual(res_exact.risk, RiskLevel.HIGH, f"Failed at exact 40,000 lb with wind {wind}")
            self.assertEqual(res_exact.score, 2)
            self.assertFalse(res_exact.elevated_by_load)

            # Test ABOVE 40,000 lb (40,001 lb, 45,000 lb) -> MUST elevate to Severe!
            res_above = classify_wind_risk(wind, load_weight_lb=40001)
            self.assertEqual(res_above.risk, RiskLevel.SEVERE, f"Failed at 40,001 lb with wind {wind}")
            self.assertEqual(res_above.score, 3)
            self.assertTrue(res_above.elevated_by_load)

            res_heavy = classify_wind_risk(wind, load_weight_lb=50000)
            self.assertEqual(res_heavy.risk, RiskLevel.SEVERE)
            self.assertTrue(res_heavy.elevated_by_load)

    def test_wind_45_to_54_standard_and_load_boundary_30k(self):
        # 1. At load <= 30,000 lb: Risk is Severe
        for wind in [45.0, 50.0, 54.9]:
            res_light = classify_wind_risk(wind, load_weight_lb=15000)
            self.assertEqual(res_light.risk, RiskLevel.SEVERE)
            self.assertEqual(res_light.score, 3)
            self.assertFalse(res_light.elevated_by_load)

            # Test EXACTLY 30,000 lb -> MUST remain Severe!
            res_exact = classify_wind_risk(wind, load_weight_lb=30000)
            self.assertEqual(res_exact.risk, RiskLevel.SEVERE, f"Failed at exact 30,000 lb with wind {wind}")
            self.assertEqual(res_exact.score, 3)
            self.assertFalse(res_exact.elevated_by_load)

            # Test ABOVE 30,000 lb (30,001 lb, 35,000 lb) -> MUST elevate to No Travel!
            res_above = classify_wind_risk(wind, load_weight_lb=30001)
            self.assertEqual(res_above.risk, RiskLevel.NO_TRAVEL, f"Failed at 30,001 lb with wind {wind}")
            self.assertEqual(res_above.score, 4)
            self.assertTrue(res_above.elevated_by_load)

            res_heavy = classify_wind_risk(wind, load_weight_lb=45000)
            self.assertEqual(res_heavy.risk, RiskLevel.NO_TRAVEL)
            self.assertTrue(res_heavy.elevated_by_load)

    def test_wind_55_and_above_is_always_no_travel(self):
        # Wind >= 55 mph means No Travel for ANY load (empty, light, heavy)
        for wind in [55.0, 58.5, 75.0, 100.0]:
            for load in [0, 10000, 30000, 40000, 80000]:
                eval_res = classify_wind_risk(wind, load_weight_lb=load)
                self.assertEqual(
                    eval_res.risk,
                    RiskLevel.NO_TRAVEL,
                    f"Failed: wind {wind} mph with load {load} lb did not return No Travel"
                )
                self.assertEqual(eval_res.score, 4)


class RainRiskThresholdTests(TestCase):
    """
    Tests rain intensity thresholds and boundaries:
    - Below 0.10 in/hr: Low
    - 0.10–0.25: Moderate (includes 0.10, up to < 0.25)
    - 0.25–0.50: High (includes 0.25, up to < 0.50)
    - 0.50–1.00: Severe (includes 0.50 and 1.00)
    - Above 1.00: No Travel (> 1.00)
    """

    def test_rain_below_0_10_is_low(self):
        for r in [0.0, 0.05, 0.09]:
            self.assertEqual(classify_rain_risk(r).risk, RiskLevel.LOW)

    def test_rain_0_10_to_0_25_is_moderate(self):
        # Exactly 0.10 must be Moderate
        self.assertEqual(classify_rain_risk(0.10).risk, RiskLevel.MODERATE)
        self.assertEqual(classify_rain_risk(0.18).risk, RiskLevel.MODERATE)
        self.assertEqual(classify_rain_risk(0.249).risk, RiskLevel.MODERATE)

    def test_rain_0_25_to_0_50_is_high(self):
        # Exactly 0.25 must be High
        self.assertEqual(classify_rain_risk(0.25).risk, RiskLevel.HIGH)
        self.assertEqual(classify_rain_risk(0.38).risk, RiskLevel.HIGH)
        self.assertEqual(classify_rain_risk(0.499).risk, RiskLevel.HIGH)

    def test_rain_0_50_to_1_00_is_severe(self):
        # Exactly 0.50 must be Severe
        self.assertEqual(classify_rain_risk(0.50).risk, RiskLevel.SEVERE)
        self.assertEqual(classify_rain_risk(0.75).risk, RiskLevel.SEVERE)
        # Exactly 1.00 must be Severe
        self.assertEqual(classify_rain_risk(1.00).risk, RiskLevel.SEVERE)

    def test_rain_above_1_00_is_no_travel(self):
        for r in [1.001, 1.05, 1.50, 3.0]:
            self.assertEqual(classify_rain_risk(r).risk, RiskLevel.NO_TRAVEL)


class SnowRiskThresholdTests(TestCase):
    """
    Tests snow intensity thresholds and boundaries:
    - Below 0.5 in/hr: Low
    - 0.5–1.0: Moderate
    - 1.0–2.0: High
    - 2.0–3.0: Severe
    - Above 3.0: No Travel
    """

    def test_snow_below_0_50_is_low(self):
        for s in [0.0, 0.2, 0.49]:
            self.assertEqual(classify_snow_risk(s).risk, RiskLevel.LOW)

    def test_snow_0_50_to_1_00_is_moderate(self):
        # Exactly 0.50 must be Moderate
        self.assertEqual(classify_snow_risk(0.50).risk, RiskLevel.MODERATE)
        self.assertEqual(classify_snow_risk(0.75).risk, RiskLevel.MODERATE)
        self.assertEqual(classify_snow_risk(0.99).risk, RiskLevel.MODERATE)

    def test_snow_1_00_to_2_00_is_high(self):
        # Exactly 1.00 must be High
        self.assertEqual(classify_snow_risk(1.00).risk, RiskLevel.HIGH)
        self.assertEqual(classify_snow_risk(1.50).risk, RiskLevel.HIGH)
        self.assertEqual(classify_snow_risk(1.99).risk, RiskLevel.HIGH)

    def test_snow_2_00_to_3_00_is_severe(self):
        # Exactly 2.00 must be Severe
        self.assertEqual(classify_snow_risk(2.00).risk, RiskLevel.SEVERE)
        self.assertEqual(classify_snow_risk(2.50).risk, RiskLevel.SEVERE)
        # Exactly 3.00 must be Severe
        self.assertEqual(classify_snow_risk(3.00).risk, RiskLevel.SEVERE)

    def test_snow_above_3_00_is_no_travel(self):
        for s in [3.001, 3.50, 5.0]:
            self.assertEqual(classify_snow_risk(s).risk, RiskLevel.NO_TRAVEL)


class OverallCheckpointRiskTests(TestCase):
    """
    Tests overall checkpoint risk logic:
    - Worst of wind, rain, snow determines overall risk.
    - Preserves individual condition risks.
    - No Travel on any condition immediately marks checkpoint No Travel.
    """

    def test_worst_condition_determines_overall_risk(self):
        # Wind Severe, Rain Low, Snow Low -> Overall is Severe
        w1 = {"wind_speed_mph": 48.0, "precipitation_in_hr": 0.02, "snowfall_in_hr": 0.0, "is_available": True}
        cp1 = evaluate_checkpoint_risk(w1, load_weight_lb=25000)
        self.assertEqual(cp1.overall_risk, RiskLevel.SEVERE)
        self.assertEqual(cp1.wind.risk, RiskLevel.SEVERE)
        self.assertEqual(cp1.rain.risk, RiskLevel.LOW)
        self.assertEqual(cp1.snow.risk, RiskLevel.LOW)
        self.assertTrue(cp1.is_safe)
        self.assertFalse(cp1.is_no_travel)

        # Wind Low, Rain High, Snow Low -> Overall is High
        w2 = {"wind_speed_mph": 10.0, "precipitation_in_hr": 0.35, "snowfall_in_hr": 0.0, "is_available": True}
        cp2 = evaluate_checkpoint_risk(w2, load_weight_lb=45000)
        self.assertEqual(cp2.overall_risk, RiskLevel.HIGH)
        self.assertEqual(cp2.rain.risk, RiskLevel.HIGH)

        # Wind Low, Rain Low, Snow No Travel -> Overall is No Travel
        w3 = {"wind_speed_mph": 5.0, "precipitation_in_hr": 0.0, "snowfall_in_hr": 3.8, "is_available": True}
        cp3 = evaluate_checkpoint_risk(w3, load_weight_lb=20000)
        self.assertEqual(cp3.overall_risk, RiskLevel.NO_TRAVEL)
        self.assertFalse(cp3.is_safe)
        self.assertTrue(cp3.is_no_travel)

    def test_load_elevation_causes_no_travel(self):
        # 48 mph wind with 30,000 lb is Severe (Safe to travel)
        w = {"wind_speed_mph": 48.0, "precipitation_in_hr": 0.0, "snowfall_in_hr": 0.0, "is_available": True}
        cp_safe = evaluate_checkpoint_risk(w, load_weight_lb=30000)
        self.assertEqual(cp_safe.overall_risk, RiskLevel.SEVERE)
        self.assertFalse(cp_safe.is_no_travel)

        # 48 mph wind with 30,001 lb is No Travel (Ineligible!)
        cp_unsafe = evaluate_checkpoint_risk(w, load_weight_lb=30001)
        self.assertEqual(cp_unsafe.overall_risk, RiskLevel.NO_TRAVEL)
        self.assertTrue(cp_unsafe.is_no_travel)
        self.assertFalse(cp_unsafe.is_safe)


class InvalidAndMissingWeatherRiskTests(TestCase):
    """
    Tests that unknown weather is NEVER classified as safe.
    """

    def test_missing_weather_is_unknown_and_unsafe(self):
        cp_none = evaluate_checkpoint_risk(None)
        self.assertEqual(cp_none.overall_risk, RiskLevel.UNKNOWN)
        self.assertFalse(cp_none.is_safe)
        self.assertEqual(cp_none.overall_score, -1)

        w_unavail = {"is_available": False, "wind_speed_mph": None}
        cp_unavail = evaluate_checkpoint_risk(w_unavail)
        self.assertEqual(cp_unavail.overall_risk, RiskLevel.UNKNOWN)
        self.assertFalse(cp_unavail.is_safe)

    def test_partial_missing_weather_cannot_be_verified_as_safe(self):
        # Wind is known Low, but precipitation is None
        w_partial = {"wind_speed_mph": 12.0, "precipitation_in_hr": None, "snowfall_in_hr": 0.0, "is_available": True}
        cp_partial = evaluate_checkpoint_risk(w_partial)
        self.assertEqual(cp_partial.overall_risk, RiskLevel.UNKNOWN)
        self.assertFalse(cp_partial.is_safe)

    def test_invalid_negative_values_produce_unknown_risk(self):
        w_neg = {"wind_speed_mph": -10.0, "precipitation_in_hr": 0.0, "snowfall_in_hr": 0.0, "is_available": True}
        cp_neg = evaluate_checkpoint_risk(w_neg)
        self.assertEqual(cp_neg.overall_risk, RiskLevel.UNKNOWN)
        self.assertFalse(cp_neg.is_safe)


class RouteCheckpointsEndpointTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = reverse('routes-checkpoints')

    @patch('routing.weather.open_meteo.OpenMeteoWeatherProvider.fetch_hourly_forecasts')
    def test_checkpoints_endpoint_with_risk_evaluation(self, mock_fetch):
        mock_fetch.return_value = [
            {
                "time": ["2026-10-20T12:00"],
                "wind_speed_10m": [48.0],
                "precipitation": [0.12],
                "snowfall": [0.0],
                "temperature_2m": [65.0],
                "weather_code": [2],
            }
        ] * 10

        payload = {
            "route_coordinates": [[-75.16, 39.95], [-74.5, 40.2], [-73.98, 40.75]],
            "departure_time": "2026-10-20T12:00:00Z",
            "duration_seconds": 5400,
            "sampling_interval_miles": 25,
            "load_weight_lb": 45000,
            "include_weather": True
        }

        response = self.client.post(self.url, payload, format='json')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data.get("status"), "success")
        self.assertEqual(data.get("load_weight_lb"), 45000)
        checkpoints = data.get("checkpoints", [])
        self.assertGreater(len(checkpoints), 1)

        # 48 mph wind with 45,000 lb (>30,000 lb) must evaluate to No Travel
        cp0_risk = checkpoints[0]["risk"]
        self.assertEqual(cp0_risk["overall_risk"], "No Travel")
        self.assertTrue(cp0_risk["is_no_travel"])
        self.assertFalse(cp0_risk["is_safe"])
        self.assertEqual(cp0_risk["conditions"]["wind"]["risk"], "No Travel")
        self.assertTrue(cp0_risk["conditions"]["wind"]["elevated_by_load"])
