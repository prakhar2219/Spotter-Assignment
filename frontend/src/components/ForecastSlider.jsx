import React, { useState, useEffect } from 'react';
import { Clock, Play, Pause, RotateCcw, Calendar, FastForward, Info } from 'lucide-react';

export default function ForecastSlider({
  offsetHours,
  onChangeOffset,
  baseDepartureTime,
  onApplyOffset,
  loading = false,
}) {
  const [isPlaying, setIsPlaying] = useState(false);

  // Auto-play interval for timeline sweep
  useEffect(() => {
    let timer = null;
    if (isPlaying) {
      timer = setInterval(() => {
        onChangeOffset((prev) => {
          if (prev >= 48) {
            setIsPlaying(false);
            return 48;
          }
          return prev + 1;
        });
      }, 750);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPlaying, onChangeOffset]);

  const formatDateTime = (dateObj) => {
    try {
      return dateObj.toLocaleString([], {
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

  const baseDate = baseDepartureTime ? new Date(baseDepartureTime) : new Date();
  const selectedDate = new Date(baseDate.getTime() + offsetHours * 3600 * 1000);

  const quickOffsets = [0, 6, 12, 24, 36, 48];

  const handleTogglePlay = () => {
    if (offsetHours >= 48) {
      onChangeOffset(0);
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3.5">
      {/* Header with Title and Mode Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-teal-600" />
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            0–48h Weather Forecast Slider
          </h4>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200">
            +{offsetHours}h Forecast Horizon
          </span>
        </div>
      </div>

      {/* Clearly Documented Reference Time & Selected Forecast Target */}
      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div>
          <span className="text-[10px] uppercase font-mono text-slate-400 block">Reference Departure</span>
          <span className="font-semibold text-slate-700 font-mono text-[11px]">
            {formatDateTime(baseDate)}
          </span>
        </div>

        <div className="text-right">
          <span className="text-[10px] uppercase font-mono text-teal-600 block font-bold">Selected Forecast Snapshot</span>
          <span className="font-bold text-slate-900 font-mono text-xs">
            {formatDateTime(selectedDate)}
          </span>
        </div>
      </div>

      {/* Slider Bar & Play Controls */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleTogglePlay}
            className={`p-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition ${
              isPlaying
                ? 'bg-amber-50 border-amber-300 text-amber-800'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
            }`}
            title={isPlaying ? 'Pause animation' : 'Play 0–48h corridor simulation'}
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span className="text-[10px] font-mono">Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span className="text-[10px] font-mono">Play</span>
              </>
            )}
          </button>

          <input
            type="range"
            min="0"
            max="48"
            step="1"
            value={offsetHours}
            onChange={(e) => {
              setIsPlaying(false);
              onChangeOffset(parseInt(e.target.value, 10));
            }}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-600 focus:outline-none"
            aria-label="0 to 48 hour forecast slider"
          />
        </div>

        {/* Quick Horizon Buttons */}
        <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono pt-0.5">
          {quickOffsets.map((hr) => (
            <button
              key={hr}
              type="button"
              onClick={() => {
                setIsPlaying(false);
                onChangeOffset(hr);
              }}
              className={`px-2 py-0.5 rounded border transition ${
                offsetHours === hr
                  ? 'font-bold text-teal-800 bg-teal-50 border-teal-300 shadow-2xs'
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'
              }`}
            >
              +{hr}h
            </button>
          ))}
        </div>
      </div>

      {/* Action Footer */}
      <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
        <p className="text-[10.5px] text-slate-500 leading-snug max-w-[260px]">
          Corridor heatmap updates in real-time using pre-fetched hourly model data. Zero additional API requests.
        </p>

        <button
          type="button"
          onClick={onApplyOffset}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50 shrink-0"
          title="Recalculate route ranking with departure shifted by selected offset"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Re-planning...' : 'Re-plan at Selected Hour'}
        </button>
      </div>
    </div>
  );
}
