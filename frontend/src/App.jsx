import React, { useState, useEffect, useCallback } from 'react';
import { checkBackendHealth, planTrip } from './services/api';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import PlanTripPage from './components/PlanTripPage';
import RouteComparisonPage from './components/RouteComparisonPage';
import RouteDetailsPage from './components/RouteDetailsPage';
import WeatherExplorerPage from './components/WeatherExplorerPage';
import TripHistoryPage from './components/TripHistoryPage';


const COMMON_TIMEZONES = [
  { value: 'America/Chicago', label: 'America/Chicago (CDT)', offset: '-05:00' },
  { value: 'America/New_York', label: 'America/New_York (EDT)', offset: '-04:00' },
  { value: 'America/Denver', label: 'America/Denver (MDT)', offset: '-06:00' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PDT)', offset: '-07:00' },
  { value: 'UTC', label: 'UTC (+00:00)', offset: '+00:00' },
];

export default function App() {
  // Navigation active view: 'plan' | 'comparison' | 'details' | 'weather' | 'history' | 'settings'
  const [activeView, setActiveView] = useState('plan');

  // Trip form inputs (Initial state: user can type or use default Chicago -> New York)
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  
  // Date & Time inputs
  const [departureDate, setDepartureDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [departureTime, setDepartureTime] = useState('08:00');
  const [timezone, setTimezone] = useState('America/Chicago');

  const [loadWeightLb, setLoadWeightLb] = useState('');
  const [samplingIntervalMiles, setSamplingIntervalMiles] = useState(25);
  const [provider, setProvider] = useState('osrm');

  // Timeline offset for Route Comparison slider (0 to 48 hours)
  const [timelineOffsetHours, setTimelineOffsetHours] = useState(0);

  // Planning state
  const [planLoading, setPlanLoading] = useState(false);
  const [planResult, setPlanResult] = useState(null);
  const [planError, setPlanError] = useState(null);
  const [selectedRouteId, setSelectedRouteId] = useState(null);

  // Health check state
  const [healthStatus, setHealthStatus] = useState({
    loading: true,
    connected: false,
    data: null,
    latencyMs: null,
    error: null,
  });

  useEffect(() => {
    async function initHealth() {
      const res = await checkBackendHealth();
      setHealthStatus({
        loading: false,
        connected: res.success,
        data: res.data,
        latencyMs: res.latencyMs,
        error: res.error,
      });
    }
    initHealth();
  }, []);

  // Format full ISO 8601 departure with explicit timezone offset
  const getFullDepartureIso = useCallback(() => {
    const tzObj = COMMON_TIMEZONES.find((t) => t.value === timezone);
    const offset = tzObj ? tzObj.offset : '-05:00';
    return `${departureDate}T${departureTime}:00${offset}`;
  }, [departureDate, departureTime, timezone]);

  // Execute end-to-end trip planning
  const executePlan = useCallback(async () => {
    setPlanLoading(true);
    setPlanError(null);

    const departureIso = getFullDepartureIso();

    const result = await planTrip({
      origin,
      destination,
      departureTime: departureIso,
      loadWeightLb: Number(loadWeightLb),
      samplingIntervalMiles,
      provider,
      maxAlternatives: 3,
    });

    setPlanLoading(false);

    if (result.success) {
      setPlanResult(result.data);
      const routes = result.data.routes || [];
      const recommended = routes.find((r) => r.is_recommended);
      setSelectedRouteId(recommended ? recommended.id : routes[0]?.id || null);
      setActiveView('comparison');
    } else {
      setPlanError(result.error || 'Failed to generate routes');
    }
  }, [
    origin,
    destination,
    getFullDepartureIso,
    loadWeightLb,
    samplingIntervalMiles,
    provider,
  ]);

  const viewTitles = {
    plan: 'Plan Trip',
    comparison: 'Route Comparison',
    details: 'Route Details',
    weather: 'Weather Explorer',
    history: 'Trip History',
    settings: 'Settings',
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F8FAFC] font-sans antialiased text-slate-900">
      {/* Dark Navy Sidebar */}
      <Sidebar
        activeView={activeView}
        setActiveView={setActiveView}
        hasPlanResult={Boolean(planResult)}
      />

      {/* Main App Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Header */}
        <Header
          activeViewTitle={viewTitles[activeView] || 'Plan Trip'}
          activeView={activeView}
          healthStatus={healthStatus}
        />


        {/* View Router */}
        <main className="flex-1 min-h-0 overflow-y-auto">
          {activeView === 'plan' && (
            <PlanTripPage
              origin={origin}
              setOrigin={setOrigin}
              destination={destination}
              setDestination={setDestination}
              departureDate={departureDate}
              setDepartureDate={setDepartureDate}
              departureTime={departureTime}
              setDepartureTime={setDepartureTime}
              timezone={timezone}
              setTimezone={setTimezone}
              loadWeightLb={loadWeightLb}
              setLoadWeightLb={setLoadWeightLb}
              samplingIntervalMiles={samplingIntervalMiles}
              setSamplingIntervalMiles={setSamplingIntervalMiles}
              onSubmit={executePlan}
              loading={planLoading}
              apiError={planError}
              planResult={planResult}
              onViewComparison={() => setActiveView('comparison')}
              onRetry={executePlan}
            />
          )}

          {activeView === 'comparison' && (
            <RouteComparisonPage
              planResult={planResult}
              selectedRouteId={selectedRouteId}
              setSelectedRouteId={setSelectedRouteId}
              timelineOffsetHours={timelineOffsetHours}
              setTimelineOffsetHours={setTimelineOffsetHours}
              departureTime={getFullDepartureIso()}
              onEditTrip={() => setActiveView('plan')}
              onRefresh={executePlan}
              onNavigateToDetails={(routeId) => {
                if (routeId) setSelectedRouteId(routeId);
                setActiveView('details');
              }}
              onNavigateToWeather={(routeId) => {
                if (routeId) setSelectedRouteId(routeId);
                setActiveView('weather');
              }}
              loading={planLoading}
              apiError={planError}
            />
          )}

          {activeView === 'details' && (
            <RouteDetailsPage
              planResult={planResult}
              selectedRouteId={selectedRouteId}
              onBackToComparison={() => setActiveView('comparison')}
              onNewTrip={() => setActiveView('plan')}
              onNavigateToWeather={(routeId) => {
                if (routeId) setSelectedRouteId(routeId);
                setActiveView('weather');
              }}
            />
          )}

          {activeView === 'weather' && (
            <WeatherExplorerPage
              planResult={planResult}
              selectedRouteId={selectedRouteId}
              setSelectedRouteId={setSelectedRouteId}
              departureTime={getFullDepartureIso()}
              onBackToComparison={() => setActiveView('comparison')}
              onNewTrip={() => setActiveView('plan')}
              onRefresh={executePlan}
              loading={planLoading}
              apiError={planError}
            />
          )}

          {activeView === 'history' && (
            <TripHistoryPage
              onNewTrip={() => setActiveView('plan')}
              onNavigateToPlan={() => setActiveView('plan')}
            />
          )}

          {activeView === 'settings' && (
            <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
              <h3 className="text-lg font-bold text-slate-800 border-b border-slate-200 pb-3">
                Routing & Weather Configuration
              </h3>
              <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Routing Engine
                  </label>
                  <select
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                    className="w-full max-w-sm px-3 py-2 rounded-lg border border-slate-300 font-medium"
                  >
                    <option value="osrm">Open Source Routing Machine (OSRM - OpenStreetMap)</option>
                    <option value="openrouteservice">OpenRouteService (Requires API Key)</option>
                    <option value="mapbox">Mapbox Navigation (Requires Access Token)</option>
                  </select>
                </div>
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-slate-500">Backend API Status</span>
                  <span
                    className={`font-semibold ${
                      healthStatus.connected ? 'text-emerald-600' : 'text-red-600'
                    }`}
                  >
                    {healthStatus.connected ? 'Healthy & Connected' : 'Offline'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
