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
