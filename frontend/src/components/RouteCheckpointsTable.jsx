import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Route, MoreHorizontal, AlertCircle } from 'lucide-react';

const RISK_BADGES = {
  'Low': {
    bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-500',
    label: 'Low',
  },
  'Moderate': {
    bg: 'bg-amber-50 text-amber-800 border-amber-200',
    dot: 'bg-amber-500',
    label: 'Moderate',
  },
  'High': {
    bg: 'bg-orange-50 text-orange-900 border-orange-200',
    dot: 'bg-orange-500',
    label: 'High',
  },
  'Severe': {
    bg: 'bg-red-50 text-red-900 border-red-200',
    dot: 'bg-red-500',
    label: 'Severe',
  },
  'No Travel': {
    bg: 'bg-rose-100 text-rose-950 border-rose-300 font-bold',
    dot: 'bg-rose-700',
    label: 'No Travel',
  },
  'Unknown': {
    bg: 'bg-purple-50 text-purple-900 border-purple-200',
    dot: 'bg-purple-500',
    label: 'Unknown',
  },
};

/**
 * Format timestamp to clean local time string (e.g., 8:00 AM, 12:20 PM)
 */
function formatLocalEta(isoString) {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

export default function RouteCheckpointsTable({
  checkpoints = [],
  selectedCheckpointId,
  onSelectCheckpoint,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const tableContainerRef = useRef(null);
  const rowRefs = useRef({});

  // Local filtering by query
  const filteredCheckpoints = useMemo(() => {
    if (!searchTerm.trim()) return checkpoints;
    const q = searchTerm.toLowerCase().trim();

    return checkpoints.filter((cp) => {
      const idxStr = String(cp.index || '');
      const distStr = String(cp.cumulative_distance_miles || '');
      const riskStr = (cp.risk?.overall_risk || '').toLowerCase();
      const windStr = String(cp.weather?.wind_speed_mph || '');
      const nameStr = (cp.name || '').toLowerCase();
      const etaStr = formatLocalEta(cp.estimated_arrival_time).toLowerCase();

      return (
        idxStr.includes(q) ||
        distStr.includes(q) ||
        riskStr.includes(q) ||
        windStr.includes(q) ||
        nameStr.includes(q) ||
        etaStr.includes(q)
      );
    });
  }, [checkpoints, searchTerm]);

  // Auto-scroll to selected checkpoint row if available
  useEffect(() => {
    if (selectedCheckpointId !== undefined && selectedCheckpointId !== null) {
      const el = rowRefs.current[selectedCheckpointId];
      if (el && tableContainerRef.current) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [selectedCheckpointId]);

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs flex flex-col h-[380px] sm:h-[440px] lg:h-[460px] overflow-hidden">
      {/* Header with Title and Search Input */}
      <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
        <div className="flex items-center gap-2">
          <Route className="w-4 h-4 text-blue-600" />
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Route Checkpoints ({checkpoints.length} total)
          </h3>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[200px] max-w-xs">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search checkpoints..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition"
          />
        </div>
      </div>

      {/* Checkpoint Scrollable Table */}
      <div ref={tableContainerRef} className="flex-1 overflow-y-auto overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-50 text-[11px] font-semibold text-slate-600 uppercase tracking-wider border-b border-slate-200 sticky top-0 z-10 select-none">
            <tr>
              <th className="py-2 px-3 w-10 text-center">#</th>
              <th className="py-2 px-3">Distance (mi)</th>
              <th className="py-2 px-3">ETA (Local)</th>
              <th className="py-2 px-3">Wind (mph)</th>
              <th className="py-2 px-3">Rain (in/hr)</th>
              <th className="py-2 px-3">Snow (in/hr)</th>
              <th className="py-2 px-3">Risk</th>
              <th className="py-2 px-2 text-center w-12">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-[11.5px]">
            {filteredCheckpoints.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                  No checkpoints match your search query.
                </td>
              </tr>
            ) : (
              filteredCheckpoints.map((cp) => {
                const isSelected = cp.index === selectedCheckpointId;
                const w = cp.weather || {};
                const riskLevel = cp.risk?.overall_risk || 'Low';
                const badge = RISK_BADGES[riskLevel] || RISK_BADGES['Low'];
                const etaFormatted = formatLocalEta(cp.estimated_arrival_time);
                const wind = w.wind_speed_mph !== undefined ? Math.round(w.wind_speed_mph) : '—';
                const rain = w.precipitation_in_hr !== undefined ? Number(w.precipitation_in_hr).toFixed(2) : '0.00';
                const snow = w.snowfall_in_hr !== undefined ? Number(w.snowfall_in_hr).toFixed(2) : '0.00';

                return (
                  <tr
                    key={cp.index}
                    ref={(el) => (rowRefs.current[cp.index] = el)}
                    onClick={() => onSelectCheckpoint && onSelectCheckpoint(cp.index)}
                    className={`cursor-pointer transition-colors select-none ${
                      isSelected
                        ? 'bg-blue-50/80 border-l-4 border-blue-600 font-medium'
                        : 'hover:bg-slate-50/80'
                    }`}
                  >
                    <td className="py-2 px-3 text-center font-mono text-slate-500 font-bold">
                      {cp.index}
                    </td>
                    <td className="py-2 px-3 font-mono text-slate-800">
                      {Math.round(cp.cumulative_distance_miles || 0)}
                    </td>
                    <td className="py-2 px-3 font-mono text-slate-700">
                      {etaFormatted}
                    </td>
                    <td className="py-2 px-3 font-mono text-slate-800">
                      {wind}
                    </td>
                    <td className="py-2 px-3 font-mono text-slate-700">
                      {rain}
                    </td>
                    <td className="py-2 px-3 font-mono text-slate-700">
                      {snow}
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] border ${badge.bg}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                        {badge.label}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-center text-slate-400 hover:text-slate-700">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onSelectCheckpoint) onSelectCheckpoint(cp.index);
                        }}
                        className="p-1 rounded hover:bg-slate-200/60 cursor-pointer"
                        title="Select checkpoint"
                      >
                        <MoreHorizontal className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
