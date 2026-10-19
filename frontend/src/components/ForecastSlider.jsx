import React from 'react';
import { Clock, Play, RotateCcw, Calendar } from 'lucide-react';

export default function ForecastSlider({
  offsetHours,
  onChangeOffset,
  baseDepartureTime,
  onApplyOffset,
  loading = false,
}) {
  const getOffsetDate = (offset) => {
    try {
      const base = baseDepartureTime ? new Date(baseDepartureTime) : new Date();
      const target = new Date(base.getTime() + offset * 3600 * 1000);
      return target.toLocaleString([], {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '—';
    }
  };

  const quickOffsets = [0, 6, 12, 24, 36, 48];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-teal-600" />
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            0–48 Hour Forecast Timeline Slider
          </h4>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200">
            +{offsetHours}h Departure Offset
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-[11px] text-slate-500 font-mono">
          <span>Now (+0h)</span>
          <span className="text-slate-900 font-semibold">{getOffsetDate(offsetHours)}</span>
          <span>+48h Max Horizon</span>
        </div>

        <input
          type="range"
          min="0"
          max="48"
          step="1"
          value={offsetHours}
          onChange={(e) => onChangeOffset(parseInt(e.target.value, 10))}
          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-600 focus:outline-none"
        />

        <div className="flex justify-between text-[10px] text-slate-400 font-mono pt-1">
          {quickOffsets.map((hr) => (
            <button
              key={hr}
              type="button"
              onClick={() => onChangeOffset(hr)}
              className={`px-1.5 py-0.5 rounded hover:bg-slate-100 transition ${
                offsetHours === hr ? 'font-bold text-teal-700 bg-teal-50' : 'text-slate-500'
              }`}
            >
              +{hr}h
            </button>
          ))}
        </div>
      </div>

      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
        <p className="text-[11px] text-slate-500">
          Slide to analyze how future storm movements alter route safety.
        </p>
        <button
          type="button"
          onClick={onApplyOffset}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50 shrink-0"
        >
          <Play className="w-3 h-3 text-teal-400 fill-teal-400" />
          Update ETA Forecasts
        </button>
      </div>
    </div>
  );
}
