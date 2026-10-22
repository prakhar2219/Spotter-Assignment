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

const DEFAULT_HUBS = [
  { name: 'Chicago, IL, USA', category: 'city', coordinates: [-87.6298, 41.8781] },
  { name: 'New York, NY, USA', category: 'city', coordinates: [-74.0060, 40.7128] },
  { name: 'Dallas, TX, USA', category: 'city', coordinates: [-96.7970, 32.7767] },
  { name: 'Atlanta, GA, USA', category: 'city', coordinates: [-84.3880, 33.7490] },
  { name: 'Los Angeles, CA, USA', category: 'city', coordinates: [-118.2437, 34.0522] },
];

/**
 * Fetch autocomplete location suggestions from backend.
 * @param {string} [query='']
 * @param {number} [limit=5]
 * @returns {Promise<Array<{name: string, category: string, coordinates: [number, number]}>>}
 */
export async function fetchLocationSuggestions(query = '', limit = 5) {
  const cleanQ = (query || '').trim();
  try {
    const res = await fetch(`${API_BASE_URL}/api/locations/autocomplete/?q=${encodeURIComponent(cleanQ)}&limit=${limit}`);
    if (!res.ok) {
      return !cleanQ ? DEFAULT_HUBS.slice(0, limit) : [];
    }
    const data = await res.json();
    const suggestions = data.suggestions || [];
    return suggestions.length > 0 ? suggestions : (!cleanQ ? DEFAULT_HUBS.slice(0, limit) : []);
  } catch (err) {
    console.error('Failed to fetch location suggestions:', err);
    return !cleanQ ? DEFAULT_HUBS.slice(0, limit) : [];
  }
}

/**
 * Fetch paginated trip history with search, filters, and sorting.
 */
export async function fetchTripHistory({
  page = 1,
  pageSize = 10,
  search = '',
  status = '',
  risk = '',
  dateRange = '',
  from = '',
  to = '',
  sortBy = 'departure_time',
  sortDir = 'desc',
} = {}) {
  try {
    const params = new URLSearchParams();
    if (page) params.set('page', page);
    if (pageSize) params.set('page_size', pageSize);
    if (search) params.set('search', search);
    if (status && status !== 'all') params.set('status', status);
    if (risk && risk !== 'all') params.set('risk', risk);
    if (dateRange && dateRange !== 'all') params.set('date_range', dateRange);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (sortBy) params.set('sort_by', sortBy);
    if (sortDir) params.set('sort_dir', sortDir);

    const response = await fetch(`${API_BASE_URL}/api/trips/?${params.toString()}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || data.error || `HTTP ${response.status}`);
    }
    return { success: true, data, error: null };
  } catch (err) {
    return { success: false, data: null, error: err.message || 'Failed to fetch trip history' };
  }
}

/**
 * Fetch stored trip details without re-calculating routes or re-fetching forecasts.
 */
export async function fetchTripDetails(tripId) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/trips/${encodeURIComponent(tripId)}/`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || data.error || `HTTP ${response.status}`);
    }
    return { success: true, data, error: null };
  } catch (err) {
    return { success: false, data: null, error: err.message || 'Failed to fetch trip details' };
  }
}

/**
 * Re-plan a historical trip using its original inputs, creating a new trip record.
 */
export async function replanTrip(tripId) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/trips/${encodeURIComponent(tripId)}/replan/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || data.error || `HTTP ${response.status}`);
    }
    return { success: true, data, error: null };
  } catch (err) {
    return { success: false, data: null, error: err.message || 'Failed to replan trip' };
  }
}

/**
 * Delete a historical trip record.
 */
export async function deleteTrip(tripId) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/trips/${encodeURIComponent(tripId)}/`, {
      method: 'DELETE',
      headers: { 'Accept': 'application/json' },
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || data.error || `HTTP ${response.status}`);
    }
    return { success: true, data, error: null };
  } catch (err) {
    return { success: false, data: null, error: err.message || 'Failed to delete trip' };
  }
}

/**
 * Export trips to CSV, JSON, or trigger file download.
 */
export async function exportTrips({
  format = 'csv',
  tripIds = [],
  scope = {
    include_summary: true,
    include_routes: true,
    include_checkpoints: true,
    include_weather: false,
  },
} = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/trips/export/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        format,
        trip_ids: tripIds,
        scope,
      }),
    });

    if (!response.ok) {
      throw new Error(`Export failed with HTTP ${response.status}`);
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = format === 'csv' ? 'spotter_trips_export.csv' : 'spotter_trips_export.json';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    return { success: true, error: null };
  } catch (err) {
    return { success: false, error: err.message || 'Export failed' };
  }
}


