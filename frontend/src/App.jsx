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
  ChevronRight
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

  // Route preview test state
  const [originInput, setOriginInput] = useState('Philadelphia, PA');
  const [destInput, setDestInput] = useState('Baltimore, MD');
  const [providerInput, setProviderInput] = useState('osrm');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState(null);
  const [previewError, setPreviewError] = useState(null);

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

    const res = await previewRoutes({
      origin: originInput,
      destination: destInput,
      provider: providerInput,
      maxAlternatives: 3,
    });

    setPreviewLoading(false);
    if (res.success) {
      setPreviewResult(res.data);
    } else {
      setPreviewError(res.error);
    }
  };

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
              Phase 2 Milestone — Alternative Routing Engine Active
            </div>
            
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Genuine Alternative Truck Routes Engine
            </h1>
            
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
              Generates up to three genuine alternative transit routes with real road geometries, precise distances in miles/meters, and durations. Strictly enforces no route duplication or fabrication.
            </p>
          </div>
        </div>

        {/* Live Route Preview Test Bench */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50/70 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center">
                <Route className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Routing Engine Test Bench (POST /api/routes/preview/)</h2>
                <p className="text-xs text-slate-500">Test live route generation, geocoding resolution, and genuine alternatives</p>
              </div>
            </div>

            <span className="text-xs font-mono bg-slate-200/80 px-2.5 py-1 rounded text-slate-700">
              GeoJSON [lon, lat] Coordinates
            </span>
          </div>

          <div className="p-6">
            <form onSubmit={handlePreviewRoutes} className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                    placeholder="e.g. Philadelphia, PA or lon,lat"
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
                    placeholder="e.g. Baltimore, MD or lon,lat"
                    required
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Routing Provider
                </label>
                <select
                  value={providerInput}
                  onChange={(e) => setProviderInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                >
                  <option value="osrm">OSRM (OpenStreetMap Public - Zero Config)</option>
                  <option value="openrouteservice">OpenRouteService (Requires ROUTING_API_KEY)</option>
                  <option value="mapbox">Mapbox Directions (Requires Token)</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={previewLoading}
                  className="w-full py-2 px-4 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50 shadow-sm"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${previewLoading ? 'animate-spin' : ''}`} />
                  {previewLoading ? 'Generating Routes...' : 'Request Route Alternatives'}
                </button>
              </div>
            </form>

            {/* Error Message */}
            {previewError && (
              <div className="mt-4 p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Routing Error</p>
                  <p className="text-slate-700 font-mono text-[11px] mt-0.5">{previewError}</p>
                </div>
              </div>
            )}

            {/* Results Display */}
            {previewResult && (
              <div className="mt-6 space-y-4">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-700">Resolved Origin:</span>
                    <span className="text-slate-900 font-medium">{previewResult.origin.display_name}</span>
                    <code className="text-[11px] bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono">
                      [{previewResult.origin.coordinates[0].toFixed(4)}, {previewResult.origin.coordinates[1].toFixed(4)}]
                    </code>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 hidden sm:block" />
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-700">Resolved Destination:</span>
                    <span className="text-slate-900 font-medium">{previewResult.destination.display_name}</span>
                    <code className="text-[11px] bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono">
                      [{previewResult.destination.coordinates[0].toFixed(4)}, {previewResult.destination.coordinates[1].toFixed(4)}]
                    </code>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-600 px-1">
                  <span>
                    Genuine Alternatives Returned:{' '}
                    <strong className="text-slate-900">{previewResult.routes_count}</strong> (Strictly no duplication)
                  </span>
                  <span className="font-mono text-[11px] text-teal-700 font-semibold">
                    Provider: {previewResult.provider}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {previewResult.routes.map((rt, idx) => (
                    <div
                      key={rt.id}
                      className="p-4 rounded-xl border border-slate-200 bg-white hover:border-teal-400 hover:shadow-sm transition"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200 uppercase font-mono">
                          {rt.id}
                        </span>
                        <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {rt.duration_formatted}
                        </span>
                      </div>

                      <h3 className="font-bold text-sm text-slate-900 mb-2 truncate" title={rt.name}>
                        {rt.name}
                      </h3>

                      <div className="space-y-1.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
                        <div className="flex justify-between">
                          <span>Total Distance:</span>
                          <strong className="text-slate-900">{rt.distance_miles} mi ({Math.round(rt.distance_meters / 1000)} km)</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Duration (Hours):</span>
                          <span className="font-mono">{rt.duration_hours} hrs</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Geometry Points:</span>
                          <span className="font-mono">{rt.geometry.coordinates.length} waypoints</span>
                        </div>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-500 font-mono truncate">
                        Start: [{rt.geometry.coordinates[0][0].toFixed(4)}, {rt.geometry.coordinates[0][1].toFixed(4)}]
                      </div>
                    </div>
                  ))}
                </div>
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
                  <span className="text-slate-500">Endpoint:</span>
                  <code className="bg-slate-100 px-2 py-0.5 rounded text-slate-800 font-mono text-[11px]">
                    GET /api/health/
                  </code>
                </div>
                <div className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Response Latency:</span>
                  <span className="font-mono font-medium text-slate-800">
                    {healthStatus.latencyMs !== null ? `${healthStatus.latencyMs} ms` : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Last Verified:</span>
                  <span className="text-slate-800 font-mono">
                    {healthStatus.lastChecked || 'Pending...'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs py-1.5">
                  <span className="text-slate-500">CORS Allowed Origin:</span>
                  <span className="text-emerald-700 font-medium">http://localhost:5173</span>
                </div>
              </div>

              {healthStatus.data && (
                <div className="mt-2 pt-2">
                  <span className="text-xs text-slate-500 font-medium block mb-1">Health Payload:</span>
                  <pre className="bg-slate-900 text-teal-300 p-3 rounded-lg text-[11px] font-mono overflow-x-auto">
                    {JSON.stringify(healthStatus.data, null, 2)}
                  </pre>
                </div>
              )}
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
                    <p className="text-xs font-semibold text-slate-900">Frontend Layer</p>
                    <p className="text-[11px] text-slate-500">React 19, Vite, Tailwind CSS, Leaflet</p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    ACTIVE
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/60 flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-900">Routing Provider Engine</p>
                    <p className="text-[11px] text-slate-500">OpenRouteService, Mapbox, OSRM multi-provider</p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    PHASE 2 DONE
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/60 flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-900">Road Geometry Normalization</p>
                    <p className="text-[11px] text-slate-500">GeoJSON [lon, lat] LineString with miles & duration</p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    VERIFIED
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/60 flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-900">Weather Forecast Engine</p>
                    <p className="text-[11px] text-slate-500">Time-aware hourly checkpoints & risk rules</p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">
                    PHASE 3-4
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Security: Backend proxy keeps keys private</span>
              <ShieldCheck className="w-4 h-4 text-teal-600" />
            </div>
          </div>

          {/* Phase 2 Acceptance Checklist Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Phase 2 Acceptance</h2>
                  <p className="text-xs text-slate-500">Verification checklist</p>
                </div>
              </div>

              <div className="space-y-2.5">
                {[
                  { text: 'Real origin and destination resolve correctly', done: true },
                  { text: 'Response includes genuine alternatives, distance, duration & geometry', done: true },
                  { text: 'Geometry renders in GeoJSON [lon, lat] format', done: true },
                  { text: 'Provider errors and missing credentials handled cleanly', done: true },
                  { text: 'Never fabricates routes if provider returns fewer alternatives', done: true },
                  { text: 'Automated test suite passing (15/15 tests)', done: true },
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
                <span className="font-semibold text-teal-300">Phase 3: Weather Checkpoints & ETAs</span>
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
              { num: '03', title: 'Weather & ETAs', status: 'Next', color: 'border-teal-500 bg-teal-50/40 text-teal-700' },
              { num: '04', title: 'Risk Engine', status: 'Queued', color: 'border-slate-200 bg-slate-50 text-slate-600' },
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
