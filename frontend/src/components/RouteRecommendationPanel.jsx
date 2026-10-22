import React from 'react';
import { ShieldCheck, AlertOctagon, CheckCircle2, ChevronRight, Award } from 'lucide-react';

const PRIORITY_ORDER = [
  { step: 1, label: 'Fewest Severe miles', key: 'severe_miles', unit: 'mi', lowerIsBetter: true },
  { step: 2, label: 'Fewest High miles', key: 'high_miles', unit: 'mi', lowerIsBetter: true },
  { step: 3, label: 'Lowest avg risk score', key: 'average_risk', unit: '/ 4.0', lowerIsBetter: true },
  { step: 4, label: 'Shortest travel time', key: 'duration_seconds', unit: '', lowerIsBetter: true },
];

export default function RouteRecommendationPanel({
  recommendation,
  routes = [],
  trip = {},
}) {
  if (!recommendation) return null;

  const winnerRoute = routes.find((r) => r.id === recommendation.recommended_route_id);
  const metrics = winnerRoute?.metrics || {};
  const isNoEligible = recommendation.status === 'no_eligible_routes' || !winnerRoute;

  if (isNoEligible) {
    return (
      <div className="bg-white rounded-xl border border-rose-200 shadow-xs p-4 flex flex-col justify-between h-full">
        <div>
          <div className="flex items-center justify-between border-b border-rose-100 pb-2 mb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-rose-900 flex items-center gap-1.5">
              <AlertOctagon className="w-4 h-4 text-rose-600" />
              Recommendation Analysis
            </h4>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
              Dispatch Clearance Denied
            </span>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-rose-950 font-medium leading-relaxed">
              {recommendation.explanation || 'No route meets the configured safety rules. All candidate routes encounter No Travel hazards.'}
            </p>
            {recommendation.tradeoffs_summary && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-100 text-[11px] text-rose-800 font-mono">
                {recommendation.tradeoffs_summary}
              </div>
            )}
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-rose-100 text-[10.5px] text-slate-500">
          Recommendation Priority: 1. Fewest Severe miles → 2. Fewest High miles → 3. Lowest Avg Risk → 4. Shortest Time.
        </div>
      </div>
    );
  }

  // Format metrics
  const severeMiles = Math.round(metrics.severe_miles || 0);
  const highMiles = Math.round(metrics.high_miles || 0);
  const avgRisk = typeof metrics.average_risk === 'number'
    ? metrics.average_risk.toFixed(2)
    : (metrics.distance_weighted_average_risk !== undefined ? Number(metrics.distance_weighted_average_risk).toFixed(2) : '0.00');
  const travelDuration = winnerRoute?.duration_formatted || metrics.travel_time_formatted || '—';

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-4 flex flex-col justify-between h-full">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
          <div className="flex items-center gap-1.5">
            <Award className="w-4 h-4 text-emerald-600" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Route Recommendation Analysis
            </h4>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            Eligible for Dispatch
          </span>
        </div>

        {/* Winning Route Title & Backend Explanation */}
        <div className="space-y-2 mb-3">
          <div className="flex items-baseline gap-2">
            <h5 className="font-extrabold text-sm text-slate-900 tracking-tight">
              {recommendation.winning_route_name || winnerRoute.name || 'Recommended Route'}
            </h5>
            <span className="text-[10.5px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
              ★ Recommended
            </span>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            {recommendation.explanation || `${recommendation.winning_route_name || 'Winning route'} is recommended based on the strict safety priority order.`}
          </p>
        </div>

        {/* 4-Tier Safety Priority Check */}
        <div className="bg-slate-50/80 rounded-lg p-2.5 border border-slate-200/70 space-y-1.5 text-xs mb-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Strict Decision Priority Hierarchy:
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="flex items-center justify-between bg-white px-2 py-1 rounded border border-slate-200/60">
              <span className="text-slate-500">1. Severe Miles:</span>
              <strong className={`font-mono ${severeMiles === 0 ? 'text-emerald-700 font-bold' : 'text-slate-900'}`}>
                {severeMiles} mi {severeMiles === 0 ? '✓' : ''}
              </strong>
            </div>

            <div className="flex items-center justify-between bg-white px-2 py-1 rounded border border-slate-200/60">
              <span className="text-slate-500">2. High Miles:</span>
              <strong className="font-mono text-slate-900">
                {highMiles} mi
              </strong>
            </div>

            <div className="flex items-center justify-between bg-white px-2 py-1 rounded border border-slate-200/60">
              <span className="text-slate-500">3. Average Risk:</span>
              <strong className="font-mono text-slate-900">
                {avgRisk} / 4.0
              </strong>
            </div>

            <div className="flex items-center justify-between bg-white px-2 py-1 rounded border border-slate-200/60">
              <span className="text-slate-500">4. Travel Time:</span>
              <strong className="font-mono text-slate-900">
                {travelDuration}
              </strong>
            </div>
          </div>
        </div>

        {/* Comparison Trade-offs Summary */}
        {recommendation.tradeoffs_summary && (
          <div className="text-[11px] text-slate-500 bg-teal-50/50 p-2 rounded border border-teal-100/60 leading-relaxed">
            <span className="font-semibold text-teal-900">Alternative Analysis: </span>
            {recommendation.tradeoffs_summary}
          </div>
        )}
      </div>

      {/* Safety Compliance Footer */}
      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
        <span>Load Weight: {trip.load_weight_lb ? `${Number(trip.load_weight_lb).toLocaleString()} lbs` : '35,000 lbs'}</span>
        <span>Decision Order: Severe → High → Avg Risk → Duration</span>
      </div>
    </div>
  );
}
