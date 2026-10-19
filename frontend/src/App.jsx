import React, { useState, useEffect, useCallback } from 'react';
import { checkBackendHealth, planTrip } from './services/api';
import TripForm from './components/TripForm';
import ForecastSlider from './components/ForecastSlider';
import RecommendationBanner from './components/RecommendationBanner';
import RouteComparisonCard from './components/RouteComparisonCard';
import RouteMap from './components/RouteMap';
import CheckpointTable from './components/CheckpointTable';
import RiskLegend from './components/RiskLegend';
import {
  Compass,
  RefreshCw,
  AlertTriangle,
  RotateCcw,
  Layers,
  MapPin,
  ChevronRight,
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

  // Trip inputs state
  const [origin, setOrigin] = useState('Philadelphia, PA');
  const [destination, setDestination] = useState('Baltimore, MD');
  const [departureTime, setDepartureTime] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });
  const [loadWeightLb, setLoadWeightLb] = useState(42000);
  const [samplingIntervalMiles, setSamplingIntervalMiles] = useState(25);
  const [provider, setProvider] = useState('osrm');

  // Forecast slider offset (0 to 48 hours)
  const [timelineOffsetHours, setTimelineOffsetHours] = useState(0);

  // Planning state
  const [planLoading, setPlanLoading] = useState(false);
  const [planResult, setPlanResult] = useState(null);
  const [planError, setPlanError] = useState(null);
  const [selectedRouteId, setSelectedRouteId] = useState(null);

  // Health check
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

  // Execute end-to-end trip planning
  const executePlan = useCallback(async (customOffsetHours = timelineOffsetHours) => {
    setPlanLoading(true);
    setPlanError(null);

    try {
      // Calculate effective departure time with timeline offset
      const baseDate = new Date(departureTime);
      const effectiveDate = new Date(baseDate.getTime() + customOffsetHours * 3600 * 1000);
      const isoDepartureWithTimezone = effectiveDate.toISOString();

      const res = await planTrip({
        origin,
        destination,
        departureTime: isoDepartureWithTimezone,
        loadWeightLb,
        samplingIntervalMiles,
        provider,
        maxAlternatives: 3,
      });

      setPlanLoading(false);
      if (res.success) {
        setPlanResult(res.data);
        const recId = res.data?.recommendation?.recommended_route_id;
        if (recId) {
          setSelectedRouteId(recId);
        } else if (res.data.routes && res.data.routes.length > 0) {
          setSelectedRouteId(res.data.routes[0].id);
        }
      } else {
        setPlanError(res.error);
      }
    } catch (err) {
      setPlanLoading(false);
      setPlanError(err.message || 'An unexpected error occurred while planning the trip.');
    }
  }, [origin, destination, departureTime, loadWeightLb, samplingIntervalMiles, provider, timelineOffsetHours]);

  // Auto-run once on mount for seamless initial demo view
  useEffect(() => {
    executePlan(0);
  }, []);

  const handleFormSubmit = (e) => {
    if (e) e.preventDefault();
    executePlan(timelineOffsetHours);
  };

  const handleTimelineChange = (newOffset) => {
    setTimelineOffsetHours(newOffset);
  };

  const handleApplyTimeline = () => {
    executePlan(timelineOffsetHours);
  };

  const selectedRoute = planResult?.routes?.find(r => r.id === selectedRouteId) || planResult?.routes?.[0];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col font-sans">
      {/* Top Professional Fleet Header */}
      <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-400">
              <Compass className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight text-white flex items-center gap-2">
                SPOTTER <span className="text-teal-400 text-xs px-2 py-0.5 rounded bg-teal-950 border border-teal-700/50 uppercase tracking-widest font-mono">Fleet Routing</span>
              </span>
              <p className="text-xs text-slate-400 hidden sm:block">Weather-Aware Multi-Route Safety & Logistics Optimization</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/90 border border-slate-700 text-xs">
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
                  ? 'API Connected (Phase 7 Dashboard)'
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
            >
              <RefreshCw className={`w-4 h-4 ${healthStatus.loading ? 'animate-spin text-teal-400' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Dashboard Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Real Geocoding & Trip Status Bar */}
        {planResult?.trip && (
          <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-600">Origin:</span>
              <span className="font-medium text-slate-900">{planResult.trip.origin.display_name}</span>
              <code className="text-[10.5px] bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 font-mono text-slate-600">
                [{planResult.trip.origin.coordinates[0].toFixed(4)}, {planResult.trip.origin.coordinates[1].toFixed(4)}]
              </code>
            </div>

            <ChevronRight className="w-4 h-4 text-slate-300 hidden sm:block" />

            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-600">Destination:</span>
              <span className="font-medium text-slate-900">{planResult.trip.destination.display_name}</span>
              <code className="text-[10.5px] bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 font-mono text-slate-600">
                [{planResult.trip.destination.coordinates[0].toFixed(4)}, {planResult.trip.destination.coordinates[1].toFixed(4)}]
              </code>
            </div>

            <div className="flex items-center gap-3">
              <span className="bg-slate-50 px-2.5 py-1 rounded border border-slate-200 font-medium text-slate-700">
                Cargo: <strong>{(planResult.trip.load_weight_lb || loadWeightLb).toLocaleString()} lb</strong>
              </span>
              <span className="bg-teal-50 text-teal-800 px-2.5 py-1 rounded border border-teal-200 font-semibold font-mono">
                {planResult.routes_count} Genuine Routes
              </span>
            </div>
          </div>
        )}

        {/* Corridor Pipeline Warnings Notification */}
        {planResult?.warnings && planResult.warnings.length > 0 && (
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1 shadow-xs">
            <div className="flex items-center gap-1.5 font-bold text-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Corridor Dispatch Notices:</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-800/90 pl-1">
              {planResult.warnings.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Global Error Banner */}
        {planError && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-3 shadow-xs">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold text-sm">Trip Planning Error</p>
              <p className="text-slate-700 font-mono text-xs mt-1">{planError}</p>
              <button
                type="button"
                onClick={() => executePlan(timelineOffsetHours)}
                className="mt-2.5 px-3 py-1.5 rounded-md bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition inline-flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Retry Route Evaluation
              </button>
            </div>
          </div>
        )}

        {/* Two-Column Logistics Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Trip Controls, Timeline Slider & Comparison Cards (5 cols) */}
          <div className="lg:col-span-5 space-y-5">
            {/* 1. Trip Configuration Form */}
            <TripForm
              origin={origin}
              setOrigin={setOrigin}
              destination={destination}
              setDestination={setDestination}
              departureTime={departureTime}
              setDepartureTime={setDepartureTime}
              loadWeightLb={loadWeightLb}
              setLoadWeightLb={setLoadWeightLb}
              samplingIntervalMiles={samplingIntervalMiles}
              setSamplingIntervalMiles={setSamplingIntervalMiles}
              provider={provider}
              setProvider={setProvider}
              onSubmit={handleFormSubmit}
              loading={planLoading}
            />

            {/* 2. 0–48-Hour Forecast Timeline Slider */}
            <ForecastSlider
              offsetHours={timelineOffsetHours}
              onChangeOffset={handleTimelineChange}
              baseDepartureTime={departureTime}
              onApplyOffset={handleApplyTimeline}
              loading={planLoading}
            />

            {/* 3. Official Recommendation Banner */}
            {planResult?.recommendation && (
              <RecommendationBanner
                recommendation={planResult.recommendation}
                routes={planResult.routes}
              />
            )}

            {/* 4. Candidate Route Alternatives List */}
            {planResult?.routes && planResult.routes.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-slate-500" />
                    Alternative Route Profiles ({planResult.routes.length})
                  </h3>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Lexicographical Sort
                  </span>
                </div>

                <div className="space-y-3">
                  {planResult.routes.map((rt) => (
                    <RouteComparisonCard
                      key={rt.id}
                      route={rt}
                      isSelected={rt.id === selectedRouteId}
                      onSelect={() => setSelectedRouteId(rt.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 5. Risk Legend & Load Boundary Rules */}
            <RiskLegend compact={false} />
          </div>

          {/* Right Column: Interactive Map & Checkpoint Details (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            {/* 1. Interactive Route Map Panel */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-teal-600" />
                  Corridor Geometry & Checkpoint Risk Map
                </h3>
                {selectedRoute && (
                  <span className="text-[11px] font-mono text-slate-500">
                    Active: <strong className="text-slate-800">{selectedRoute.name}</strong>
                  </span>
                )}
              </div>

              <RouteMap
                routes={planResult?.routes || []}
                selectedRouteId={selectedRouteId}
                onSelectRoute={setSelectedRouteId}
                timelineOffsetHours={timelineOffsetHours}
                samplingIntervalMiles={samplingIntervalMiles}
              />
            </div>

            {/* 2. Checkpoint Details Table */}
            {selectedRoute && (
              <CheckpointTable
                route={selectedRoute}
                samplingIntervalMiles={samplingIntervalMiles}
                timelineOffsetHours={timelineOffsetHours}
              />
            )}
          </div>
        </div>
      </main>

      {/* Logistics Dashboard Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 mt-8 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Spotter Fleet Logistics & Weather-Aware Routing Assessment</span>
          <div className="flex items-center gap-3 font-mono text-[11px]">
            <span>Django REST Framework</span>
            <span>&bull;</span>
            <span>Leaflet / OpenStreetMap</span>
            <span>&bull;</span>
            <span>Open-Meteo Hourly API</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
