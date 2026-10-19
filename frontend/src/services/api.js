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
 * Request genuine route alternatives with checkpoints, weather, and load-dependent risk evaluation.
 * @param {Object} params
 * @param {string|Array<number>} params.origin - Place query or [lon, lat]
 * @param {string|Array<number>} params.destination - Place query or [lon, lat]
 * @param {string} [params.provider] - Optional provider override ('openrouteservice', 'mapbox', 'osrm')
 * @param {number} [params.maxAlternatives=3] - Target alternative count
 * @param {string} [params.departureTime] - ISO 8601 departure timestamp
 * @param {number} [params.loadWeightLb=40000] - Truck gross cargo load weight in pounds
 * @param {number} [params.samplingIntervalMiles=25] - Checkpoint interval (10, 25, 50)
 * @returns {Promise<{success: boolean, data: any, error: string|null}>}
 */
export async function previewRoutes({
  origin,
  destination,
  provider,
  maxAlternatives = 3,
  departureTime,
  loadWeightLb = 40000,
  samplingIntervalMiles = 25,
}) {
  try {
    const payload = {
      origin,
      destination,
      provider,
      max_alternatives: maxAlternatives,
      sampling_interval_miles: samplingIntervalMiles,
      load_weight_lb: loadWeightLb,
    };
    if (departureTime) {
      payload.departure_time = departureTime;
    }

    const response = await fetch(`${API_BASE_URL}/api/routes/preview/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
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

/**
 * Request end-to-end trip planning analysis from POST /api/routes/plan/.
 * Executes full routing, time-aware checkpoint generation, Open-Meteo weather forecasts,
 * load-dependent risk evaluation, and strict 4-tier lexicographical recommendation.
 * @param {Object} params
 * @param {string|Array<number>} params.origin - Place query or [lon, lat]
 * @param {string|Array<number>} params.destination - Place query or [lon, lat]
 * @param {string} params.departureTime - ISO 8601 departure timestamp with explicit timezone
 * @param {number} params.loadWeightLb - Truck gross cargo load weight in pounds
 * @param {number} params.samplingIntervalMiles - Checkpoint interval (10, 25, 50)
 * @param {string} [params.provider] - Optional provider override ('openrouteservice', 'mapbox', 'osrm')
 * @param {number} [params.maxAlternatives=3] - Target alternative count
 * @returns {Promise<{success: boolean, data: any, error: string|null}>}
 */
export async function planTrip({
  origin,
  destination,
  departureTime,
  loadWeightLb,
  samplingIntervalMiles = 25,
  provider,
  maxAlternatives = 3,
}) {
  try {
    const payload = {
      origin,
      destination,
      departure_time: departureTime,
      load_weight_lb: loadWeightLb,
      sampling_interval_miles: samplingIntervalMiles,
      max_alternatives: maxAlternatives,
    };
    if (provider) {
      payload.provider = provider;
    }

    const response = await fetch(`${API_BASE_URL}/api/routes/plan/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
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
      error: err.message || 'Failed to execute trip plan',
    };
  }
}

