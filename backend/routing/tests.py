from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from unittest.mock import patch, MagicMock
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
        self.assertEqual(data.get('phase'), 2)

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
        # Passing identical coordinates
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

        # Provider returned 2 routes; must NOT fabricate a 3rd route!
        self.assertEqual(len(routes), 2)

        r1 = routes[0]
        self.assertEqual(r1.id, "route-1")
        self.assertEqual(r1.distance_meters, 348200.0)
        self.assertAlmostEqual(r1.distance_miles, 216.36, places=1)
        self.assertEqual(r1.duration_seconds, 14200.0)
        self.assertAlmostEqual(r1.duration_hours, 3.94, places=1)
        self.assertEqual(r1.duration_formatted, "3h 57m")
        self.assertIn("I-95 N", r1.name)

        # Coordinate format must remain GeoJSON [lon, lat]
        self.assertEqual(r1.geometry["type"], "LineString")
        self.assertEqual(r1.geometry["coordinates"][0], [-74.0060, 40.7128])
        self.assertEqual(r1.geometry["coordinates"][-1], [-71.0589, 42.3601])

        r2 = routes[1]
        self.assertEqual(r2.id, "route-2")
        self.assertIn("I-84 E", r2.name)

    @patch('requests.post')
    def test_single_route_never_duplicated(self, mock_post):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "properties": {"summary": {"distance": 50000.0, "duration": 2000.0}},
                    "geometry": {"type": "LineString", "coordinates": [[0, 0], [1, 1]]}
                }
            ]
        }
        mock_post.return_value = mock_response

        routes = self.provider.get_routes(origin_coords=[0, 0], dest_coords=[1, 1], max_alternatives=3)
        self.assertEqual(len(routes), 1)
        self.assertEqual(routes[0].id, "route-1")


class ProviderErrorHandlingTests(TestCase):
    def setUp(self):
        self.provider = OpenRouteServiceProvider(api_key="mock_key")

    @patch('requests.post')
    def test_rate_limit_raises_RateLimitError(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.status_code = 429
        mock_post.return_value = mock_resp
        with self.assertRaises(RateLimitError):
            self.provider.get_routes([0, 0], [1, 1])

    @patch('requests.post')
    def test_server_error_raises_ProviderUnavailableError(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.status_code = 502
        mock_post.return_value = mock_resp
        with self.assertRaises(ProviderUnavailableError):
            self.provider.get_routes([0, 0], [1, 1])

    @patch('requests.post')
    def test_timeout_raises_ProviderUnavailableError(self, mock_post):
        mock_post.side_effect = requests.exceptions.Timeout("Connection timed out")
        with self.assertRaises(ProviderUnavailableError):
            self.provider.get_routes([0, 0], [1, 1])

    @patch('requests.post')
    def test_no_routes_found_raises_NoRoutesFoundError(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.status_code = 404
        mock_resp.text = "No route found"
        mock_resp.json.return_value = {"error": {"message": "Could not find route"}}
        mock_post.return_value = mock_resp
        with self.assertRaises(NoRoutesFoundError):
            self.provider.get_routes([0, 0], [1, 1])


class EndToEndPreviewEndpointTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = reverse('routes-preview')

    @patch('routing.services.osrm.OSRMProvider.geocode')
    @patch('routing.services.osrm.OSRMProvider.get_routes')
    def test_preview_endpoint_success(self, mock_get_routes, mock_geocode):
        mock_geocode.side_effect = [
            ResolvedLocation(query="New York, NY", display_name="New York, NY, USA", coordinates=[-74.0060, 40.7128]),
            ResolvedLocation(query="Boston, MA", display_name="Boston, MA, USA", coordinates=[-71.0589, 42.3601]),
        ]
        mock_get_routes.return_value = [
            NormalizedRoute(
                id="route-1",
                name="Route 1 (I-95 N)",
                distance_meters=348200.0,
                distance_miles=216.36,
                duration_seconds=14200.0,
                duration_hours=3.94,
                duration_formatted="3h 57m",
                summary="Via I-95 N",
                geometry={"type": "LineString", "coordinates": [[-74.0060, 40.7128], [-71.0589, 42.3601]]}
            )
        ]

        response = self.client.post(
            self.url,
            {"origin": "New York, NY", "destination": "Boston, MA", "provider": "osrm"},
            format='json'
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data.get("status"), "success")
        self.assertEqual(data.get("provider"), "osrm")
        self.assertEqual(data.get("routes_count"), 1)
        self.assertEqual(data.get("origin", {}).get("coordinates"), [-74.0060, 40.7128])
        self.assertEqual(data.get("destination", {}).get("coordinates"), [-71.0589, 42.3601])
        self.assertEqual(len(data.get("routes", [])), 1)
        self.assertEqual(data["routes"][0]["id"], "route-1")
        self.assertEqual(data["routes"][0]["distance_miles"], 216.36)
        self.assertIn("leaflet_note", data.get("coordinate_convention", {}))
