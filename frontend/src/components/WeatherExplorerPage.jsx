import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Wind,
  CloudRain,
  Snowflake,
  AlertTriangle,
  AlertOctagon,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  MapPin,
  Clock,
  Calendar,
  RefreshCw,
  Info,
  HelpCircle,
  Layers,
  Sliders,
  ChevronDown,
  Navigation,
  Gauge,
  Thermometer,
} from 'lucide-react';
import WeatherExplorerMap, { getCheckpointTimelineData } from './WeatherExplorerMap';
import ErrorBoundary from './ErrorBoundary';

const RISK_BADGES = {
  Low: {
    bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
    border: 'border-emerald-300',
  },
  Moderate: {
    bg: 'bg-amber-50 text-amber-800 border-amber-200',
    dot: 'bg-amber-500',
    border: 'border-amber-300',
  },
  High: {
    bg: 'bg-orange-50 text-orange-800 border-orange-200',
    dot: 'bg-orange-500',
    border: 'border-orange-300',
  },
  Severe: {
    bg: 'bg-red-50 text-red-800 border-red-200',
    dot: 'bg-red-500',
    border: 'border-red-300',
  },
  'No Travel': {
    bg: 'bg-rose-100 text-rose-900 border-rose-300',
    dot: 'bg-rose-700',
    border: 'border-rose-400',
  },
  Unknown: {
    bg: 'bg-purple-50 text-purple-800 border-purple-200',
    dot: 'bg-purple-500',
    border: 'border-purple-300',
  },
};

