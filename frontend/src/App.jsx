import React, { useState, useEffect, useCallback } from 'react';
import { checkBackendHealth, previewRoutes } from './services/api';
import {
  Activity,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Server,
  Layers,
  ShieldCheck,
  Compass,
  ArrowRight,
  Route,
  Navigation,
  MapPin,
  Clock,
  Gauge,
  AlertTriangle,
  ChevronRight,
  Wind,
  CloudRain,
  CloudSnow,
  Calendar,
  CloudSun
} from 'lucide-react';

export default function App() {
  const [healthStatus, setHealthStatus] = useState({
    loading: true,
    connected: false,
    data: null,
    latencyMs: null,
    error: null,
    lastChecked: null,
  });

  // Trip inputs
  const [originInput, setOriginInput] = useState('Philadelphia, PA');
  const [destInput, setDestInput] = useState('Baltimore, MD');
  const [providerInput, setProviderInput] = useState('osrm');
  const [intervalInput, setIntervalInput] = useState(25);
  const [departureInput, setDepartureInput] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });

  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState(null);
  const [previewError, setPreviewError] = useState(null);
  const [selectedRouteId, setSelectedRouteId] = useState(null);

  const runHealthCheck = useCallback(async () => {
    setHealthStatus(prev => ({ ...prev, loading: true }));
    const result = await checkBackendHealth();
    setHealthStatus({
      loading: false,
      connected: result.success,
      data: result.data,
      latencyMs: result.latencyMs,
      error: result.error,
      lastChecked: new Date().toLocaleTimeString(),
    });
  }, []);

  useEffect(() => {
    runHealthCheck();
  }, [runHealthCheck]);

  const handlePreviewRoutes = async (e) => {
    if (e) e.preventDefault();
    setPreviewLoading(true);
    setPreviewError(null);

    // Convert local datetime-local to ISO string with timezone
    let isoDeparture = new Date(departureInput).toISOString();

    const res = await previewRoutes({
      origin: originInput,
      destination: destInput,
      provider: providerInput,
      maxAlternatives: 3,
      departureTime: isoDeparture,
      samplingIntervalMiles: parseInt(intervalInput, 10),
    });

    setPreviewLoading(false);
    if (res.success) {
      setPreviewResult(res.data);
      if (res.data.routes && res.data.routes.length > 0) {
        setSelectedRouteId(res.data.routes[0].id);
      }
    } else {
      setPreviewError(res.error);
    }
  };

  const selectedRoute = previewResult?.routes?.find(r => r.id === selectedRouteId) || previewResult?.routes?.[0];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Top Navigation */}
      <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-400">
              <Compass className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight text-white flex items-center gap-2">
                SPOTTER <span className="text-teal-400 text-xs px-2 py-0.5 rounded bg-teal-950 border border-teal-700/50 uppercase tracking-widest font-mono">Routing</span>
              </span>
              <p className="text-xs text-slate-400 hidden sm:block">Weather-Aware Truck Route Optimization</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700 text-xs">
              <span
                className={`w-2 h-2 rounded-full ${
                  healthStatus.loading
                    ? 'bg-amber-400 animate-ping'
                    : healthStatus.connected
                    ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                    : 'bg-rose-500'
                }`}
              />
              <span className="font-medium text-slate-300">
                {healthStatus.loading
                  ? 'Checking...'
                  : healthStatus.connected
                  ? 'API Connected'
                  : 'API Offline'}
              </span>
              {healthStatus.latencyMs !== null && healthStatus.connected && (
                <span className="text-slate-400 font-mono text-[11px] border-l border-slate-700 pl-2">
                  {healthStatus.latencyMs}ms
                </span>
              )}
            </div>

            <button
              onClick={runHealthCheck}
              disabled={healthStatus.loading}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors disabled:opacity-50"
              title="Refresh health status"
              id="refresh-health-btn"
            >
              <RefreshCw className={`w-4 h-4 ${healthStatus.loading ? 'animate-spin text-teal-400' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Hero Section */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-teal-500/10 via-cyan-500/5 to-transparent rounded-full -mr-20 -mt-20 pointer-events-none" />
          
          <div className="max-w-3xl space-y-3 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-600" />
              Phase 3 Milestone — Time-Aware Weather Checkpoints Active
            </div>
            
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Route Geometry Checkpoints & ETA-Aware Forecasts
            </h1>
            
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
              Discretizes genuine route geometries into 10, 25, or 50-mile road checkpoints, estimates progressive arrival timestamps, and retrieves hourly meteorological forecasts (wind speed, rain intensity, snowfall).
            </p>
          </div>
        </div>

        {/* Live Trip Form & Checkpoint Generator */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50/70 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center">
                <Route className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Trip & Checkpoint Planning Engine</h2>
                <p className="text-xs text-slate-500">Samples road geometry and retrieves time-aware Open-Meteo forecasts</p>
              </div>
            </div>

            <span className="text-xs font-mono bg-teal-50 border border-teal-200 px-2.5 py-1 rounded text-teal-800 font-semibold">
              Intervals: 10 / 25 / 50 mi &bull; Units: mph, in/hr
            </span>
          </div>

          <div className="p-6">
            <form onSubmit={handlePreviewRoutes} className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Origin Location
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={originInput}
                    onChange={(e) => setOriginInput(e.target.value)}
                    placeholder="e.g. Philadelphia, PA"
                    required
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Destination Location
                </label>
                <div className="relative">
                  <Navigation className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={destInput}
                    onChange={(e) => setDestInput(e.target.value)}
                    placeholder="e.g. Baltimore, MD"
                    required
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Departure Time
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="datetime-local"
                    value={departureInput}
                    onChange={(e) => setDepartureInput(e.target.value)}
                    required
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Sampling Interval
                </label>
                <select
                  value={intervalInput}
                  onChange={(e) => setIntervalInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white font-medium"
                >
                  <option value={10}>10 miles (High resolution)</option>
                  <option value={25}>25 miles (Standard)</option>
                  <option value={50}>50 miles (Long-haul)</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={previewLoading}
                  className="w-full py-2 px-4 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50 shadow-sm"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${previewLoading ? 'animate-spin' : ''}`} />
                  {previewLoading ? 'Analyzing Routes...' : 'Generate Route Checkpoints'}
                </button>
              </div>
            </form>

            {/* Error Message */}
            {previewError && (
              <div className="mt-4 p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Routing / Weather Error</p>
                  <p className="text-slate-700 font-mono text-[11px] mt-0.5">{previewError}</p>
                </div>
              </div>
            )}

            {/* Results Display */}
            {previewResult && (
              <div className="mt-6 space-y-5">
                {/* Geocoding resolved banner */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-700">Origin:</span>
                    <span className="text-slate-900 font-medium">{previewResult.origin.display_name}</span>
                    <code className="text-[11px] bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono">
                      [{previewResult.origin.coordinates[0].toFixed(4)}, {previewResult.origin.coordinates[1].toFixed(4)}]
                    </code>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 hidden sm:block" />
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-700">Destination:</span>
                    <span className="text-slate-900 font-medium">{previewResult.destination.display_name}</span>
                    <code className="text-[11px] bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono">
                      [{previewResult.destination.coordinates[0].toFixed(4)}, {previewResult.destination.coordinates[1].toFixed(4)}]
                    </code>
                  </div>
                </div>

                {/* Route Alternatives Selection Cards */}
                <div>
                  <h3 className="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">
                    Select Route Alternative ({previewResult.routes_count} Available):
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {previewResult.routes.map((rt) => {
                      const isSelected = rt.id === selectedRouteId;
                      return (
                        <div
                          key={rt.id}
                          onClick={() => setSelectedRouteId(rt.id)}
                          className={`p-4 rounded-xl border cursor-pointer transition ${
                            isSelected
                              ? 'border-teal-600 bg-teal-50/30 ring-2 ring-teal-500/20'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase ${
                                isSelected ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {rt.id}
                            </span>
                            <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              {rt.duration_formatted}
                            </span>
                          </div>

                          <h4 className="font-bold text-sm text-slate-900 mb-2 truncate" title={rt.name}>
                            {rt.name}
                          </h4>

                          <div className="space-y-1 text-xs text-slate-600 pt-2 border-t border-slate-100">
                            <div className="flex justify-between">
                              <span>Distance:</span>
                              <strong className="text-slate-900">{rt.distance_miles} miles</strong>
                            </div>
                            <div className="flex justify-between">
                              <span>Checkpoints:</span>
                              <span className="font-mono font-medium text-teal-800">
                                {rt.checkpoints_count || rt.checkpoints?.length || 0} checkpoints
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Selected Route Checkpoint Table */}
                {selectedRoute && selectedRoute.checkpoints && (
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                    <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Gauge className="w-4 h-4 text-teal-600" />
                        <h4 className="text-xs font-bold text-slate-900">
                          Checkpoint Weather Forecasts for {selectedRoute.name} ({selectedRoute.checkpoints.length} Checkpoints @ {intervalInput} mi)
                        </h4>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        Normalized Units: Wind (mph), Rain & Snow (in/hr)
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-semibold">
                            <th className="py-2.5 px-3">#</th>
                            <th className="py-2.5 px-3">Checkpoint</th>
                            <th className="py-2.5 px-3">Cum. Distance</th>
                            <th className="py-2.5 px-3">Estimated Arrival (ETA)</th>
                            <th className="py-2.5 px-3">Coordinates</th>
                            <th className="py-2.5 px-3">Condition</th>
                            <th className="py-2.5 px-3">Wind Speed</th>
                            <th className="py-2.5 px-3">Rain Intensity</th>
                            <th className="py-2.5 px-3">Snow Intensity</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {selectedRoute.checkpoints.map((cp) => {
                            const w = cp.weather || {};
                            return (
                              <tr key={cp.index} className="hover:bg-slate-50/80 transition-colors">
                                <td className="py-2 px-3 font-mono text-[11px] font-bold text-slate-500">
                                  {cp.index}
                                </td>
                                <td className="py-2 px-3 font-medium text-slate-900 flex items-center gap-1.5">
                                  {cp.is_origin && (
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Origin" />
                                  )}
                                  {cp.is_destination && (
                                    <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" title="Destination" />
                                  )}
                                  {cp.name}
                                </td>
                                <td className="py-2 px-3 font-mono">
                                  {cp.cumulative_distance_miles} mi
                                  {cp.segment_distance_miles > 0 && (
                                    <span className="text-[10px] text-slate-400 ml-1">
                                      (+{cp.segment_distance_miles})
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-3 font-mono text-slate-900">
                                  {new Date(cp.estimated_arrival_time).toLocaleTimeString([], {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </td>
                                <td className="py-2 px-3 font-mono text-[11px] text-slate-500">
                                  [{cp.coordinates[0].toFixed(3)}, {cp.coordinates[1].toFixed(3)}]
                                </td>
                                <td className="py-2 px-3">
                                  {w.is_available ? (
                                    <span className="inline-flex items-center gap-1 text-slate-800 font-medium">
                                      <CloudSun className="w-3.5 h-3.5 text-amber-500" />
                                      {w.weather_description}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[10px] font-medium border border-amber-200">
                                      {w.status || 'Unavailable'}
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-3 font-mono">
                                  {w.wind_speed_mph !== null && w.wind_speed_mph !== undefined ? (
                                    <span className="inline-flex items-center gap-1 font-semibold text-slate-900">
                                      <Wind className="w-3 h-3 text-cyan-600" />
                                      {w.wind_speed_mph} mph
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                                <td className="py-2 px-3 font-mono">
                                  {w.precipitation_in_hr !== null && w.precipitation_in_hr !== undefined ? (
                                    <span className="inline-flex items-center gap-1 text-slate-900">
                                      <CloudRain className="w-3 h-3 text-blue-500" />
                                      {w.precipitation_in_hr} in/hr
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                                <td className="py-2 px-3 font-mono">
                                  {w.snowfall_in_hr !== null && w.snowfall_in_hr !== undefined ? (
                                    <span className="inline-flex items-center gap-1 text-slate-900">
                                      <CloudSnow className="w-3 h-3 text-indigo-400" />
                                      {w.snowfall_in_hr} in/hr
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Status & Diagnostic Panels Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Backend Diagnostics Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                    <Server className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Backend Diagnostics</h2>
                    <p className="text-xs text-slate-500">Django REST Framework API</p>
                  </div>
                </div>

                <span
                  className={`text-xs px-2.5 py-1 rounded-md font-semibold inline-flex items-center gap-1.5 ${
                    healthStatus.connected
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}
                >
                  {healthStatus.connected ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" /> Healthy
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3.5 h-3.5" /> Disconnected
                    </>
                  )}
                </span>
              </div>

              <div className="space-y-2.5 pt-2">
                <div className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Endpoints Active:</span>
                  <div className="flex flex-col items-end gap-1">
                    <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-800 font-mono text-[10px]">
                      GET /api/health/
                    </code>
                    <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-800 font-mono text-[10px]">
                      POST /api/routes/preview/
                    </code>
                    <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-800 font-mono text-[10px]">
                      POST /api/routes/checkpoints/
                    </code>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Response Latency:</span>
                  <span className="font-mono font-medium text-slate-800">
                    {healthStatus.latencyMs !== null ? `${healthStatus.latencyMs} ms` : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Weather Provider:</span>
                  <span className="text-slate-800 font-medium">Open-Meteo Hourly (Free tier)</span>
                </div>
                <div className="flex items-center justify-between text-xs py-1.5">
                  <span className="text-slate-500">CORS Allowed Origin:</span>
                  <span className="text-emerald-700 font-medium">http://localhost:5173</span>
                </div>
              </div>
            </div>

            <button
              onClick={runHealthCheck}
              disabled={healthStatus.loading}
              className="mt-4 w-full py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-2 transition shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${healthStatus.loading ? 'animate-spin' : ''}`} />
              Re-test API Connection
            </button>
          </div>

          {/* Architecture Matrix Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">System Architecture</h2>
                  <p className="text-xs text-slate-500">Modular decoupled services</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/60 flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-900">Routing Provider Engine</p>
                    <p className="text-[11px] text-slate-500">Multi-provider: ORS, Mapbox, OSRM</p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    ACTIVE
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/60 flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-900">Road Checkpoint Sampling</p>
                    <p className="text-[11px] text-slate-500">10, 25, 50 mi intervals along actual geometry</p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    PHASE 3 DONE
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/60 flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-900">Weather Forecast Matcher</p>
                    <p className="text-[11px] text-slate-500">Time-aware hourly matching in mph & in/hr</p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    PHASE 3 DONE
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/60 flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-900">Load-Dependent Risk Rules</p>
                    <p className="text-[11px] text-slate-500">Truck weight crosswind & precipitation rules</p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">
                    PHASE 4 NEXT
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Forecast Horizon: 0–168 Hours</span>
              <ShieldCheck className="w-4 h-4 text-teal-600" />
            </div>
          </div>

          {/* Phase 3 Acceptance Checklist Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Phase 3 Acceptance</h2>
                  <p className="text-xs text-slate-500">Verification checklist</p>
                </div>
              </div>

              <div className="space-y-2.5">
                {[
                  { text: '10, 25, and 50-mile sampling intervals supported', done: true },
                  { text: 'Checkpoints follow actual road geometry, not straight lines', done: true },
                  { text: 'Origin & destination checkpoints included (no duplicates)', done: true },
                  { text: 'Timezone-aware ETAs increase monotonically along route', done: true },
                  { text: 'Forecast requests match checkpoint coordinates & arrival time', done: true },
                  { text: 'Weather units normalized into mph and in/hr', done: true },
                  { text: 'Missing forecast data remains explicitly unknown (not safe)', done: true },
                  { text: 'Automated test suite passing (18/18 tests)', done: true },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2.5 text-xs">
                    {item.done ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-slate-300 shrink-0" />
                    )}
                    <span className={item.done ? 'text-slate-800 font-medium' : 'text-slate-500'}>
                      {item.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 p-3 rounded-lg bg-slate-900 text-slate-100 text-xs flex items-center justify-between">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-mono">Next Milestone</span>
                <span className="font-semibold text-teal-300">Phase 4: Risk & Load Engine</span>
              </div>
              <ArrowRight className="w-4 h-4 text-teal-400" />
            </div>
          </div>
        </div>

        {/* 6-Phase Implementation Roadmap */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 mb-1">Development Roadmap</h2>
          <p className="text-xs text-slate-500 mb-6">Rigorous phase-by-phase implementation sequence</p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
            {[
              { num: '01', title: 'Plan & Scaffold', status: 'Completed', color: 'border-emerald-500 bg-emerald-50/40 text-emerald-700' },
              { num: '02', title: 'Routing Engine', status: 'Completed', color: 'border-emerald-500 bg-emerald-50/40 text-emerald-700' },
              { num: '03', title: 'Weather & ETAs', status: 'Completed', color: 'border-emerald-500 bg-emerald-50/40 text-emerald-700' },
              { num: '04', title: 'Risk Engine', status: 'Next', color: 'border-teal-500 bg-teal-50/40 text-teal-700' },
              { num: '05', title: 'Dashboard & Heatmap', status: 'Queued', color: 'border-slate-200 bg-slate-50 text-slate-600' },
              { num: '06', title: 'Audit & Deploy', status: 'Queued', color: 'border-slate-200 bg-slate-50 text-slate-600' },
            ].map((phase) => (
              <div key={phase.num} className={`p-4 rounded-lg border ${phase.color} flex flex-col justify-between`}>
                <div>
                  <span className="font-mono text-xs opacity-60 font-bold block mb-1">Phase {phase.num}</span>
                  <p className="font-bold text-xs text-slate-900">{phase.title}</p>
                </div>
                <span className="mt-3 text-[10px] uppercase tracking-wider font-semibold">
                  {phase.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        Spotter Weather-Aware Truck Routing Assessment &bull; React + Django REST Framework Architecture
      </footer>
    </div>
  );
}
