import React from 'react';
import { X, MapPin, Gauge, ShieldAlert } from 'lucide-react';
import CheckpointTable from './CheckpointTable';
import ForecastSlider from './ForecastSlider';

export default function CheckpointDetailsModal({
  isOpen,
  onClose,
  route,
  routeIndex = 0,
  timelineOffsetHours,
  setTimelineOffsetHours,
  departureTime,
  samplingIntervalMiles = 25,
}) {
  if (!isOpen || !route) return null;

  const letter = String.fromCharCode(65 + routeIndex);
  const routeName = `Route ${letter}`;
  const metrics = route.metrics || {};
  const isRecommended = route.is_recommended;
  const isEligible = metrics.is_eligible !== false && !route.has_no_travel;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#2563EB] text-white flex items-center justify-center font-bold text-sm shadow-xs">
              {letter}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">{routeName} Details</h3>
                {isRecommended && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#0D9488] text-white">
                    ★ Recommended
                  </span>
                )}
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  isEligible ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  {isEligible ? 'Eligible' : 'No Travel'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {route.distance_miles} miles &bull; {route.duration_formatted} &bull; {route.checkpoints?.length || 0} checkpoints analyzed
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* 0-48 Hour Forecast Slider */}
          <ForecastSlider
            timelineOffsetHours={timelineOffsetHours}
            setTimelineOffsetHours={setTimelineOffsetHours}
            baseDepartureTime={departureTime}
          />

          {/* Checkpoint Breakdown Table */}
          <CheckpointTable
            route={route}
            samplingIntervalMiles={samplingIntervalMiles}
            timelineOffsetHours={timelineOffsetHours}
          />
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
