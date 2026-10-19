from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

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
        self.assertEqual(data.get('phase'), 1)

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
