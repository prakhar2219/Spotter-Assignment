import React, { useState } from 'react';
import { Gauge, Filter } from 'lucide-react';
import { RISK_LEVELS } from './RiskLegend';

export default function CheckpointTable({
  route,
  samplingIntervalMiles = 25,
  timelineOffsetHours = 0,
}) {
  const [filterHazardousOnly, setFilterHazardousOnly] = useState(false);

  const isTimelineActive = timelineOffsetHours > 0;
  const showSnapshotData = isTimelineActive;

  if (!route || !route.checkpoints || route.checkpoints.length === 0) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-500 text-xs">
        No checkpoints available for this route.
      </div>
    );
  }

  const checkpoints = route.checkpoints;
  const filteredCheckpoints = filterHazardousOnly
    ? checkpoints.filter(cp => {
        const hourly = showSnapshotData ? cp.hourly_forecasts?.find(h => h.offset_hours === timelineOffsetHours) : null;
        const r = hourly ? hourly : cp.risk;
        const score = r?.overall_score;
        return (typeof score === 'number' && score > 0) || r?.overall_risk === 'Unknown' || r?.overall_risk === 'No Travel';
      })
    : checkpoints;

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm space-y-0">
      {/* Table Header Controls */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <Gauge className="w-4 h-4 text-teal-600" />
          <h4 className="font-bold text-slate-900">
            Route Checkpoint Weather & Risk ({checkpoints.length} points @ {samplingIntervalMiles} mi)
          </h4>
          {isTimelineActive && (
            <span className="px-2 py-0.5 rounded bg-teal-100 text-teal-800 text-[10.5px] font-mono font-bold border border-teal-200">
              +{timelineOffsetHours}h Snapshot
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setFilterHazardousOnly(!filterHazardousOnly)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1.5 transition border ${
              filterHazardousOnly
                ? 'bg-amber-100 text-amber-900 border-amber-300'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Filter className="w-3 h-3" />
            {filterHazardousOnly ? 'Showing Hazards Only' : 'Filter Hazards Only'}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
              <th className="py-2.5 px-3">#</th>
              <th className="py-2.5 px-3">Checkpoint</th>
              <th className="py-2.5 px-3">Distance</th>
              <th className="py-2.5 px-3">{isTimelineActive ? 'Scheduled ETA' : 'Estimated ETA'}</th>
              <th className="py-2.5 px-3">Overall Risk</th>
              <th className="py-2.5 px-3">Wind & Cargo</th>
              <th className="py-2.5 px-3">Rain Rate</th>
              <th className="py-2.5 px-3">Snow Rate</th>
              <th className="py-2.5 px-3">Temp</th>
              <th className="py-2.5 px-3">Governing Factor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {filteredCheckpoints.map((cp) => {
              const hourly = isTimelineActive && cp.hourly_forecasts ? cp.hourly_forecasts.find(h => h.offset_hours === timelineOffsetHours) : null;
              const w = hourly || cp.weather || {};
              const r = hourly ? { overall_risk: hourly.overall_risk, overall_score: hourly.overall_score, governing_factor: hourly.governing_factor, is_no_travel: hourly.is_no_travel } : (cp.risk || {});
              const cond = r.conditions || {};
              const windCond = cond.wind || {};
              const rainCond = cond.rain || {};
              const snowCond = cond.snow || {};
              const riskKey = r.overall_risk || (w.is_available === false ? 'Unknown' : 'Low');
              const badge = RISK_LEVELS[riskKey] || RISK_LEVELS['Low'];

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
                    <span className="truncate max-w-[140px]" title={cp.name}>{cp.name}</span>
                  </td>

                  <td className="py-2 px-3 font-mono text-slate-600 whitespace-nowrap">
                    {cp.cumulative_distance_miles} mi
                  </td>

                  <td className="py-2 px-3 font-mono text-slate-900 whitespace-nowrap">
                    {new Date(cp.estimated_arrival_time).toLocaleTimeString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>

                  <td className="py-2 px-3 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] border ${badge.bg}`}
                    >
                      <span className="font-bold text-[10px]">{badge.symbol || '●'}</span>
                      {badge.label}
                    </span>
                  </td>

                  <td className="py-2 px-3 whitespace-nowrap">
                    {w.wind_speed_mph !== null && w.wind_speed_mph !== undefined ? (
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-900 font-mono">
                          {w.wind_speed_mph} mph
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {windCond.risk}
                          {windCond.elevated_by_load && (
                            <span className="text-amber-700 font-bold ml-1" title="Elevated by load rules">
                              (Elevated)
                            </span>
                          )}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>

                  <td className="py-2 px-3 whitespace-nowrap">
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

                  <td className="py-2 px-3 whitespace-nowrap">
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

                  <td className="py-2 px-3 font-mono text-slate-800 whitespace-nowrap">
                    {w.temperature_f ? `${w.temperature_f}°F` : '—'}
                  </td>

                  <td className="py-2 px-3 text-[11px] text-slate-600 max-w-[200px] truncate" title={r.governing_factor || r.explanation}>
                    {r.governing_factor || '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