export default function WeatherExplorerPage({
  planResult,
  selectedRouteId,
  setSelectedRouteId,
  departureTime,
  onBackToComparison,
  onNewTrip,
  onRefresh,
  loading = false,
  apiError = null,
}) {
  // 1. Duration horizon selector: 12h, 24h, 36h, 48h
  const [durationHours, setDurationHours] = useState(48);

  // 2. Timeline scrubber offset: 0 to durationHours
  const [timelineOffsetHours, setTimelineOffsetHours] = useState(0);

  // 3. Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackStepHours, setPlaybackStepHours] = useState(1);
  const playbackTimerRef = useRef(null);

  // 4. Active weather layer: 'overall' | 'wind' | 'rain' | 'snow'
  const [activeLayer, setActiveLayer] = useState('overall');

  // 5. Selected checkpoint index
  const [selectedCheckpointId, setSelectedCheckpointId] = useState(0);

  // 6. Route selector dropdown open state
  const [isRouteDropdownOpen, setIsRouteDropdownOpen] = useState(false);

  // Keep timeline offset within active duration bounds
  useEffect(() => {
    if (timelineOffsetHours > durationHours) {
      setTimelineOffsetHours(durationHours);
    }
  }, [durationHours, timelineOffsetHours]);

  // Handle Playback Interval
  useEffect(() => {
    if (isPlaying) {
      playbackTimerRef.current = setInterval(() => {
        setTimelineOffsetHours((prev) => {
          const next = prev + playbackStepHours;
          if (next > durationHours) {
            return 0; // Loop playback back to departure
          }
          return next;
        });
      }, 1000);
    } else {
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
    }

    return () => {
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
    };
  }, [isPlaying, playbackStepHours, durationHours]);

  // Stop playback when route changes or component unmounts
  useEffect(() => {
    return () => {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    };
  }, [selectedRouteId]);

  const routes = planResult?.routes || [];
  const recommendation = planResult?.recommendation || {};
  const trip = planResult?.trip || {};

  // Current active route
  const currentRoute =
    routes.find((r) => r.id === selectedRouteId) ||
    routes.find((r) => r.id === recommendation.recommended_route_id) ||
    routes[0] || null;

  const currentRouteIndex = currentRoute ? routes.findIndex((r) => r.id === currentRoute?.id) : -1;
  const routeLetter = currentRouteIndex >= 0 ? String.fromCharCode(65 + currentRouteIndex) : 'A';
  const isRecommended = currentRoute?.id === recommendation.recommended_route_id || currentRoute?.is_recommended;
  const metrics = currentRoute?.metrics || {};
  const checkpoints = currentRoute?.checkpoints || [];

  // Default selected checkpoint to 0 if not present
  useEffect(() => {
    if (checkpoints.length > 0) {
      const exists = checkpoints.some((c) => c.index === selectedCheckpointId);
      if (!exists) {
        setSelectedCheckpointId(checkpoints[0].index);
      }
    }
  }, [checkpoints, selectedCheckpointId]);

  const selectedCheckpoint = useMemo(() => {
    return checkpoints.find((c) => c.index === selectedCheckpointId) || checkpoints[0] || null;
  }, [checkpoints, selectedCheckpointId]);

  // Checkpoint timeline weather data at current slider offset
  const selectedCheckpointData = useMemo(() => {
    if (!selectedCheckpoint) return null;
    return getCheckpointTimelineData(selectedCheckpoint, timelineOffsetHours);
  }, [selectedCheckpoint, timelineOffsetHours]);

  // Route points evaluated at current timeline offset
  const corridorStatusAtOffset = useMemo(() => {
    let severeCount = 0;
    let highCount = 0;
    let noTravelCount = 0;
    let unknownCount = 0;
    const severeCheckpoints = [];
    const noTravelCheckpoints = [];

    checkpoints.forEach((cp) => {
      const data = getCheckpointTimelineData(cp, timelineOffsetHours);
      if (data.is_no_travel || data.overall_risk === 'No Travel') {
        noTravelCount++;
        noTravelCheckpoints.push({ cp, data });
      } else if (data.overall_risk === 'Severe') {
        severeCount++;
        severeCheckpoints.push({ cp, data });
      } else if (data.overall_risk === 'High') {
        highCount++;
        severeCheckpoints.push({ cp, data });
      } else if (!data.is_available || data.overall_risk === 'Unknown') {
        unknownCount++;
      }
    });

    return {
      severeCount,
      highCount,
      noTravelCount,
      unknownCount,
      severeCheckpoints,
      noTravelCheckpoints,
      hasNoTravel: noTravelCount > 0,
      hasHighOrSevere: severeCount > 0 || highCount > 0,
    };
  }, [checkpoints, timelineOffsetHours]);

  // Format reference time
  const referenceTimeStr = trip.departure_time || departureTime || '';
  const formattedRefTime = useMemo(() => {
    if (!referenceTimeStr) return 'Departure Time';
    try {
      const d = new Date(referenceTimeStr);
      return d.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return referenceTimeStr;
    }
  }, [referenceTimeStr]);

  // Format current offset inspection time
  const formattedOffsetTime = useMemo(() => {
    if (!referenceTimeStr) return `T+${timelineOffsetHours}h`;
    try {
      const d = new Date(referenceTimeStr);
      d.setHours(d.getHours() + timelineOffsetHours);
      const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      const dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
      return `${dateStr}, ${timeStr}`;
    } catch {
      return `T+${timelineOffsetHours}h`;
    }
  }, [referenceTimeStr, timelineOffsetHours]);

  // Handle empty state AFTER all hooks are evaluated
  if (!planResult || !planResult.routes || planResult.routes.length === 0) {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto shadow-xs border border-teal-100">
          <MapPin className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-bold text-slate-800">No Planned Route Loaded</h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          The Weather Explorer visualizes weather evolution along a planned truck corridor. Please plan a trip or select a route first.
        </p>
        <button
          type="button"
          onClick={onNewTrip}
          className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
        >
          Plan a Trip
        </button>
      </div>
    );
  }

  // Quick navigation handlers for checkpoints
  const handlePrevCheckpoint = () => {
    if (!selectedCheckpoint || checkpoints.length === 0) return;
    const idx = checkpoints.findIndex((c) => c.index === selectedCheckpoint.index);
    if (idx > 0) {
      setSelectedCheckpointId(checkpoints[idx - 1].index);
    }
  };

  const handleNextCheckpoint = () => {
    if (!selectedCheckpoint || checkpoints.length === 0) return;
    const idx = checkpoints.findIndex((c) => c.index === selectedCheckpoint.index);
    if (idx < checkpoints.length - 1) {
      setSelectedCheckpointId(checkpoints[idx + 1].index);
    }
  };

  const originName = trip.origin?.display_name || trip.origin || 'Origin';
  const destName = trip.destination?.display_name || trip.destination || 'Destination';

  return (
    <ErrorBoundary>
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-5 space-y-5">
        {/* ===================================================================== */}
        {/* TOP BAR / BREADCRUMB & CONTROLS                                       */}
        {/* ===================================================================== */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-slate-200">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onBackToComparison}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition shadow-2xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Route Comparison</span>
            </button>

            <span className="text-slate-300">/</span>

            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Weather Explorer
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-teal-50 text-teal-700 border border-teal-200">
                0–48h Time Horizon
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Refresh Weather Button */}
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-2xs disabled:opacity-60"
              title="Refresh weather forecasts from provider"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-teal-600' : 'text-slate-500'}`} />
              <span>{loading ? 'Refreshing...' : 'Refresh Weather'}</span>
            </button>

            {/* Plan New Trip */}
            <button
              type="button"
              onClick={onNewTrip}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition shadow-2xs"
            >
              <span>New Trip</span>
            </button>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* API ERROR BANNER (PANEL 8)                                            */}
        {/* ===================================================================== */}
        {apiError && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-start gap-3">
              <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold">Weather Forecast API Issue</h4>
                <p className="text-[11.5px] text-rose-700 mt-0.5 leading-relaxed">
                  {apiError}. Previously loaded forecast data is preserved where available.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onRefresh}
                className="px-3 py-1.5 bg-rose-600 text-white hover:bg-rose-700 rounded-lg text-xs font-semibold transition"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={onBackToComparison}
                className="px-3 py-1.5 bg-white border border-rose-300 text-rose-800 hover:bg-rose-50 rounded-lg text-xs font-medium transition"
              >
                Back to Comparison
              </button>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* HEADER CONTROLS BAR: Route Selector, Start Time, Duration Selector    */}
        {/* ===================================================================== */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            {/* Route Selector (Cols 1-5) */}
            <div className="md:col-span-5 relative">
              <label className="block text-[10.5px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Selected Route
              </label>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsRouteDropdownOpen(!isRouteDropdownOpen)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl text-left transition"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-5 h-5 rounded-md bg-slate-900 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                      {routeLetter}
                    </span>
                    <span className="text-xs font-bold text-slate-900 truncate">
                      Route {routeLetter} {isRecommended && '(Recommended)'}
                    </span>
                    <span className="text-[11px] text-slate-500 shrink-0">
                      · {Math.round(currentRoute?.distance_miles || 0)} mi, {currentRoute?.duration_formatted || '—'}
                    </span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isRouteDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {isRouteDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 space-y-1">
                    {routes.map((r, i) => {
                      const letter = String.fromCharCode(65 + i);
                      const isRec = r.id === recommendation.recommended_route_id || r.is_recommended;
                      const isSel = r.id === currentRoute.id;
                      const isElig = r.metrics?.is_eligible !== false && !r.has_no_travel;

                      return (
                        <button
                          key={r.id || i}
                          type="button"
                          onClick={() => {
                            if (setSelectedRouteId) setSelectedRouteId(r.id);
                            setIsRouteDropdownOpen(false);
                          }}
                          className={`w-full px-3 py-2 text-left flex items-center justify-between text-xs transition ${
                            isSel ? 'bg-teal-50/80 text-teal-900' : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-md bg-slate-800 text-white text-[11px] font-bold flex items-center justify-center">
                              {letter}
                            </span>
                            <span className="font-semibold text-slate-900">Route {letter}</span>
                            {isRec && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                Recommended
                              </span>
                            )}
                            <span className="text-slate-500">
                              · {Math.round(r.distance_miles || 0)} mi
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              isElig ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                            }`}>
                              {isElig ? 'Eligible' : 'Ineligible'}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Forecast Reference Start Time (Cols 6-8) */}
            <div className="md:col-span-4 border-t md:border-t-0 md:border-l border-slate-100 md:pl-4">
              <label className="block text-[10.5px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Forecast Start Time
              </label>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                <Clock className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                <span className="truncate">{formattedRefTime}</span>
              </div>
            </div>

            {/* Horizon Duration Selector (Cols 9-12) */}
            <div className="md:col-span-3 border-t md:border-t-0 md:border-l border-slate-100 md:pl-4">
              <label className="block text-[10.5px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Forecast Horizon
              </label>
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg">
                {[12, 24, 36, 48].map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setDurationHours(h)}
                    className={`flex-1 py-1 text-[11px] font-semibold rounded-md transition ${
                      durationHours === h
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {h}h
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* MAIN TWO-COLUMN DASHBOARD GRID                                        */}
        {/* ===================================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* =================================================================== */}
          {/* LEFT COLUMN: INTERACTIVE MAP & CORRIDOR (Cols 1-7)                  */}
          {/* =================================================================== */}
          <div className="lg:col-span-7 space-y-3">
            <div className="bg-white rounded-2xl border border-slate-200/90 p-3.5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-teal-600" />
                  <span className="text-xs font-bold text-slate-900">
                    Route {routeLetter} Corridor Weather
                  </span>
                  <span className="text-[11px] text-slate-500">
                    ({originName} → {destName})
                  </span>
                </div>

                <div className="text-[11px] font-semibold text-slate-600">
                  {checkpoints.length} Checkpoints · {trip.sampling_interval_miles || 25} mi interval
                </div>
              </div>

              {/* Weather Explorer Leaflet Map */}
              <WeatherExplorerMap
                route={currentRoute}
                trip={trip}
                timelineOffsetHours={timelineOffsetHours}
                activeLayer={activeLayer}
                setActiveLayer={setActiveLayer}
                selectedCheckpointId={selectedCheckpointId}
                onSelectCheckpoint={(idx) => setSelectedCheckpointId(idx)}
              />

              {/* Map Footer Note */}
              <div className="flex items-center justify-between text-[11px] text-slate-500 px-1 pt-1 border-t border-slate-100">
                <span className="flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-teal-600" />
                  Click any numbered checkpoint marker to inspect localized weather and load safety rules.
                </span>
                <span className="font-medium text-slate-600">
                  Active Layer: <strong className="capitalize text-slate-900">{activeLayer === 'overall' ? 'Overall Risk' : activeLayer}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* =================================================================== */}
          {/* RIGHT COLUMN: CONTROLS, CONDITIONS & ALERTS (Cols 8-12)             */}
          {/* =================================================================== */}
          <div className="lg:col-span-5 space-y-4">
            {/* 1. FORECAST TIMELINE & PLAYBACK CARD (Panel 4) */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-teal-600" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Forecast Timeline
                  </h3>
                </div>

                {/* Animated Playing indicator */}
                {isPlaying && (
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-teal-100 text-teal-800 animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-teal-600"></span>
                    Playing (+{playbackStepHours}h/s)
                  </span>
                )}
              </div>

              {/* Time Display Badge */}
              <div className="bg-slate-900 text-white rounded-xl p-3 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Corridor Forecast Reference Time
                  </span>
                  <div className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5 mt-0.5">
                    <span>{formattedOffsetTime}</span>
                    <span className="text-xs font-medium text-teal-400">
                      (T+{timelineOffsetHours}h from departure)
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block font-medium">Offset</span>
                  <span className="text-base font-extrabold text-teal-300">
                    +{timelineOffsetHours}h
                  </span>
                </div>
              </div>

              {/* Timeline Slider with Ticks */}
              <div className="space-y-1.5 pt-1">
                <div className="relative">
                  <input
                    type="range"
                    min="0"
                    max={durationHours}
                    step="1"
                    value={timelineOffsetHours}
                    onChange={(e) => setTimelineOffsetHours(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-600 focus:outline-hidden"
                  />
                </div>

                {/* Slider Tick Labels */}
                <div className="flex justify-between text-[10px] font-semibold text-slate-400 px-0.5">
                  <span>0h (Dep)</span>
                  {durationHours >= 12 && <span>12h</span>}
                  {durationHours >= 24 && <span>24h</span>}
                  {durationHours >= 36 && <span>36h</span>}
                  <span>{durationHours}h</span>
                </div>
              </div>

              {/* Playback Controls Bar */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-2">
                <div className="flex items-center gap-1.5">
                  {/* Step Back */}
                  <button
                    type="button"
                    onClick={() => setTimelineOffsetHours((prev) => Math.max(0, prev - playbackStepHours))}
                    disabled={timelineOffsetHours === 0}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 disabled:opacity-40 transition"
                    title={`Step back -${playbackStepHours}h`}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  {/* Play / Pause Toggle */}
                  <button
                    type="button"
                    onClick={() => setIsPlaying(!isPlaying)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-2xs ${
                      isPlaying
                        ? 'bg-amber-600 hover:bg-amber-700 text-white'
                        : 'bg-teal-600 hover:bg-teal-700 text-white'
                    }`}
                  >
                    {isPlaying ? (
                      <>
                        <Pause className="w-3.5 h-3.5" />
                        <span>Pause</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Play Timeline</span>
                      </>
                    )}
                  </button>

                  {/* Step Forward */}
                  <button
                    type="button"
                    onClick={() => setTimelineOffsetHours((prev) => Math.min(durationHours, prev + playbackStepHours))}
                    disabled={timelineOffsetHours === durationHours}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 disabled:opacity-40 transition"
                    title={`Step forward +${playbackStepHours}h`}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  {/* Reset to 0h */}
                  <button
                    type="button"
                    onClick={() => setTimelineOffsetHours(0)}
                    disabled={timelineOffsetHours === 0}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 disabled:opacity-40 transition"
                    title="Reset to departure (T+0h)"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>

                {/* Step Size Selector */}
                <div className="flex items-center gap-1 text-[11px] text-slate-500">
                  <span className="font-semibold">Step:</span>
                  <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
                    {[1, 2, 3, 6].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setPlaybackStepHours(s)}
                        className={`px-1.5 py-0.5 text-[10.5px] font-bold rounded ${
                          playbackStepHours === s
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {s}h
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 2. DYNAMIC WARNING & ALERTS BANNER (Panels 6 & 7) */}
            {corridorStatusAtOffset.hasNoTravel && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 space-y-2 shadow-2xs">
                <div className="flex items-start gap-2.5">
                  <AlertOctagon className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-rose-900">
                      No Travel Conditions Detected at T+{timelineOffsetHours}h
                    </h4>
                    <p className="text-[11.5px] text-rose-800 mt-0.5 leading-relaxed">
                      {corridorStatusAtOffset.noTravelCount} checkpoint(s) on Route {routeLetter} exceed critical safety limits under the configured truck load ({trip.load_weight_lb ? `${Number(trip.load_weight_lb).toLocaleString()} lbs` : 'standard load'}).
                    </p>
                  </div>
                </div>

                <div className="bg-white/80 rounded-lg p-2 text-[11px] text-rose-900 border border-rose-200 space-y-1">
                  {corridorStatusAtOffset.noTravelCheckpoints.slice(0, 3).map(({ cp, data }) => (
                    <div key={cp.index} className="flex items-center justify-between">
                      <span className="font-semibold">Checkpoint {cp.index} (Mile {Math.round(cp.cumulative_distance_miles || 0)}):</span>
                      <span>
                        💨 {data.wind_speed_mph} mph wind · {data.governing_factor || 'No Travel rule triggered'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!corridorStatusAtOffset.hasNoTravel && corridorStatusAtOffset.hasHighOrSevere && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 space-y-2 shadow-2xs">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-amber-900">
                      High-Risk Weather Conditions Ahead at T+{timelineOffsetHours}h
                    </h4>
                    <p className="text-[11.5px] text-amber-800 mt-0.5 leading-relaxed">
                      Forecast shows elevated hazard on Route {routeLetter}. Exercise caution for high wind or precipitation.
                    </p>
                  </div>
                </div>

                <div className="bg-white/80 rounded-lg p-2 text-[11px] text-amber-900 border border-amber-200 space-y-1">
                  {corridorStatusAtOffset.severeCheckpoints.slice(0, 3).map(({ cp, data }) => (
                    <div key={cp.index} className="flex items-center justify-between">
                      <span className="font-semibold">Checkpoint {cp.index} (Mile {Math.round(cp.cumulative_distance_miles || 0)}):</span>
                      <span>
                        Risk: <strong>{data.overall_risk}</strong> ({data.governing_factor || 'Adverse weather'})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!corridorStatusAtOffset.hasNoTravel && !corridorStatusAtOffset.hasHighOrSevere && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-2.5 shadow-2xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-xs font-medium text-emerald-800">
                  Route corridor clear of Severe or No Travel risks at T+{timelineOffsetHours}h.
                </span>
              </div>
            )}

            {/* 3. SELECTED CHECKPOINT WEATHER CONDITIONS (Panel 3 & Details) */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-teal-600" />
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">
                      Checkpoint {selectedCheckpoint?.index || 0} Conditions
                    </h3>
                    <span className="text-[10.5px] text-slate-500">
                      Mile {Math.round(selectedCheckpoint?.cumulative_distance_miles || 0)} · ETA: {selectedCheckpoint?.estimated_arrival_time ? new Date(selectedCheckpoint.estimated_arrival_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—'}
                    </span>
                  </div>
                </div>

                {/* Checkpoint Stepper */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handlePrevCheckpoint}
                    disabled={!selectedCheckpoint || selectedCheckpoint.index === checkpoints[0]?.index}
                    className="p-1 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 transition"
                    title="Previous Checkpoint"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[11px] font-bold text-slate-800 px-1">
                    #{selectedCheckpoint?.index || 0}
                  </span>
                  <button
                    type="button"
                    onClick={handleNextCheckpoint}
                    disabled={!selectedCheckpoint || selectedCheckpoint.index === checkpoints[checkpoints.length - 1]?.index}
                    className="p-1 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 transition"
                    title="Next Checkpoint"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* 3 Weather Condition Cards Grid */}
              <div className="grid grid-cols-3 gap-2.5">
                {/* Wind Card */}
                <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-slate-500 mb-1">
                      <span className="text-[10.5px] font-bold uppercase tracking-wider">Wind</span>
                      <Wind className="w-3.5 h-3.5 text-sky-600" />
                    </div>
                    <div className="text-lg font-black text-slate-900 tracking-tight">
                      {selectedCheckpointData?.wind_speed_mph !== undefined && selectedCheckpointData?.wind_speed_mph !== null
                        ? `${selectedCheckpointData.wind_speed_mph} mph`
                        : '—'}
                    </div>
                  </div>
                  <div className="mt-2 pt-1 border-t border-slate-200/60 flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 font-medium">Status</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                      selectedCheckpointData?.wind_speed_mph >= 45
                        ? 'bg-rose-100 text-rose-800'
                        : selectedCheckpointData?.wind_speed_mph >= 35
                        ? 'bg-orange-100 text-orange-800'
                        : selectedCheckpointData?.wind_speed_mph >= 25
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {selectedCheckpointData?.wind_speed_mph >= 45
                        ? 'Severe'
                        : selectedCheckpointData?.wind_speed_mph >= 35
                        ? 'High'
                        : selectedCheckpointData?.wind_speed_mph >= 25
                        ? 'Moderate'
                        : 'Low'}
                    </span>
                  </div>
                </div>

                {/* Rain Card */}
                <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-slate-500 mb-1">
                      <span className="text-[10.5px] font-bold uppercase tracking-wider">Rain</span>
                      <CloudRain className="w-3.5 h-3.5 text-blue-600" />
                    </div>
                    <div className="text-lg font-black text-slate-900 tracking-tight">
                      {selectedCheckpointData?.precipitation_in_hr !== undefined && selectedCheckpointData?.precipitation_in_hr !== null
                        ? `${selectedCheckpointData.precipitation_in_hr} in/h`
                        : '0.00'}
                    </div>
                  </div>
                  <div className="mt-2 pt-1 border-t border-slate-200/60 flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 font-medium">Status</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                      selectedCheckpointData?.precipitation_in_hr >= 0.5
                        ? 'bg-rose-100 text-rose-800'
                        : selectedCheckpointData?.precipitation_in_hr >= 0.25
                        ? 'bg-orange-100 text-orange-800'
                        : selectedCheckpointData?.precipitation_in_hr >= 0.1
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {selectedCheckpointData?.precipitation_in_hr >= 0.5
                        ? 'Severe'
                        : selectedCheckpointData?.precipitation_in_hr >= 0.25
                        ? 'High'
                        : selectedCheckpointData?.precipitation_in_hr >= 0.1
                        ? 'Moderate'
                        : 'Low'}
                    </span>
                  </div>
                </div>

                {/* Snow Card */}
                <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-slate-500 mb-1">
                      <span className="text-[10.5px] font-bold uppercase tracking-wider">Snow</span>
                      <Snowflake className="w-3.5 h-3.5 text-cyan-600" />
                    </div>
                    <div className="text-lg font-black text-slate-900 tracking-tight">
                      {selectedCheckpointData?.snowfall_in_hr !== undefined && selectedCheckpointData?.snowfall_in_hr !== null
                        ? `${selectedCheckpointData.snowfall_in_hr} in/h`
                        : '0.00'}
                    </div>
                  </div>
                  <div className="mt-2 pt-1 border-t border-slate-200/60 flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 font-medium">Temp</span>
                    <span className="text-[10.5px] font-semibold text-slate-700">
                      {selectedCheckpointData?.temperature_f !== null && selectedCheckpointData?.temperature_f !== undefined
                        ? `${Math.round(selectedCheckpointData.temperature_f)}°F`
                        : '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Overall Risk & Governing Factor Summary Bar */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/90 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Overall Risk Rating
                  </span>
                  <span className="text-xs font-medium text-slate-600">
                    Governing factor: <strong>{selectedCheckpointData?.governing_factor || 'Safe conditions'}</strong>
                  </span>
                </div>

                <div className="text-right">
                  <span
                    className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold border ${
                      RISK_BADGES[selectedCheckpointData?.overall_risk]?.bg || 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {selectedCheckpointData?.overall_risk || 'Low'}
                  </span>
                </div>
              </div>

              {/* Load Rule Advisory */}
              {trip.load_weight_lb && (
                <div className="text-[11px] text-slate-500 bg-slate-50/50 p-2 rounded-lg border border-slate-100 flex items-start gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                  <span>
                    Truck weight: <strong>{Number(trip.load_weight_lb).toLocaleString()} lbs</strong>. Load safety threshold: Wind &gt; 35 mph elevates to Severe; Wind &gt; 45 mph with &gt; 30,000 lbs triggers No Travel rollover cutoff.
                  </span>
                </div>
              )}
            </div>

            {/* 4. SELECTED ROUTE SUMMARY METRICS (Panel 5 & Overview) */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Route {routeLetter} Trip Summary
                </span>
                <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full ${
                  metrics.is_eligible !== false && !currentRoute?.has_no_travel
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}>
                  {metrics.is_eligible !== false && !currentRoute?.has_no_travel ? 'Eligible for Dispatch' : 'Ineligible Route'}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-500 block">Distance</span>
                  <span className="text-xs font-bold text-slate-800">
                    {Math.round(currentRoute?.distance_miles || 0)} mi
                  </span>
                </div>

                <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-500 block">Travel Time</span>
                  <span className="text-xs font-bold text-slate-800">
                    {currentRoute?.duration_formatted || '—'}
                  </span>
                </div>

                <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-500 block">Severe Miles</span>
                  <span className="text-xs font-bold text-rose-700">
                    {Math.round(metrics.severe_miles || 0)} mi
                  </span>
                </div>

                <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-500 block">Avg Risk</span>
                  <span className="text-xs font-bold text-amber-800">
                    {typeof metrics.average_risk === 'number'
                      ? metrics.average_risk.toFixed(2)
                      : (metrics.distance_weighted_average_risk !== undefined
                          ? Number(metrics.distance_weighted_average_risk).toFixed(2)
                          : '0.00')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
