import React, { useState } from 'react';
import {
  ArrowLeft,
  RefreshCw,
  Edit2,
  ChevronRight,
  ShieldAlert,
  AlertTriangle,
  Clock,
  Weight,
  MapPin,
  Sliders,
  Calendar,
  AlertOctagon,
  CheckCircle2,
  Sparkles,
  Compass,
  CloudSun,
} from 'lucide-react';
import RouteComparisonCard from './RouteComparisonCard';
import RouteComparisonTable from './RouteComparisonTable';
import RouteRecommendationPanel from './RouteRecommendationPanel';
import RouteMap from './RouteMap';
import CheckpointDetailsModal from './CheckpointDetailsModal';
import ErrorBoundary from './ErrorBoundary';

/**
 * Formats ISO 8601 departure timestamp into friendly human date/time with timezone
 */
function formatDepartureTime(isoString) {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }) + ', ' + d.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  } catch {
    return isoString;
  }
}

export default function RouteComparisonPage({
  planResult,
  selectedRouteId,
  setSelectedRouteId,
  timelineOffsetHours = 0,
  setTimelineOffsetHours,
  departureTime,
  onEditTrip,
  onRefresh,
  onNavigateToDetails,
  onNavigateToWeather,
  loading = false,
  apiError = null,
}) {
  // Modal state for fallback "View Details ->" inspection modal
  const [detailsModalRoute, setDetailsModalRoute] = useState(null);

  // --------------------------------------------------------------------------
  // STATE 1: LOADING STATE (Analyzing Routes and Weather)
  // --------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-16 flex flex-col items-center justify-center text-center">
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-lg p-10 max-w-lg w-full space-y-6">
          <div className="relative flex items-center justify-center">
            <div className="w-16 h-16 rounded-full border-4 border-slate-100 border-t-teal-600 animate-spin" />
            <Compass className="w-7 h-7 text-teal-600 absolute animate-pulse" />
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-bold text-slate-900 tracking-tight">
              Generating Your Routes
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
              Analyzing route alternatives, sampling roadway checkpoints, and querying hourly forecasts against load safety thresholds...
            </p>
          </div>

          {/* 4-Step Animated Pipeline Status */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/60 space-y-3 text-left">
            <div className="flex items-center gap-3 text-xs">
              <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-700 font-bold flex items-center justify-center text-[10px]">
                1
              </span>
              <span className="text-slate-700 font-medium">Resolving geocodes & corridor road geometry</span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-700 font-bold flex items-center justify-center text-[10px]">
                2
              </span>
              <span className="text-slate-700 font-medium">Retrieving hourly Open-Meteo weather forecasts</span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-700 font-bold flex items-center justify-center text-[10px]">
                3
              </span>
              <span className="text-slate-700 font-medium">Evaluating load-dependent wind & precipitation rules</span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-700 font-bold flex items-center justify-center text-[10px]">
                4
              </span>
              <span className="text-slate-700 font-medium">Calculating strict 4-tier route recommendations</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-400">
            Please wait, this typically completes in 2–4 seconds.
          </p>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // STATE 2: API ERROR STATE
  // --------------------------------------------------------------------------
  if (apiError) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16">
        <div className="bg-white rounded-2xl border border-rose-200 shadow-md p-8 text-center space-y-5">
          <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
            <AlertOctagon className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-bold text-slate-900">
              Unable to Generate Routes
            </h3>
            <p className="text-xs text-rose-700 bg-rose-50/80 p-3 rounded-lg border border-rose-100 font-mono text-left break-words">
              {apiError}
            </p>
            <p className="text-xs text-slate-500">
              Route generation or required weather forecast retrieval encountered a provider error. Your trip parameters have been preserved.
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={onEditTrip}
              className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              Back to Plan Trip
            </button>
            <button
              type="button"
              onClick={onRefresh}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Analysis</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // EMPTY STATE FALLBACK (No planResult yet)
  // --------------------------------------------------------------------------
  if (!planResult || !planResult.routes || planResult.routes.length === 0) {
    return (
      <div className="max-w-md mx-auto px-6 py-16 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
          <MapPin className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-800">No Trip Plan Active</h3>
        <p className="text-xs text-slate-500">
          Enter an origin, destination, cargo weight, and departure time on the Plan Trip page to view real alternative routes.
        </p>
        <button
          type="button"
          onClick={onEditTrip}
          className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
        >
          Go to Plan Trip
        </button>
      </div>
    );
  }

  const routes = planResult.routes || [];
  const recommendation = planResult.recommendation || {};
  const trip = planResult.trip || {};

  // Resolve currently active/selected route for map and card focus
  const currentRoute =
    routes.find((r) => r.id === selectedRouteId) ||
    routes.find((r) => r.id === recommendation.recommended_route_id) ||
    routes[0];

  // Resolve recommended route metadata
  const winningRoute = routes.find((r) => r.id === recommendation.recommended_route_id);
  const winningRouteIndex = routes.findIndex((r) => r.id === recommendation.recommended_route_id);
  const winningLetter = winningRouteIndex >= 0 ? String.fromCharCode(65 + winningRouteIndex) : '';

  // Check if ALL routes are ineligible (No Travel)
  const isAllIneligible =
    recommendation.status === 'no_eligible_routes' ||
    routes.every((r) => r.metrics?.is_eligible === false || r.has_no_travel);

  // Trip metadata strings
  const originName = trip.origin?.display_name || trip.origin || 'Origin';
  const destName = trip.destination?.display_name || trip.destination || 'Destination';
  const departureFormatted = formatDepartureTime(trip.departure_time || departureTime);
  const loadWeightFormatted = trip.load_weight_lb
    ? `${Number(trip.load_weight_lb).toLocaleString()} lbs`
    : '35,000 lbs';
  const samplingFormatted = trip.sampling_interval_miles
    ? `${trip.sampling_interval_miles} miles`
    : '25 miles';

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-5 space-y-5">
      {/* --------------------------------------------------------------------- */}
      {/* 1. TOP BAR: Breadcrumbs & Actions */}
      {/* --------------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <button
            type="button"
            onClick={onEditTrip}
            className="hover:text-teal-600 transition-colors flex items-center gap-1 font-medium cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Plan Trip</span>
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-semibold text-slate-900">Route Comparison</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onEditTrip}
            className="px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-lg text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Edit2 className="w-3.5 h-3.5 text-slate-500" />
            <span>Modify Parameters</span>
          </button>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Analysis</span>
          </button>
          {onNavigateToWeather && (
            <button
              type="button"
              onClick={() => onNavigateToWeather(currentRoute?.id)}
              className="px-3 py-1.5 bg-sky-50 border border-sky-200 hover:bg-sky-100 text-sky-700 rounded-lg text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <CloudSun className="w-3.5 h-3.5" />
              <span>Weather Explorer</span>
            </button>
          )}
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 2. TRIP SUMMARY BAR + TOP-RIGHT RECOMMENDED BADGE */}
      {/* --------------------------------------------------------------------- */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Origin, Destination, Departure, Load, Interval */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
              Origin
            </span>
            <strong className="text-slate-900 font-bold text-xs truncate max-w-[180px] block" title={originName}>
              {originName.split(',')[0]}
            </strong>
          </div>

          <div className="text-slate-300 hidden sm:block">→</div>

          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
              Destination
            </span>
            <strong className="text-slate-900 font-bold text-xs truncate max-w-[180px] block" title={destName}>
              {destName.split(',')[0]}
            </strong>
          </div>

          <div className="h-6 w-px bg-slate-200 hidden md:block" />

          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
              Departure Time
            </span>
            <span className="text-slate-800 font-medium font-mono text-[11.5px]">
              {departureFormatted}
            </span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
              Cargo Weight
            </span>
            <span className="text-slate-800 font-semibold font-mono text-xs">
              {loadWeightFormatted}
            </span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
              Checkpoint Interval
            </span>
            <span className="text-slate-800 font-medium text-xs">
              {samplingFormatted}
            </span>
          </div>
        </div>

        {/* Right: Recommended Route Badge or All Ineligible Warning */}
        {isAllIneligible ? (
          <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-lg text-xs">
            <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0" />
            <div>
              <span className="font-bold text-rose-900 block text-[11.5px]">
                No Eligible Routes
              </span>
              <span className="text-[10.5px] text-rose-700">
                All paths encounter No Travel hazards
              </span>
            </div>
          </div>
        ) : winningRoute ? (
          <div className="flex items-center gap-3 bg-emerald-50/80 border border-emerald-200/80 px-3.5 py-2 rounded-xl text-xs">
            <div className="w-7 h-7 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shadow-2xs">
              {winningLetter}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-800">
                  Recommended Route:
                </span>
                <span className="font-bold text-slate-900 text-xs">
                  Route {winningLetter}
                </span>
                <span className="px-1.5 py-0.2 rounded-full text-[9.5px] font-bold bg-emerald-600 text-white flex items-center gap-0.5 shadow-2xs">
                  ★ Recommended
                </span>
              </div>
              <p className="text-[10.5px] text-emerald-900 line-clamp-1 max-w-sm mt-0.5">
                {recommendation.explanation || 'Safest route with lowest severe weather exposure.'}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 3. NO ELIGIBLE ROUTES ALERT (If all routes contain No Travel checkpoints) */}
      {/* --------------------------------------------------------------------- */}
      {isAllIneligible && (
        <div className="bg-rose-900 text-white rounded-xl p-4 shadow-sm border border-rose-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertOctagon className="w-6 h-6 text-rose-300 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-bold text-sm tracking-tight text-white">
                Dispatch Clearance Denied — All Routes Contain Severe Hazards
              </h4>
              <p className="text-xs text-rose-100 max-w-3xl leading-relaxed">
                {recommendation.explanation ||
                  'Every alternative route exceeds load-dependent wind or precipitation thresholds. No route meets configured safety regulations.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onEditTrip}
              className="px-3 py-1.5 bg-white text-rose-950 font-bold text-xs rounded-lg shadow-xs hover:bg-rose-50 transition cursor-pointer"
            >
              Adjust Departure / Load
            </button>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 4. MAIN COMPARISON BODY (2-COLUMN GRID) */}
      {/* --------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN: Route Comparison Cards (lg:col-span-4) */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Route Alternatives ({routes.length})
            </h3>
            <span className="text-[11px] text-slate-500">
              Select card to inspect map
            </span>
          </div>

          <div className="space-y-3">
            {routes.map((rt, idx) => (
              <RouteComparisonCard
                key={rt.id}
                route={rt}
                routeIndex={idx}
                isSelected={rt.id === currentRoute.id}
                onSelect={() => setSelectedRouteId(rt.id)}
                onViewDetails={(selectedRoute) => {
                  if (onNavigateToDetails) {
                    onNavigateToDetails(selectedRoute.id);
                  } else {
                    setDetailsModalRoute(selectedRoute);
                  }
                }}
              />
            ))}
          </div>
        </div>

        {/* RIGHT COLUMN: Interactive Map + Comparison Table + Recommendation Panel (lg:col-span-7) */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-5">
          {/* Top: Interactive React Leaflet Map */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <span>Interactive Route Geometry & Checkpoints</span>
              </h3>
              <span className="text-[11px] text-slate-500">
                Active: <strong className="text-slate-800">Route {winningLetter || 'A'}</strong> ({currentRoute.distance_miles} mi)
              </span>
            </div>

            <ErrorBoundary fallbackTitle="Map failed to load">
              <RouteMap
                routes={routes}
                selectedRouteId={currentRoute.id}
                onSelectRoute={setSelectedRouteId}
                timelineOffsetHours={timelineOffsetHours}
                samplingIntervalMiles={trip.sampling_interval_miles || 25}
              />
            </ErrorBoundary>
          </div>

          {/* Bottom Split: Metrics Comparison Table & Route Recommendation Panel */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
            {/* Table (xl:col-span-7) */}
            <div className="xl:col-span-7 min-h-[260px]">
              <ErrorBoundary fallbackTitle="Table failed to load">
                <RouteComparisonTable
                  routes={routes}
                  selectedRouteId={currentRoute.id}
                  onSelectRoute={setSelectedRouteId}
                  recommendedRouteId={recommendation.recommended_route_id}
                />
              </ErrorBoundary>
            </div>

            {/* Recommendation Analysis (xl:col-span-5) */}
            <div className="xl:col-span-5 min-h-[260px]">
              <ErrorBoundary fallbackTitle="Recommendation Panel failed to load">
                <RouteRecommendationPanel
                  recommendation={recommendation}
                  routes={routes}
                  trip={trip}
                />
              </ErrorBoundary>
            </div>
          </div>
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 5. CHECKPOINT INSPECTION MODAL (Accessible dialog for "View Details ->") */}
      {/* --------------------------------------------------------------------- */}
      {detailsModalRoute && (
        <CheckpointDetailsModal
          isOpen={Boolean(detailsModalRoute)}
          onClose={() => setDetailsModalRoute(null)}
          route={detailsModalRoute}
          routeIndex={routes.findIndex((r) => r.id === detailsModalRoute.id)}
          timelineOffsetHours={timelineOffsetHours}
          setTimelineOffsetHours={setTimelineOffsetHours}
          departureTime={trip.departure_time || departureTime}
          samplingIntervalMiles={trip.sampling_interval_miles || 25}
        />
      )}
    </div>
  );
}
