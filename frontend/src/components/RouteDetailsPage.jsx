import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Plus,
  MapPin,
  Clock,
  Flag,
  AlertTriangle,
  AlertCircle,
  BarChart2,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
  AlertOctagon,
  Milestone,
  CloudSun,
} from 'lucide-react';
import RouteDetailsMap from './RouteDetailsMap';
import RouteCheckpointsTable from './RouteCheckpointsTable';
import SelectedCheckpointDetails from './SelectedCheckpointDetails';
import RouteRiskTimeline from './RouteRiskTimeline';
import RouteSummaryPanel from './RouteSummaryPanel';
import ErrorBoundary from './ErrorBoundary';

export default function RouteDetailsPage({
  planResult,
  selectedRouteId,
  onBackToComparison,
  onNewTrip,
  onNavigateToWeather,
}) {
  // If no trip or route data available
  if (!planResult || !planResult.routes || planResult.routes.length === 0) {
    return (
      <div className="max-w-md mx-auto px-6 py-16 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
          <MapPin className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-800">No Route Data Selected</h3>
        <p className="text-xs text-slate-500">
          Please submit a trip plan or select a route from the Route Comparison dashboard to inspect checkpoint details.
        </p>
        <button
          type="button"
          onClick={onNewTrip}
          className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
        >
          Plan a New Trip
        </button>
      </div>
    );
  }

  const routes = planResult.routes || [];
  const recommendation = planResult.recommendation || {};
  const trip = planResult.trip || {};

  // Find currently selected route (or fallback to recommended, or first route)
  const currentRoute =
    routes.find((r) => r.id === selectedRouteId) ||
    routes.find((r) => r.id === recommendation.recommended_route_id) ||
    routes[0];

  const currentRouteIndex = routes.findIndex((r) => r.id === currentRoute.id);
  const routeLetter = currentRouteIndex >= 0 ? String.fromCharCode(65 + currentRouteIndex) : 'A';
  const isRecommended = currentRoute.id === recommendation.recommended_route_id || currentRoute.is_recommended;
  const metrics = currentRoute.metrics || {};
  const isEligible = metrics.is_eligible !== false && !currentRoute.has_no_travel;

  // Checkpoints
  const checkpoints = currentRoute.checkpoints || [];

  // Active/Selected Checkpoint State (synced across Map, Table, Detail Panel, and Timeline)
  const [selectedCheckpointId, setSelectedCheckpointId] = useState(() => {
    return checkpoints.length > 0 ? checkpoints[0].index : 0;
  });

  const selectedCheckpoint = useMemo(() => {
    return checkpoints.find((c) => c.index === selectedCheckpointId) || checkpoints[0] || null;
  }, [checkpoints, selectedCheckpointId]);

  // Origin & Destination formatted
  const originName =
    trip.origin?.display_name ||
    trip.origin?.name ||
    (typeof trip.origin === 'string' ? trip.origin : 'Origin');
  const destName =
    trip.destination?.display_name ||
    trip.destination?.name ||
    (typeof trip.destination === 'string' ? trip.destination : 'Destination');


  // Metrics for Top Cards
  const distanceMiles = Math.round(currentRoute.distance_miles || metrics.total_distance_miles || 0);
  const travelTime = currentRoute.duration_formatted || metrics.travel_time_formatted || '—';

  let arrivalFormatted = '—';
  const destCp = Array.isArray(checkpoints) && checkpoints.length > 0 ? checkpoints[checkpoints.length - 1] : null;
  const rawArrival = currentRoute.arrival_time || currentRoute.estimated_arrival_time || destCp?.estimated_arrival_time || metrics.estimated_arrival_formatted;
  if (rawArrival) {
    try {
      const d = new Date(rawArrival);
      arrivalFormatted = d.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
      }) + ', ' + d.toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      });
      const tzMatch = typeof rawArrival === 'string' ? rawArrival.match(/([+-]\d{2}:\d{2}|Z)$/) : null;
      if (tzMatch) {
        arrivalFormatted += ` (${tzMatch[0]})`;
      }
    } catch {
      arrivalFormatted = rawArrival;
    }
  }

  const severeMiles = Math.round(metrics.severe_miles || 0);
  const highMiles = Math.round(metrics.high_miles || 0);
  const avgRisk = typeof metrics.average_risk === 'number'
    ? metrics.average_risk.toFixed(2)
    : (metrics.distance_weighted_average_risk !== undefined ? Number(metrics.distance_weighted_average_risk).toFixed(2) : '0.00');

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-5 space-y-4">
      {/* --------------------------------------------------------------------- */}
      {/* 1. BREADCRUMBS & TOP NAVIGATION ACTIONS */}
      {/* --------------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <button
            type="button"
            onClick={onNewTrip}
            className="hover:text-teal-600 transition-colors font-medium cursor-pointer"
          >
            Plan Trip
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <button
            type="button"
            onClick={onBackToComparison}
            className="hover:text-teal-600 transition-colors font-medium cursor-pointer"
          >
            Route Comparison
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-semibold text-blue-600">Route Details</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBackToComparison}
            className="px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 text-blue-600 hover:text-blue-700 rounded-lg text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Comparison</span>
          </button>
          {onNavigateToWeather && (
            <button
              type="button"
              onClick={() => onNavigateToWeather(currentRoute.id)}
              className="px-3 py-1.5 bg-sky-50 border border-sky-200 hover:bg-sky-100 text-sky-700 rounded-lg text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <CloudSun className="w-3.5 h-3.5" />
              <span>Weather Explorer</span>
            </button>
          )}
          <button
            type="button"
            onClick={onNewTrip}
            className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Trip</span>
          </button>
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 2. ROUTE HEADER: Title, Badges, Origin -> Destination */}
      {/* --------------------------------------------------------------------- */}
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Route {routeLetter} {isRecommended && <span className="text-slate-600 font-semibold">(Recommended)</span>}
          </h2>

          {isRecommended && (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#10B981] text-white flex items-center gap-1 shadow-2xs">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Recommended
            </span>
          )}

          {isEligible ? (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
              Eligible
            </span>
          ) : (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-1">
              <AlertOctagon className="w-3.5 h-3.5 text-rose-600" />
              No Travel
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-600">
          <MapPin className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-semibold text-slate-800">{originName}</span>
          <span className="text-slate-400">→</span>
          <span className="font-semibold text-slate-800">{destName}</span>
        </div>

        <p className="text-xs text-slate-500 pt-0.5">
          Detailed view of checkpoints, weather conditions and risk analysis for this route.
        </p>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 3. ROUTE METRICS: 7 Horizontal Cards */}
      {/* --------------------------------------------------------------------- */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {/* Distance */}
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Milestone className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-medium block">Distance</span>
            <strong className="text-sm font-bold text-slate-900 font-mono">{distanceMiles} mi</strong>
          </div>
        </div>

        {/* Travel Time */}
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-medium block">Travel Time</span>
            <strong className="text-sm font-bold text-slate-900 font-mono">{travelTime}</strong>
          </div>
        </div>

        {/* Estimated Arrival */}
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <Flag className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-medium block">Estimated Arrival</span>
            <strong className="text-[11px] font-bold text-slate-900 font-mono whitespace-pre-line leading-tight block">
              {arrivalFormatted}
            </strong>
          </div>
        </div>

        {/* Severe Miles */}
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-medium block">Severe Miles</span>
            <strong className={`text-sm font-bold font-mono ${severeMiles > 0 ? 'text-red-600' : 'text-slate-900'}`}>
              {severeMiles} mi
            </strong>
          </div>
        </div>

        {/* High Miles */}
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <AlertCircle className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-medium block">High Miles</span>
            <strong className={`text-sm font-bold font-mono ${highMiles > 0 ? 'text-orange-600' : 'text-slate-900'}`}>
              {highMiles} mi
            </strong>
          </div>
        </div>

        {/* Avg Risk Score */}
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
            <BarChart2 className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-medium block">Avg Risk Score</span>
            <strong className="text-sm font-bold text-slate-900 font-mono">{avgRisk} / 4</strong>
          </div>
        </div>

        {/* Status */}
        <div className={`rounded-xl border shadow-2xs p-3 flex items-center gap-3 ${
          isEligible ? 'bg-emerald-50/70 border-emerald-200' : 'bg-rose-50/70 border-rose-200'
        }`}>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            isEligible ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
          }`}>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-medium block">Status</span>
            <strong className={`text-sm font-bold ${isEligible ? 'text-emerald-800' : 'text-rose-800'}`}>
              {isEligible ? 'Eligible' : 'Ineligible'}
            </strong>
          </div>
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 4. MIDDLE SECTION: Interactive Map (Left) + Searchable Table (Right) */}
      {/* --------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Left: Interactive Map (lg:col-span-7) */}
        <div className="lg:col-span-7">
          <ErrorBoundary fallbackTitle="Map failed to load">
            <RouteDetailsMap
              route={currentRoute}
              trip={trip}
              selectedCheckpointId={selectedCheckpointId}
              onSelectCheckpoint={(cpId) => setSelectedCheckpointId(cpId)}
            />
          </ErrorBoundary>
        </div>

        {/* Right: Searchable Checkpoint Table (lg:col-span-5) */}
        <div className="lg:col-span-5">
          <ErrorBoundary fallbackTitle="Checkpoint Table failed to load">
            <RouteCheckpointsTable
              checkpoints={checkpoints}
              selectedCheckpointId={selectedCheckpointId}
              onSelectCheckpoint={(cpId) => setSelectedCheckpointId(cpId)}
            />
          </ErrorBoundary>
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 5. BOTTOM SECTION: Checkpoint Details (Left) + Timeline (Center) + Summary (Right) */}
      {/* --------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
        {/* Selected Checkpoint Details */}
        <div className="min-h-[260px]">
          <ErrorBoundary fallbackTitle="Checkpoint details failed to load">
            <SelectedCheckpointDetails
              checkpoint={selectedCheckpoint}
              trip={trip}
            />
          </ErrorBoundary>
        </div>

        {/* Route Risk Timeline */}
        <div className="min-h-[260px]">
          <ErrorBoundary fallbackTitle="Risk timeline failed to load">
            <RouteRiskTimeline
              route={currentRoute}
              selectedCheckpointId={selectedCheckpointId}
              onSelectCheckpoint={(cpId) => setSelectedCheckpointId(cpId)}
            />
          </ErrorBoundary>
        </div>

        {/* Route Summary */}
        <div className="min-h-[260px]">
          <ErrorBoundary fallbackTitle="Route summary failed to load">
            <RouteSummaryPanel
              route={currentRoute}
              isRecommended={isRecommended}
            />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
