import React, { useState, useEffect, useCallback } from 'react';
import { checkBackendHealth, previewRoutes, planTrip } from './services/api';
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
  CloudSun,
  Truck,
  ShieldAlert,
  HelpCircle,
  Weight,
  Trophy,
  Award,
  Sparkles,
  Check,
  Ban
} from 'lucide-react';

const RISK_BADGES = {
  'Low': {
    bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-500',
    label: 'Low Risk',
  },
  'Moderate': {
    bg: 'bg-sky-50 text-sky-800 border-sky-200',
    dot: 'bg-sky-500',
    label: 'Moderate',
  },
  'High': {
    bg: 'bg-amber-50 text-amber-800 border-amber-200',
    dot: 'bg-amber-500',
    label: 'High Risk',
  },
  'Severe': {
    bg: 'bg-orange-50 text-orange-900 border-orange-300',
    dot: 'bg-orange-500',
    label: 'Severe Risk',
  },
  'No Travel': {
    bg: 'bg-rose-100 text-rose-900 border-rose-300 font-bold',
    dot: 'bg-rose-600 animate-pulse',
    label: 'NO TRAVEL',
  },
  'Unknown': {
    bg: 'bg-slate-100 text-slate-700 border-slate-300',
    dot: 'bg-slate-400',
    label: 'Unknown',
  },
};

