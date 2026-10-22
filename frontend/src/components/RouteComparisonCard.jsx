import React from 'react';
import { ArrowRight, Star, CheckCircle2, AlertOctagon } from 'lucide-react';

export default function RouteComparisonCard({
  route,
  routeIndex = 0,
  isSelected = false,
  onSelect,
  onViewDetails,
}) {
  const isRecommended = route.is_recommended;
  const metrics = route.metrics || {};
  const isEligible = metrics.is_eligible !== false && !route.has_no_travel;

  // Route Letter (A, B, C...)
  const letter = String.fromCharCode(65 + routeIndex);
  const routeName = `Route ${letter}`;

  // Metrics
  const distanceMiles = Math.round(route.distance_miles || metrics.total_distance_miles || 0);
  const travelTimeFormatted = route.duration_formatted || metrics.travel_time_formatted || '—';

  // Arrival Time Formatting
  let arrivalFormatted = '—';
  const destCp = Array.isArray(route.checkpoints) && route.checkpoints.length > 0 ? route.checkpoints[route.checkpoints.length - 1] : null;
  const rawArrival = route.arrival_time || route.estimated_arrival_time || destCp?.estimated_arrival_time || metrics.estimated_arrival_formatted;
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
    } catch {
      arrivalFormatted = rawArrival;
    }
  }

  const severeMiles = Math.round(metrics.severe_miles || 0);
  const highMiles = Math.round(metrics.high_miles || 0);
  const averageRisk = typeof metrics.average_risk === 'number'
    ? metrics.average_risk.toFixed(2)
    : (metrics.distance_weighted_average_risk !== undefined ? Number(metrics.distance_weighted_average_risk).toFixed(2) : '0.00');

  // Percentages for segmented bar
  const totalDist = route.distance_miles || metrics.total_distance_miles || 1;
  const pctLow = Math.max(0, Math.round(((metrics.low_miles || 0) / totalDist) * 100));
  const pctMod = Math.max(0, Math.round(((metrics.moderate_miles || 0) / totalDist) * 100));
  const pctHigh = Math.max(0, Math.round(((metrics.high_miles || 0) / totalDist) * 100));
  const pctSev = Math.max(0, Math.round(((metrics.severe_miles || 0) / totalDist) * 100));
  const pctNo = Math.max(0, Math.round(((metrics.no_travel_miles || 0) / totalDist) * 100));

  return (
    <div
      onClick={onSelect}
      className={`p-4 rounded-xl border transition-all cursor-pointer select-none relative ${
        isSelected
          ? 'border-[#2563EB] bg-[#EFF6FF]/40 shadow-xs ring-1 ring-[#2563EB]'
          : 'border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-xs'
      }`}
    >
      {/* Header: Letter Badge + Route Name + Status Badges */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-2xs ${
              isRecommended || isSelected
                ? 'bg-[#2563EB] text-white'
                : 'bg-slate-700 text-white'
            }`}
          >
            {letter}
          </div>
          <h3 className="font-bold text-sm text-slate-900 tracking-tight">
            {routeName}
          </h3>
        </div>

        <div className="flex items-center gap-1.5">
          {isRecommended && (
            <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-[#0D9488] text-white flex items-center gap-1 shadow-2xs">
              <Star className="w-3 h-3 fill-white" />
              Recommended
            </span>
          )}

          {isEligible ? (
            <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-100 text-emerald-800">
              Eligible
            </span>
          ) : (
            <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-rose-100 text-rose-800 flex items-center gap-1">
              <AlertOctagon className="w-3 h-3 text-rose-600" />
              No Travel
            </span>
          )}
        </div>
      </div>

      {/* 3-Column x 2-Row Metrics Grid */}
      <div className="grid grid-cols-3 gap-y-2.5 gap-x-2 text-xs mb-3.5">
        <div>
          <span className="text-[10.5px] text-slate-500 block">Distance</span>
          <strong className="text-slate-900 font-bold text-xs">{distanceMiles} mi</strong>
        </div>

        <div>
          <span className="text-[10.5px] text-slate-500 block">Travel Time</span>
          <strong className="text-slate-900 font-bold text-xs">{travelTimeFormatted}</strong>
        </div>

        <div>
          <span className="text-[10.5px] text-slate-500 block">Arrival</span>
          <strong className="text-slate-900 font-bold text-[11px] truncate block" title={arrivalFormatted}>
            {arrivalFormatted}
          </strong>
        </div>

        <div>
          <span className="text-[10.5px] text-slate-500 block">Severe Miles</span>
          <strong className={`font-bold text-xs ${severeMiles > 0 ? 'text-red-600' : 'text-slate-900'}`}>
            {severeMiles} mi
          </strong>
        </div>

        <div>
          <span className="text-[10.5px] text-slate-500 block">High Miles</span>
          <strong className={`font-bold text-xs ${highMiles > 0 ? 'text-orange-600' : 'text-slate-900'}`}>
            {highMiles} mi
          </strong>
        </div>

        <div>
          <span className="text-[10.5px] text-slate-500 block">Avg Risk Score</span>
          <strong className="text-slate-900 font-bold text-xs">{averageRisk} / 4</strong>
        </div>
      </div>

      {/* Segmented Risk Proportion Bar */}
      <div className="w-full h-2 rounded-full overflow-hidden flex bg-slate-100 border border-slate-100 mb-3">
        {pctLow > 0 && (
          <div
            style={{ width: `${pctLow}%` }}
            className="bg-emerald-500 h-full"
            title={`Low Risk: ${metrics.low_miles || 0} mi`}
          />
        )}
        {pctMod > 0 && (
          <div
            style={{ width: `${pctMod}%` }}
            className="bg-amber-400 h-full"
            title={`Moderate Risk: ${metrics.moderate_miles || 0} mi`}
          />
        )}
        {pctHigh > 0 && (
          <div
            style={{ width: `${pctHigh}%` }}
            className="bg-orange-500 h-full"
            title={`High Risk: ${metrics.high_miles || 0} mi`}
          />
        )}
        {pctSev > 0 && (
          <div
            style={{ width: `${pctSev}%` }}
            className="bg-red-500 h-full"
            title={`Severe Risk: ${metrics.severe_miles || 0} mi`}
          />
        )}
        {pctNo > 0 && (
          <div
            style={{ width: `${pctNo}%` }}
            className="bg-rose-700 h-full"
            title={`No Travel: ${metrics.no_travel_miles || 0} mi`}
          />
        )}
      </div>

      {/* View Details Action Link */}
      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (onViewDetails) onViewDetails(route);
          }}
          className="text-xs font-semibold text-slate-700 hover:text-teal-600 flex items-center gap-1 transition-colors cursor-pointer group"
        >
          <span>View Details</span>
          <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:translate-x-0.5 group-hover:text-teal-600 transition-all" />
        </button>
      </div>
    </div>
  );
}
