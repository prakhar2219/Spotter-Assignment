import React from 'react';
import { Trophy, ShieldAlert, Award, AlertOctagon } from 'lucide-react';

const DECISION_CRITERION_LABELS = {
  'fewest_severe_miles': 'Tier 1: Fewest Severe Miles (Hazard Avoidance)',
  'fewest_high_miles': 'Tier 2: Fewest High Miles (Secondary Hazard Avoidance)',
  'lowest_average_risk': 'Tier 3: Lowest Distance-Weighted Average Risk',
  'shortest_travel_time': 'Tier 4: Shortest Travel Duration (Tie-Breaker)',
  'sole_eligible_route': 'Sole Eligible Alternative (All others No Travel)',
  'identical': 'Tied: Identical Safety & Duration Metrics',
};

export default function RecommendationBanner({ recommendation, routes = [] }) {
  if (!recommendation) return null;

  const winnerRoute = routes.find(r => r.id === recommendation.recommended_route_id);
  const metrics = winnerRoute?.metrics || {};

  if (recommendation.status === 'no_eligible_routes') {
    return (
      <div className="rounded-xl bg-gradient-to-r from-rose-950 via-rose-900 to-red-950 text-white p-5 shadow-sm border border-rose-600/50 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
          <AlertOctagon className="w-32 h-32 text-rose-300" />
        </div>

        <div className="relative z-10 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-400/40 text-rose-200 text-xs font-bold uppercase tracking-wider">
            <ShieldAlert className="w-4 h-4 text-rose-400 animate-pulse" />
            No Safe Route Available — Dispatch Clearance Denied
          </div>

          <h3 className="text-xl font-bold text-white tracking-tight">
            All Route Alternatives Exceed Configured Safety Rules
          </h3>

          <p className="text-sm text-rose-100 leading-relaxed font-normal">
            {recommendation.explanation}
          </p>

          {recommendation.tradeoffs_summary && (
            <div className="pt-3 border-t border-rose-800/60 text-xs text-rose-200 space-y-1">
              <span className="font-semibold block uppercase tracking-wider text-[11px] text-rose-300">
                Safety Rule Violations:
              </span>
              <p className="font-mono text-[11px] leading-relaxed">
                {recommendation.tradeoffs_summary}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (recommendation.status === 'recommended') {
    return (
      <div className="rounded-xl bg-gradient-to-r from-teal-950 via-slate-900 to-indigo-950 text-white p-5 shadow-sm border border-teal-500/40 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
          <Trophy className="w-36 h-36 text-teal-300" />
        </div>

        <div className="relative z-10 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-400/20 border border-teal-400/40 text-teal-300 text-xs font-bold uppercase tracking-wider">
              <Trophy className="w-3.5 h-3.5 text-teal-400" />
              Recommended Route — Official Dispatch Winner
            </div>
            <span className="text-xs font-mono px-2.5 py-1 rounded bg-white/10 text-teal-200 border border-white/10">
              {DECISION_CRITERION_LABELS[recommendation.decision_criterion] || recommendation.decision_criterion}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-baseline gap-3">
            <h3 className="text-2xl font-extrabold text-white tracking-tight">
              {recommendation.winning_route_name}
            </h3>
            <span className="text-xs text-teal-300 font-mono">
              (ID: {recommendation.recommended_route_id})
            </span>
          </div>

          <p className="text-sm text-slate-200 leading-relaxed font-normal">
            {recommendation.explanation}
          </p>

          {/* Quick Metrics Bar */}
          {winnerRoute && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
              <div className="p-2.5 rounded-lg bg-white/5 border border-white/10">
                <span className="text-[10px] uppercase font-mono text-slate-400 block">Total Distance</span>
                <span className="text-sm font-bold text-white font-mono">{winnerRoute.distance_miles} mi</span>
              </div>
              <div className="p-2.5 rounded-lg bg-white/5 border border-white/10">
                <span className="text-[10px] uppercase font-mono text-slate-400 block">Travel Duration</span>
                <span className="text-sm font-bold text-white font-mono">{winnerRoute.duration_formatted}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-white/5 border border-white/10">
                <span className="text-[10px] uppercase font-mono text-slate-400 block">Severe Miles</span>
                <span className={`text-sm font-bold font-mono ${
                  (metrics.severe_miles || 0) > 0 ? 'text-orange-400' : 'text-emerald-400'
                }`}>
                  {metrics.severe_miles ?? 0} mi
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-white/5 border border-white/10">
                <span className="text-[10px] uppercase font-mono text-slate-400 block">Avg Risk Score</span>
                <span className="text-sm font-bold text-white font-mono">
                  {metrics.distance_weighted_average_risk ?? 0} / 4
                </span>
              </div>
            </div>
          )}

          {recommendation.tradeoffs_summary && (
            <div className="pt-2 border-t border-white/10 text-xs text-slate-300 flex items-start gap-2">
              <Award className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-teal-300">Tradeoffs & Ineligibility Details: </span>
                <span>{recommendation.tradeoffs_summary}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
