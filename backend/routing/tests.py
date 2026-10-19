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
        self.assertEqual(data.get('phase'), 3)

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
        # Create a synthetic straight east-west line of approx 100 miles
        # At latitude 40 N, 1 degree longitude is ~53 miles
        # 0 to 1.887 degrees ~ 100 miles
        self.origin = [-75.0, 40.0]
        self.destination = [-73.113, 40.0]
        # Multi-vertex geometry along road
        self.coords = [
            [-75.0, 40.0],
            [-74.5, 40.0],
            [-74.0, 40.0],
            [-73.5, 40.0],
            [-73.113, 40.0]
        ]
        self.departure_time = "2026-10-20T08:00:00-04:00"
        self.duration_seconds = 7200.0  # 2 hours

    def test_valid_intervals_10_25_50_miles(self):
        for interval in (10, 25, 50):
            checkpoints = generate_checkpoints(
                self.coords,
                departure_time=self.departure_time,
                duration_seconds=self.duration_seconds,
                interval_miles=interval
            )
            self.assertGreater(len(checkpoints), 2)
            # Origin checks
            self.assertTrue(checkpoints[0].is_origin)
            self.assertEqual(checkpoints[0].cumulative_distance_miles, 0.0)
            self.assertEqual(checkpoints[0].coordinates, self.coords[0])
            # Destination checks
            self.assertTrue(checkpoints[-1].is_destination)
            self.assertEqual(checkpoints[-1].coordinates, self.coords[-1])

    def test_invalid_interval_raises_value_error(self):
        with self.assertRaises(ValueError):
            generate_checkpoints(self.coords, self.departure_time, self.duration_seconds, interval_miles=15)

    def test_checkpoints_follow_actual_geometry_not_straight_endpoints(self):
        # L-shaped detour route: (0,0) -> (0, 1) -> (1, 1)
        detour_coords = [[-75.0, 40.0], [-75.0, 40.5], [-74.5, 40.5]]
        checkpoints = generate_checkpoints(detour_coords, self.departure_time, 3600, interval_miles=10)
        # Check that intermediate points have longitude close to -75.0 before turning
        self.assertAlmostEqual(checkpoints[1].coordinates[0], -75.0, places=2)

    def test_always_includes_destination_and_avoids_duplicates(self):
        # Route distance slightly longer than 50 miles (e.g. 50.3 miles)
        # 25-mile interval should give 0, 25, 50, and Destination (50.3)
        checkpoints = generate_checkpoints(self.coords, self.departure_time, self.duration_seconds, interval_miles=25)
        self.assertTrue(checkpoints[-1].is_destination)
        # Check that the last point is not duplicated
        if len(checkpoints) >= 2:
            self.assertNotEqual(
                checkpoints[-1].coordinates,
                checkpoints[-2].coordinates
            )

    def test_cumulative_distances_and_etas_increase_monotonically(self):
        checkpoints = generate_checkpoints(self.coords, self.departure_time, self.duration_seconds, interval_miles=25)
        for i in range(len(checkpoints) - 1):
            curr_cp = checkpoints[i]
            next_cp = checkpoints[i + 1]
            self.assertLess(curr_cp.cumulative_distance_meters, next_cp.cumulative_distance_meters)
            self.assertLess(curr_cp.cumulative_distance_miles, next_cp.cumulative_distance_miles)
            self.assertGreater(next_cp.segment_distance_miles, 0.0)

            # ETA checks
            t1 = datetime.fromisoformat(curr_cp.estimated_arrival_time)
            t2 = datetime.fromisoformat(next_cp.estimated_arrival_time)
            self.assertLess(t1, t2)

    def test_timezone_preservation(self):
        checkpoints = generate_checkpoints(self.coords, "2026-10-20T10:00:00-05:00", 3600, interval_miles=25)
        # First checkpoint ETA must reflect the -05:00 offset
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

        # ETA at 13:10 UTC should match 13:00 hour
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
        # Empty hourly series
        w_empty = self.provider.match_checkpoint_weather({}, "2026-10-20T12:00:00Z")
        self.assertFalse(w_empty.is_available)
        self.assertIsNone(w_empty.wind_speed_mph)
        self.assertIsNone(w_empty.precipitation_in_hr)
        self.assertNotEqual(w_empty.status, "available")

        # Arrival time far outside the forecast window (e.g. year 2029)
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


class RouteCheckpointsEndpointTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = reverse('routes-checkpoints')

    @patch('routing.weather.open_meteo.OpenMeteoWeatherProvider.fetch_hourly_forecasts')
    def test_checkpoints_endpoint_success(self, mock_fetch):
        # Mock weather provider response
        mock_fetch.return_value = [
            {
                "time": ["2026-10-20T12:00"],
                "wind_speed_10m": [18.5],
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
            "include_weather": True
        }

        response = self.client.post(self.url, payload, format='json')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data.get("status"), "success")
        self.assertEqual(data.get("sampling_interval_miles"), 25)
        checkpoints = data.get("checkpoints", [])
        self.assertGreater(len(checkpoints), 1)

        # Check origin and destination
        self.assertTrue(checkpoints[0]["is_origin"])
        self.assertTrue(checkpoints[-1]["is_destination"])
        # Check weather normalized structure
        w0 = checkpoints[0]["weather"]
        self.assertIn("wind_speed_mph", w0)
        self.assertIn("precipitation_in_hr", w0)
        self.assertIn("snowfall_in_hr", w0)
        self.assertEqual(data.get("units", {}).get("wind_speed"), "mph")
        self.assertEqual(data.get("units", {}).get("precipitation"), "in/hr")