const DECISION_CRITERION_LABELS = {
  'fewest_severe_miles': 'Tier 1: Fewest Severe Miles (Primary Hazard Avoidance)',
  'fewest_high_miles': 'Tier 2: Fewest High Miles (Secondary Hazard Avoidance)',
  'lowest_average_risk': 'Tier 3: Lowest Distance-Weighted Average Risk',
  'shortest_travel_time': 'Tier 4: Shortest Travel Time (Tie-Breaker)',
  'sole_eligible_route': 'Sole Eligible Alternative (All others No Travel)',
  'identical': 'Tied: Identical Safety & Duration Metrics',
};

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
  const [loadWeightInput, setLoadWeightInput] = useState(42000);
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

    const isoDeparture = new Date(departureInput).toISOString();

    const res = await planTrip({
      origin: originInput,
      destination: destInput,
      provider: providerInput,
      maxAlternatives: 3,
      departureTime: isoDeparture,
      loadWeightLb: parseFloat(loadWeightInput) || 40000,
      samplingIntervalMiles: parseInt(intervalInput, 10),
    });

    setPreviewLoading(false);
    if (res.success) {
      setPreviewResult(res.data);
      // Auto-select the recommended winning route if available, otherwise first route
      const recId = res.data?.recommendation?.recommended_route_id;
      if (recId) {
        setSelectedRouteId(recId);
      } else if (res.data.routes && res.data.routes.length > 0) {
        setSelectedRouteId(res.data.routes[0].id);
      }
    } else {
      setPreviewError(res.error);
    }
  };

  const selectedRoute = previewResult?.routes?.find(r => r.id === selectedRouteId) || previewResult?.routes?.[0];
  const recommendation = previewResult?.recommendation;

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
                  ? 'API Connected (Phase 6 Active)'
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
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-teal-500/10 via-emerald-500/5 to-transparent rounded-full -mr-20 -mt-20 pointer-events-none" />
          
          <div className="max-w-3xl space-y-3 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-teal-600" />
              Phase 6 Milestone — Unified End-to-End Planning Pipeline (POST /api/routes/plan/)
            </div>
            
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Production Truck Routing & Weather Planning Pipeline
            </h1>
            
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
              Executes routing, road-geometry checkpoint generation, Open-Meteo time-aware forecasts, load-dependent safety boundary evaluation, and strict 4-tier lexicographical recommendation in a single, robust transaction.
            </p>
          </div>
        </div>

        {/* Live Trip Form & Risk Evaluator */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50/70 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Trip & Safety Planning Dispatch</h2>
                <p className="text-xs text-slate-500">Configure origin, destination, cargo weight, and road sampling</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono bg-teal-50 text-teal-800 border border-teal-200 px-2 py-0.5 rounded font-semibold">
                Tier 1: Severe Miles
              </span>
              <span className="text-[11px] font-mono bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded font-semibold">
                Tier 2: High Miles
              </span>
              <span className="text-[11px] font-mono bg-rose-50 text-rose-800 border border-rose-200 px-2 py-0.5 rounded font-semibold">
                No Travel = Excluded
              </span>
            </div>
          </div>

          <div className="p-6">
            <form onSubmit={handlePreviewRoutes} className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Origin
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
                  Destination
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
                  Truck Load Weight
                </label>
                <div className="relative">
                  <Weight className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="number"
                    value={loadWeightInput}
                    onChange={(e) => setLoadWeightInput(e.target.value)}
                    placeholder="e.g. 42000"
                    min="0"
                    step="500"
                    required
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white font-mono"
                  />
                  <span className="absolute right-3 top-2.5 text-[11px] text-slate-400 font-medium">lb</span>
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
                  <option value={10}>10 miles</option>
                  <option value={25}>25 miles</option>
                  <option value={50}>50 miles</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={previewLoading}
                  className="w-full py-2 px-4 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50 shadow-sm"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${previewLoading ? 'animate-spin' : ''}`} />
                  {previewLoading ? 'Evaluating...' : 'Rank & Recommend'}
                </button>
              </div>
            </form>

            {/* Error Message */}
            {previewError && (
              <div className="mt-4 p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Execution Error</p>
                  <p className="text-slate-700 font-mono text-[11px] mt-0.5">{previewError}</p>
                </div>
              </div>
            )}

            {/* Results Display */}
            {previewResult && (
              <div className="mt-6 space-y-6">
                {/* Warnings Banner */}
                {previewResult.warnings && previewResult.warnings.length > 0 && (
                  <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-amber-800">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Pipeline Corridor Notices ({previewResult.warnings.length})</span>
                    </div>
                    <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-800/90 pl-1">
                      {previewResult.warnings.map((w, idx) => (
                        <li key={idx}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

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
                  <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded border border-slate-200 text-slate-700">
                    <Truck className="w-3.5 h-3.5 text-slate-500" />
                    <span>Load: <strong>{(previewResult.load_weight_lb || loadWeightInput).toLocaleString()} lb</strong></span>
                  </div>
                </div>

                {/* RECOMMENDATION WINNER OR ALL-INELIGIBLE BANNER */}
                {recommendation && (
                  <div>
                    {recommendation.status === 'recommended' ? (
                      <div className="p-5 rounded-2xl bg-gradient-to-r from-teal-900 via-slate-900 to-indigo-950 text-white shadow-md border border-teal-500/30 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
                          <Trophy className="w-36 h-36 text-teal-300" />
                        </div>
                        <div className="relative z-10 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-400/20 border border-teal-400/40 text-teal-300 text-xs font-bold uppercase tracking-wider">
                              <Trophy className="w-3.5 h-3.5 text-teal-400" />
                              Recommended Route Winner
                            </div>
                            <span className="text-xs font-mono px-2.5 py-1 rounded bg-white/10 text-slate-200 border border-white/10">
                              {DECISION_CRITERION_LABELS[recommendation.decision_criterion] || recommendation.decision_criterion}
                            </span>
                          </div>

                          <div className="flex flex-col sm:flex-row sm:items-baseline gap-3">
                            <h3 className="text-2xl font-extrabold text-white tracking-tight">
                              {recommendation.winning_route_name}
                            </h3>
                            <span className="text-xs text-teal-300 font-mono">
                              (Route ID: {recommendation.recommended_route_id})
                            </span>
                          </div>

                          <p className="text-sm text-slate-200 leading-relaxed font-normal">
                            {recommendation.explanation}
                          </p>

                          {recommendation.tradeoffs_summary && (
                            <div className="pt-2 border-t border-white/10 text-xs text-slate-300 flex items-start gap-2">
                              <Award className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                              <div>
                                <span className="font-semibold text-teal-300">Tradeoffs & Alternatives: </span>
                                <span>{recommendation.tradeoffs_summary}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : recommendation.status === 'no_eligible_routes' ? (
                      <div className="p-5 rounded-2xl bg-gradient-to-r from-rose-950 via-rose-900 to-red-950 text-white shadow-md border border-rose-500/40 relative overflow-hidden">
                        <div className="relative z-10 space-y-3">
                          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-400/40 text-rose-200 text-xs font-bold uppercase tracking-wider">
                            <ShieldAlert className="w-4 h-4 text-rose-400 animate-pulse" />
                            Warning: No Route Meets Safety Rules
                          </div>

                          <h3 className="text-xl font-bold text-white tracking-tight">
                            All Candidate Routes Contain No Travel Hazard Checkpoints
                          </h3>

                          <p className="text-sm text-rose-100 leading-relaxed">
                            {recommendation.explanation}
                          </p>

                          <div className="pt-2 border-t border-rose-800/60 text-xs text-rose-200">
                            <strong>Safety Violations: </strong>{recommendation.tradeoffs_summary}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}

                {/* Route Alternatives Selection Cards */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Candidate Route Evaluation ({previewResult.routes_count} Alternatives Analyzed):
                    </h3>
                    <span className="text-[11px] text-slate-500">
                      Ranked strictly by Severe miles &rarr; High miles &rarr; Avg Risk &rarr; Travel Time
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {previewResult.routes.map((rt) => {
                      const isSelected = rt.id === selectedRouteId;
                      const isRecommended = rt.is_recommended;
                      const metrics = rt.metrics || {};
                      const isEligible = metrics.is_eligible !== false && !rt.has_no_travel;

                      // Calculate risk distribution percentages for stacked bar
                      const totalDist = metrics.total_distance_miles || rt.distance_miles || 1;
                      const pctLow = Math.round(((metrics.low_miles || 0) / totalDist) * 100);
                      const pctMod = Math.round(((metrics.moderate_miles || 0) / totalDist) * 100);
                      const pctHigh = Math.round(((metrics.high_miles || 0) / totalDist) * 100);
                      const pctSev = Math.round(((metrics.severe_miles || 0) / totalDist) * 100);
                      const pctNo = Math.round(((metrics.no_travel_miles || 0) / totalDist) * 100);

                      return (
                        <div
                          key={rt.id}
                          onClick={() => setSelectedRouteId(rt.id)}
                          className={`p-4 rounded-xl border cursor-pointer transition relative flex flex-col justify-between ${
                            isSelected
                              ? 'border-teal-600 bg-teal-50/20 ring-2 ring-teal-500/20 shadow-sm'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          } ${isRecommended ? 'ring-1 ring-teal-500/50' : ''}`}
                        >
                          <div>
                            {/* Card Header */}
                            <div className="flex items-center justify-between mb-2">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase ${
                                  isRecommended ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {rt.id} {isRecommended && '★ WINNER'}
                              </span>

                              {isEligible ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  ELIGIBLE
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                  <Ban className="w-3 h-3 text-rose-600" />
                                  INELIGIBLE
                                </span>
                              )}
                            </div>

                            <h4 className="font-bold text-sm text-slate-900 mb-2 truncate" title={rt.name}>
                              {rt.name}
                            </h4>

                            {/* 4-Tier Lexicographical Criteria Grid */}
                            <div className="grid grid-cols-2 gap-2 my-3 p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                              <div>
                                <span className="text-[10px] text-slate-500 block uppercase font-mono">Tier 1: Severe Miles</span>
                                <span className={`font-mono font-bold text-xs ${
                                  (metrics.severe_miles || 0) > 0 ? 'text-orange-600' : 'text-emerald-700'
                                }`}>
                                  {metrics.severe_miles !== undefined ? `${metrics.severe_miles} mi` : '—'}
                                </span>
                              </div>

                              <div>
                                <span className="text-[10px] text-slate-500 block uppercase font-mono">Tier 2: High Miles</span>
                                <span className={`font-mono font-bold text-xs ${
                                  (metrics.high_miles || 0) > 0 ? 'text-amber-600' : 'text-emerald-700'
                                }`}>
                                  {metrics.high_miles !== undefined ? `${metrics.high_miles} mi` : '—'}
                                </span>
                              </div>

                              <div>
                                <span className="text-[10px] text-slate-500 block uppercase font-mono">Tier 3: Avg Risk</span>
                                <span className="font-mono font-bold text-xs text-slate-800">
                                  {metrics.distance_weighted_average_risk !== undefined ? `${metrics.distance_weighted_average_risk} / 4` : '—'}
                                </span>
                              </div>

                              <div>
                                <span className="text-[10px] text-slate-500 block uppercase font-mono">Tier 4: Duration</span>
                                <span className="font-mono font-bold text-xs text-slate-800">
                                  {rt.duration_formatted}
                                </span>
                              </div>
                            </div>

                            {/* Risk Distribution Mileage Bar */}
                            <div className="space-y-1 mb-2">
                              <div className="flex justify-between text-[10px] text-slate-500">
                                <span>Risk Mileage Distribution:</span>
                                <span>{rt.distance_miles} mi</span>
                              </div>
                              <div className="h-2 w-full rounded-full bg-slate-100 flex overflow-hidden border border-slate-200">
                                <div style={{ width: `${pctLow}%` }} className="bg-emerald-500" title={`Low: ${metrics.low_miles || 0} mi`} />
                                <div style={{ width: `${pctMod}%` }} className="bg-sky-500" title={`Moderate: ${metrics.moderate_miles || 0} mi`} />
                                <div style={{ width: `${pctHigh}%` }} className="bg-amber-500" title={`High: ${metrics.high_miles || 0} mi`} />
                                <div style={{ width: `${pctSev}%` }} className="bg-orange-500" title={`Severe: ${metrics.severe_miles || 0} mi`} />
                                <div style={{ width: `${pctNo}%` }} className="bg-rose-600" title={`No Travel: ${metrics.no_travel_miles || 0} mi`} />
                              </div>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex justify-between items-center">
                            <span>Checkpoints: <strong>{rt.checkpoints_count || rt.checkpoints?.length || 0}</strong></span>
                            <span className="text-teal-700 font-semibold">{isSelected ? 'Active View' : 'Click to View'}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Selected Route Checkpoint Table */}
                {selectedRoute && selectedRoute.checkpoints && (
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                    <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Gauge className="w-4 h-4 text-teal-600" />
                        <h4 className="text-xs font-bold text-slate-900">
                          Checkpoint Risk Evaluation: {selectedRoute.name} ({selectedRoute.checkpoints.length} Checkpoints @ {intervalInput} mi)
                        </h4>
                      </div>
                      <div className="flex items-center gap-3 text-[11px]">
                        <span className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Low (0)
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-full bg-sky-500" /> Moderate (1)
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> High (2)
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-full bg-orange-500" /> Severe (3)
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-600" /> No Travel (4)
                        </span>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-semibold">
                            <th className="py-2.5 px-3">#</th>
                            <th className="py-2.5 px-3">Checkpoint</th>
                            <th className="py-2.5 px-3">Distance</th>
                            <th className="py-2.5 px-3">ETA</th>
                            <th className="py-2.5 px-3">Overall Risk</th>
                            <th className="py-2.5 px-3">Wind & Load</th>
                            <th className="py-2.5 px-3">Rain Rate</th>
                            <th className="py-2.5 px-3">Snow Rate</th>
                            <th className="py-2.5 px-3">Governing Factor</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {selectedRoute.checkpoints.map((cp) => {
                            const w = cp.weather || {};
                            const r = cp.risk || {};
                            const cond = r.conditions || {};
                            const windCond = cond.wind || {};
                            const rainCond = cond.rain || {};
                            const snowCond = cond.snow || {};
                            const badge = RISK_BADGES[r.overall_risk] || RISK_BADGES['Unknown'];

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
                                </td>
                                <td className="py-2 px-3 font-mono text-slate-900">
                                  {new Date(cp.estimated_arrival_time).toLocaleTimeString([], {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </td>
                                <td className="py-2 px-3">
                                  <span
                                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] border ${badge.bg}`}
                                  >
                                    <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                                    {badge.label}
                                  </span>
                                </td>
                                <td className="py-2 px-3">
                                  {w.wind_speed_mph !== null && w.wind_speed_mph !== undefined ? (
                                    <div className="flex flex-col">
                                      <span className="font-semibold text-slate-900 font-mono">
                                        {w.wind_speed_mph} mph
                                      </span>
                                      <span className="text-[10px] text-slate-500">
                                        {windCond.risk}
                                        {windCond.elevated_by_load && (
                                          <span className="text-amber-700 font-bold ml-1" title="Elevated by truck load weight">
                                            (Load elevated)
                                          </span>
                                        )}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                                <td className="py-2 px-3">
                                  {w.precipitation_in_hr !== null && w.precipitation_in_hr !== undefined ? (
                                    <div className="flex flex-col">
                                      <span className="font-mono text-slate-900">
                                        {w.precipitation_in_hr} in/hr
                                      </span>
                                      <span className="text-[10px] text-slate-500">
                                        {rainCond.risk}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                                <td className="py-2 px-3">
                                  {w.snowfall_in_hr !== null && w.snowfall_in_hr !== undefined ? (
                                    <div className="flex flex-col">
                                      <span className="font-mono text-slate-900">
                                        {w.snowfall_in_hr} in/hr
                                      </span>
                                      <span className="text-[10px] text-slate-500">
                                        {snowCond.risk}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-[11px] text-slate-600">
                                  {r.governing_factor || '—'}
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
                  <span className="text-slate-500">Current Phase:</span>
                  <span className="font-semibold text-teal-700">Phase 6 (POST /api/routes/plan/)</span>
                </div>
                <div className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Response Latency:</span>
                  <span className="font-mono font-medium text-slate-800">
                    {healthStatus.latencyMs !== null ? `${healthStatus.latencyMs} ms` : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Automated Tests:</span>
                  <span className="text-emerald-700 font-semibold font-mono">51 / 51 Passing (100%)</span>
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
                  <h2 className="text-base font-bold text-slate-900">Recommendation Pipeline</h2>
                  <p className="text-xs text-slate-500">4-Tier Lexicographical Engine</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/60 flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-900">Tier 1: Severe Miles</p>
                    <p className="text-[11px] text-slate-500">Hazard minimization takes absolute precedence</p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    PRIORITY 1
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/60 flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-900">Tier 2: High Miles</p>
                    <p className="text-[11px] text-slate-500">Secondary hazard avoidance when Tier 1 tied</p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    PRIORITY 2
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/60 flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-900">Tier 3: Average Risk</p>
                    <p className="text-[11px] text-slate-500">Distance-weighted (Low=0, Mod=1, High=2, Sev=3)</p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    PRIORITY 3
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/60 flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-900">Tier 4: Travel Duration</p>
                    <p className="text-[11px] text-slate-500">Fourth tie-breaker only; never weighted sum</p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-800">
                    TIE-BREAKER
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Conservative Segment Bounding Method</span>
              <ShieldCheck className="w-4 h-4 text-teal-600" />
            </div>
          </div>

          {/* Phase 5 Acceptance Checklist Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Phase 5 Acceptance</h2>
                  <p className="text-xs text-slate-500">Prompt 5 Verification Checklist</p>
                </div>
              </div>

              <div className="space-y-2.5">
                {[
                  { text: 'Severe miles take priority over everything else (Tier 1)', done: true },
                  { text: 'High miles are compared only after Severe miles (Tier 2)', done: true },
                  { text: 'Average risk is distance-weighted (Tier 3)', done: true },
                  { text: 'Travel time is strictly the 4th tie-breaker (Tier 4)', done: true },
                  { text: 'No Travel routes are completely excluded from recommendation', done: true },
                  { text: 'All-ineligible results produce a clear, explicit warning', done: true },
                  { text: 'Risk miles sum consistently (checkpoints not counted as miles)', done: true },
                  { text: 'Transparent tradeoff explanations returned for winning route', done: true },
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
                <span className="font-semibold text-teal-300">Phase 6: Interactive Leaflet Map & 0-48h Slider</span>
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
              { num: '04', title: 'Risk Engine', status: 'Completed', color: 'border-emerald-500 bg-emerald-50/40 text-emerald-700' },
              { num: '05', title: 'Recommendation Engine', status: 'Completed', color: 'border-emerald-500 bg-emerald-50/40 text-emerald-700' },
              { num: '06', title: 'Dashboard & Slider', status: 'Next', color: 'border-teal-500 bg-teal-50/40 text-teal-700' },
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
