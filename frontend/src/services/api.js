const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

/**
 * Fetch health check from the Django REST Framework backend.
 * @returns {Promise<{success: boolean, data: any, latencyMs: number, error: string|null}>}
 */
export async function checkBackendHealth() {
  const startTime = performance.now();
  try {
    const response = await fetch(`${API_BASE_URL}/api/health/`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    const latencyMs = Math.round(performance.now() - startTime);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      success: true,
      data,
      latencyMs,
      error: null,
    };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - startTime);
    return {
      success: false,
      data: null,
      latencyMs,
      error: err.message || 'Failed to connect to Django backend',
    };
  }
}

/**
 * Request genuine route alternatives from the Django routing service.
 * @param {Object} params
 * @param {string|Array<number>} params.origin - Place query or [lon, lat]
 * @param {string|Array<number>} params.destination - Place query or [lon, lat]
 * @param {string} [params.provider] - Optional provider override ('openrouteservice', 'mapbox', 'osrm')
 * @param {number} [params.maxAlternatives=3] - Target alternative count
 * @returns {Promise<{success: boolean, data: any, error: string|null}>}
 */
export async function previewRoutes({ origin, destination, provider, maxAlternatives = 3 }) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/routes/preview/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        origin,
        destination,
        provider,
        max_alternatives: maxAlternatives,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || data.error || `HTTP ${response.status}`);
    }

    return {
      success: true,
      data,
      error: null,
    };
  } catch (err) {
    return {
      success: false,
      data: null,
      error: err.message || 'Failed to generate routes',
    };
  }
}
