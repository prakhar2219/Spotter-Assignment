import React from 'react';
import { CheckCircle2, AlertOctagon, Star, Check } from 'lucide-react';

export const ROUTE_COLORS = ['#EF4444', '#2563EB', '#9333EA', '#F59E0B'];

/**
 * RouteComparisonTable
 * Displays side-by-side comparison of all returned routes from the backend.
 * Synchronized with selectedRouteId, highlighting the recommended route.
 */
export default function RouteComparisonTable({
  routes = [],
  selectedRouteId,
  onSelectRoute,
  recommendedRouteId,
}) {
  if (!routes || routes.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col h-full">
      <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200/80 flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
          Route Metrics Comparison
        </h4>
        <span className="text-[11px] text-slate-500">
          Click column to inspect route
        </span>
      </div>

      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/50">
              <th className="py-2.5 px-3 font-semibold text-slate-600 text-[11px] uppercase tracking-wider w-[120px]">
                Metric
              </th>
              {routes.map((rt, idx) => {
                const letter = String.fromCharCode(65 + idx);
                const isSelected = rt.id === selectedRouteId;
                const isRecommended = rt.id === recommendedRouteId || rt.is_recommended;
                const color = ROUTE_COLORS[idx % ROUTE_COLORS.length];

                return (
                  <th
                    key={rt.id}
                    onClick={() => onSelectRoute && onSelectRoute(rt.id)}
                    className={`py-2.5 px-3 cursor-pointer text-center transition-colors select-none ${
                      isSelected
                        ? 'bg-blue-50/80 text-blue-900 border-x border-blue-200'
                        : isRecommended
                        ? 'bg-emerald-50/50 text-emerald-950'
                        : 'text-slate-700 hover:bg-slate-100/60'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-4 h-4 rounded-full text-white text-[10px] font-bold flex items-center justify-center shadow-2xs"
                          style={{ backgroundColor: color }}
                        >
                          {letter}
                        </span>
                        <span className="font-bold text-xs truncate max-w-[110px]">
                          Route {letter}
                        </span>
                      </div>
                      {isRecommended && (
                        <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-teal-600 text-white flex items-center gap-0.5 shadow-2xs">
                          <Star className="w-2.5 h-2.5 fill-white" />
                          Recommended
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-[11.5px]">
            {/* Distance */}
            <tr className="hover:bg-slate-50/50">
              <td className="py-2 px-3 font-medium text-slate-500">Distance</td>
              {routes.map((rt) => {
                const isSelected = rt.id === selectedRouteId;
                return (
                  <td
                    key={rt.id}
                    onClick={() => onSelectRoute && onSelectRoute(rt.id)}
                    className={`py-2 px-3 text-center font-mono cursor-pointer ${
                      isSelected ? 'bg-blue-50/40 font-bold text-slate-900' : 'text-slate-800'
                    }`}
                  >
                    {Math.round(rt.distance_miles || rt.metrics?.total_distance_miles || 0)} mi
                  </td>
                );
              })}
            </tr>

            {/* Travel Time */}
            <tr className="hover:bg-slate-50/50">
              <td className="py-2 px-3 font-medium text-slate-500">Travel Time</td>
              {routes.map((rt) => {
                const isSelected = rt.id === selectedRouteId;
                return (
                  <td
                    key={rt.id}
                    onClick={() => onSelectRoute && onSelectRoute(rt.id)}
                    className={`py-2 px-3 text-center font-mono cursor-pointer ${
                      isSelected ? 'bg-blue-50/40 font-bold text-slate-900' : 'text-slate-800'
                    }`}
                  >
                    {rt.duration_formatted || rt.metrics?.travel_time_formatted || '—'}
                  </td>
                );
              })}
            </tr>

            {/* Severe Miles */}
            <tr className="hover:bg-slate-50/50">
              <td className="py-2 px-3 font-medium text-slate-500">Severe Miles</td>
              {routes.map((rt) => {
                const isSelected = rt.id === selectedRouteId;
                const severeMiles = Math.round(rt.metrics?.severe_miles || 0);
                return (
                  <td
                    key={rt.id}
                    onClick={() => onSelectRoute && onSelectRoute(rt.id)}
                    className={`py-2 px-3 text-center font-mono cursor-pointer ${
                      isSelected ? 'bg-blue-50/40' : ''
                    } ${severeMiles > 0 ? 'text-red-600 font-bold' : 'text-slate-700'}`}
                  >
                    {severeMiles} mi
                  </td>
                );
              })}
            </tr>

            {/* High Miles */}
            <tr className="hover:bg-slate-50/50">
              <td className="py-2 px-3 font-medium text-slate-500">High Miles</td>
              {routes.map((rt) => {
                const isSelected = rt.id === selectedRouteId;
                const highMiles = Math.round(rt.metrics?.high_miles || 0);
                return (
                  <td
                    key={rt.id}
                    onClick={() => onSelectRoute && onSelectRoute(rt.id)}
                    className={`py-2 px-3 text-center font-mono cursor-pointer ${
                      isSelected ? 'bg-blue-50/40' : ''
                    } ${highMiles > 0 ? 'text-orange-600 font-bold' : 'text-slate-700'}`}
                  >
                    {highMiles} mi
                  </td>
                );
              })}
            </tr>

            {/* Avg Risk Score */}
            <tr className="hover:bg-slate-50/50">
              <td className="py-2 px-3 font-medium text-slate-500">Avg Risk Score</td>
              {routes.map((rt) => {
                const isSelected = rt.id === selectedRouteId;
                const avgRisk = typeof rt.metrics?.average_risk === 'number'
                  ? rt.metrics.average_risk.toFixed(2)
                  : (rt.metrics?.distance_weighted_average_risk !== undefined ? Number(rt.metrics.distance_weighted_average_risk).toFixed(2) : '0.00');
                return (
                  <td
                    key={rt.id}
                    onClick={() => onSelectRoute && onSelectRoute(rt.id)}
                    className={`py-2 px-3 text-center font-mono cursor-pointer ${
                      isSelected ? 'bg-blue-50/40 font-bold text-slate-900' : 'text-slate-700'
                    }`}
                  >
                    {avgRisk} / 4.0
                  </td>
                );
              })}
            </tr>

            {/* Eligibility */}
            <tr className="hover:bg-slate-50/50">
              <td className="py-2 px-3 font-medium text-slate-500">Eligibility</td>
              {routes.map((rt) => {
                const isSelected = rt.id === selectedRouteId;
                const isEligible = rt.metrics?.is_eligible !== false && !rt.has_no_travel;
                return (
                  <td
                    key={rt.id}
                    onClick={() => onSelectRoute && onSelectRoute(rt.id)}
                    className={`py-2 px-3 text-center cursor-pointer ${
                      isSelected ? 'bg-blue-50/40' : ''
                    }`}
                  >
                    {isEligible ? (
                      <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Eligible
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                        <AlertOctagon className="w-3 h-3 text-rose-600" />
                        No Travel
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>

            {/* Selection Status Action */}
            <tr>
              <td className="py-2 px-3 font-medium text-slate-500">Map Selection</td>
              {routes.map((rt) => {
                const isSelected = rt.id === selectedRouteId;
                return (
                  <td
                    key={rt.id}
                    onClick={() => onSelectRoute && onSelectRoute(rt.id)}
                    className={`py-2 px-3 text-center cursor-pointer ${
                      isSelected ? 'bg-blue-50/40' : ''
                    }`}
                  >
                    {isSelected ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                        <Check className="w-3 h-3" />
                        Active View
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectRoute && onSelectRoute(rt.id);
                        }}
                        className="text-[10.5px] text-slate-500 hover:text-blue-600 font-semibold cursor-pointer underline decoration-dotted"
                      >
                        Inspect
                      </button>
                    )}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
