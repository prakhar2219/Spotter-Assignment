import React from 'react';
import {
  FileText,
  MapPin,
  Clock,
  Calendar,
  AlertTriangle,
  AlertCircle,
  BarChart2,
  ShieldCheck,
  Award,
} from 'lucide-react';

export default function RouteSummaryPanel({
  route,
  isRecommended = false,
}) {
  if (!route) return null;

  const metrics = route.metrics || {};
  const distanceMiles = Math.round(route.distance_miles || metrics.total_distance_miles || 0);
  const travelTime = route.duration_formatted || metrics.travel_time_formatted || '—';

  // Format arrival timestamp
  let arrivalFormatted = '—';
  if (route.arrival_time) {
    try {
      const d = new Date(route.arrival_time);
      arrivalFormatted = d.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }) + ', ' + d.toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      });
      const tzMatch = route.arrival_time.match(/([+-]\d{2}:\d{2}|Z)$/);
      if (tzMatch) {
        arrivalFormatted += ` (${tzMatch[0]})`;
      }
    } catch {
      arrivalFormatted = route.arrival_time;
    }
  } else if (metrics.estimated_arrival_formatted) {
    arrivalFormatted = metrics.estimated_arrival_formatted;
  }

  const severeMiles = Math.round(metrics.severe_miles || 0);
  const highMiles = Math.round(metrics.high_miles || 0);
  const avgRisk = typeof metrics.average_risk === 'number'
    ? metrics.average_risk.toFixed(2)
    : (metrics.distance_weighted_average_risk !== undefined ? Number(metrics.distance_weighted_average_risk).toFixed(2) : '0.00');

  const isEligible = metrics.is_eligible !== false && !route.has_no_travel;

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-4 flex flex-col justify-between h-full">
      <div>
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5 mb-3">
          <FileText className="w-4 h-4 text-blue-600" />
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Route Summary
          </h4>
        </div>

        {/* Metrics List matching route_Details.png */}
        <div className="divide-y divide-slate-100 text-xs">
          {/* Distance */}
          <div className="py-2 flex items-center justify-between">
            <span className="text-slate-500 flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-slate-400" /> Distance
            </span>
            <strong className="font-mono text-slate-900 font-bold">
              {distanceMiles} miles
            </strong>
          </div>

          {/* Travel Time */}
          <div className="py-2 flex items-center justify-between">
            <span className="text-slate-500 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-slate-400" /> Travel Time
            </span>
            <strong className="font-mono text-slate-900 font-bold">
              {travelTime}
            </strong>
          </div>

          {/* Estimated Arrival */}
          <div className="py-2 flex items-center justify-between">
            <span className="text-slate-500 flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-slate-400" /> Estimated Arrival
            </span>
            <strong className="font-mono text-slate-900 text-[11px] truncate max-w-[155px]" title={arrivalFormatted}>
              {arrivalFormatted}
            </strong>
          </div>

          {/* Severe Miles */}
          <div className="py-2 flex items-center justify-between">
            <span className="text-slate-500 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-red-500" /> Severe Miles
            </span>
            <strong className={`font-mono font-bold ${severeMiles > 0 ? 'text-red-600' : 'text-slate-900'}`}>
              {severeMiles} miles
            </strong>
          </div>

          {/* High Miles */}
          <div className="py-2 flex items-center justify-between">
            <span className="text-slate-500 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-orange-500" /> High Miles
            </span>
            <strong className={`font-mono font-bold ${highMiles > 0 ? 'text-orange-600' : 'text-slate-900'}`}>
              {highMiles} miles
            </strong>
          </div>

          {/* Average Risk Score */}
          <div className="py-2 flex items-center justify-between">
            <span className="text-slate-500 flex items-center gap-2">
              <BarChart2 className="w-3.5 h-3.5 text-teal-600" /> Average Risk Score
            </span>
            <strong className="font-mono text-slate-900 font-bold">
              {avgRisk} / 4
            </strong>
          </div>

          {/* Status */}
          <div className="py-2 flex items-center justify-between">
            <span className="text-slate-500 flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Status
            </span>
            {isEligible ? (
              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-100 text-emerald-800">
                Eligible
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-rose-100 text-rose-800">
                No Travel
              </span>
            )}
          </div>

          {/* Recommendation */}
          <div className="py-2 flex items-center justify-between">
            <span className="text-slate-500 flex items-center gap-2">
              <Award className="w-3.5 h-3.5 text-teal-600" /> Recommendation
            </span>
            {isRecommended ? (
              <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-teal-600 text-white shadow-2xs">
                Recommended Route
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-medium bg-slate-100 text-slate-700">
                Alternative Route
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
