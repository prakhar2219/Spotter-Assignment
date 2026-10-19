import React from 'react';
import { Check, Ban } from 'lucide-react';

export default function RouteComparisonCard({
  route,
  isSelected,
  onSelect,
}) {
  const isRecommended = route.is_recommended;
  const metrics = route.metrics || {};
  const isEligible = metrics.is_eligible !== false && !route.has_no_travel;

  const totalDist = metrics.total_distance_miles || route.distance_miles || 1;
  const pctLow = Math.round(((metrics.low_miles || 0) / totalDist) * 100);
  const pctMod = Math.round(((metrics.moderate_miles || 0) / totalDist) * 100);
  const pctHigh = Math.round(((metrics.high_miles || 0) / totalDist) * 100);
  const pctSev = Math.round(((metrics.severe_miles || 0) / totalDist) * 100);
  const pctNo = Math.round(((metrics.no_travel_miles || 0) / totalDist) * 100);
  const pctUnk = Math.round(((metrics.unknown_miles || 0) / totalDist) * 100);

  return (
    <div
      onClick={onSelect}
      className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between relative ${
        isSelected
          ? 'border-teal-600 bg-teal-50/20 ring-2 ring-teal-500/20 shadow-sm'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
      } ${isRecommended ? 'border-teal-500' : ''}`}
    >
      <div>
        {/* Header badges */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase ${
                isRecommended ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {route.id}
            </span>
            {isRecommended && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                ★ WINNER
              </span>
            )}
          </div>

          {isEligible ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              <Check className="w-3 h-3 text-emerald-600" />
              ELIGIBLE
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
              <Ban className="w-3 h-3 text-rose-600" />
              NO TRAVEL
            </span>
          )}
        </div>

        <h4 className="font-bold text-sm text-slate-900 mb-1 leading-snug line-clamp-2" title={route.name}>
          {route.name}
        </h4>

        {route.summary && (
          <p className="text-[11px] text-slate-500 mb-3 truncate">
            {route.summary}
          </p>
        )}

        {/* 4-Tier Decision Matrix */}
        <div className="grid grid-cols-2 gap-2 my-2.5 p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs">
          <div>
            <span className="text-[10px] text-slate-500 block uppercase font-mono">Tier 1: Severe</span>
            <span className={`font-mono font-bold text-xs ${
              (metrics.severe_miles || 0) > 0 ? 'text-orange-600' : 'text-emerald-700'
            }`}>
              {metrics.severe_miles !== undefined ? `${metrics.severe_miles} mi` : '—'}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-slate-500 block uppercase font-mono">Tier 2: High</span>
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
              {route.duration_formatted}
            </span>
          </div>
        </div>

        {/* Risk Mileage Progress Bar */}
        <div className="space-y-1 mb-2">
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>Risk Exposure:</span>
            <span>{route.distance_miles} mi</span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-100 flex overflow-hidden border border-slate-200">
            <div style={{ width: `${pctLow}%` }} className="bg-emerald-500" title={`Low: ${metrics.low_miles || 0} mi`} />
            <div style={{ width: `${pctMod}%` }} className="bg-sky-500" title={`Moderate: ${metrics.moderate_miles || 0} mi`} />
            <div style={{ width: `${pctHigh}%` }} className="bg-amber-500" title={`High: ${metrics.high_miles || 0} mi`} />
            <div style={{ width: `${pctSev}%` }} className="bg-orange-500" title={`Severe: ${metrics.severe_miles || 0} mi`} />
            <div style={{ width: `${pctNo}%` }} className="bg-rose-600" title={`No Travel: ${metrics.no_travel_miles || 0} mi`} />
            {pctUnk > 0 && (
              <div style={{ width: `${pctUnk}%` }} className="bg-purple-600" title={`Unknown: ${metrics.unknown_miles || 0} mi`} />
            )}
          </div>
        </div>
      </div>

      <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex justify-between items-center">
        <span>Checkpoints: <strong>{route.checkpoints_count || route.checkpoints?.length || 0}</strong></span>
        <span className={`font-semibold ${isSelected ? 'text-teal-700' : 'text-slate-400'}`}>
          {isSelected ? 'Active Selection' : 'Click to Inspect'}
        </span>
      </div>
    </div>
  );
}
