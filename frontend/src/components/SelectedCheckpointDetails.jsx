import React from 'react';
import { MapPin, Wind, CloudRain, Snowflake, AlertCircle, ShieldAlert, CheckCircle2 } from 'lucide-react';

const RISK_THEMES = {
  'Low': {
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    iconColor: 'text-emerald-600',
    alertBg: 'bg-emerald-50 border-emerald-200 text-emerald-950',
    titleColor: 'text-emerald-900',
  },
  'Moderate': {
    badge: 'bg-amber-100 text-amber-900 border-amber-200',
    iconColor: 'text-amber-600',
    alertBg: 'bg-amber-50 border-amber-200 text-amber-950',
    titleColor: 'text-amber-900',
  },
  'High': {
    badge: 'bg-orange-100 text-orange-950 border-orange-200',
    iconColor: 'text-orange-600',
    alertBg: 'bg-orange-50 border-orange-200 text-orange-950',
    titleColor: 'text-orange-900',
  },
  'Severe': {
    badge: 'bg-red-100 text-red-950 border-red-200',
    iconColor: 'text-red-600',
    alertBg: 'bg-red-50 border-red-200 text-red-950',
    titleColor: 'text-red-900',
  },
  'No Travel': {
    badge: 'bg-rose-100 text-rose-950 border-rose-300 font-bold',
    iconColor: 'text-rose-700',
    alertBg: 'bg-rose-50 border-rose-200 text-rose-950',
    titleColor: 'text-rose-900',
  },
  'Unknown': {
    badge: 'bg-purple-100 text-purple-950 border-purple-200',
    iconColor: 'text-purple-600',
    alertBg: 'bg-purple-50 border-purple-200 text-purple-950',
    titleColor: 'text-purple-900',
  },
};

function formatEta(isoString) {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    let timeStr = d.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });
    const tzMatch = isoString.match(/([+-]\d{2}:\d{2}|Z)$/);
    if (tzMatch) {
      timeStr += ` (${tzMatch[0]})`;
    }
    return timeStr;
  } catch {
    return isoString;
  }
}

export default function SelectedCheckpointDetails({
  checkpoint,
  trip = {},
}) {
  if (!checkpoint) {
    return (
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-5 flex flex-col items-center justify-center text-center h-full min-h-[240px]">
        <MapPin className="w-8 h-8 text-slate-300 mb-2" />
        <h4 className="font-bold text-xs text-slate-700">No Checkpoint Selected</h4>
        <p className="text-[11px] text-slate-400 max-w-xs mt-1">
          Click on any marker on the map or row in the table to inspect weather measurements and risk evaluation.
        </p>
      </div>
    );
  }

  const w = checkpoint.weather || {};
  const r = checkpoint.risk || {};
  const conditions = r.conditions || {};
  const windRisk = conditions.wind?.risk || 'Low';
  const rainRisk = conditions.rain?.risk || 'Low';
  const snowRisk = conditions.snow?.risk || 'Low';
  const overallRisk = r.overall_risk || 'Low';
  const theme = RISK_THEMES[overallRisk] || RISK_THEMES['Low'];

  // Coordinates
  let lat = 0;
  let lon = 0;
  if (Array.isArray(checkpoint.coordinates) && checkpoint.coordinates.length >= 2) {
    lon = Number(checkpoint.coordinates[0]);
    lat = Number(checkpoint.coordinates[1]);
  }

  // Values
  const windMph = w.wind_speed_mph !== undefined ? Math.round(w.wind_speed_mph) : '—';
  const rainInHr = w.precipitation_in_hr !== undefined ? Number(w.precipitation_in_hr).toFixed(2) : '0.00';
  const snowInHr = w.snowfall_in_hr !== undefined ? Number(w.snowfall_in_hr).toFixed(2) : '0.00';

  // Subtitles
  const windSubtitle =
    windRisk === 'Severe' || windRisk === 'No Travel'
      ? 'Extreme winds exceed safety limits'
      : windRisk === 'High'
      ? 'High winds, use caution'
      : windRisk === 'Moderate'
      ? 'Moderate crosswinds present'
      : 'Safe operational speeds';

  const rainSubtitle =
    rainRisk === 'Severe' || rainRisk === 'High'
      ? 'Heavy rainfall expected'
      : rainRisk === 'Moderate'
      ? 'Moderate rain, slick roads'
      : 'No significant rain';

  const snowSubtitle =
    snowRisk === 'Severe' || snowRisk === 'High'
      ? 'Blizzard / heavy snow hazard'
      : snowRisk === 'Moderate'
      ? 'Accumulating snow possible'
      : 'No significant snowfall';

  // Factual explanation text
  let explanationText = r.explanation || '';
  if (!explanationText) {
    if (r.governing_factor) {
      explanationText = `The checkpoint is evaluated as ${overallRisk} risk, primarily governed by ${r.governing_factor}.`;
    } else {
      explanationText = `Conditions are within safe operating guidelines for all evaluated metrics.`;
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-4 flex flex-col justify-between h-full">
      <div>
        {/* Header with Title and Badges */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-600" />
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Selected Checkpoint Details
            </h4>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-blue-100 text-blue-800">
              Checkpoint {checkpoint.index}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold border ${theme.badge}`}>
              ↗ {overallRisk} Risk
            </span>
          </div>
        </div>

        {/* Top 3 Metric Boxes: Distance, ETA, Coordinates */}
        <div className="grid grid-cols-3 gap-2 text-xs mb-3">
          <div className="bg-slate-50/80 p-2 rounded-lg border border-slate-100">
            <span className="text-[10px] text-slate-500 block">Distance from start</span>
            <strong className="text-slate-900 font-bold font-mono text-xs">
              {Math.round(checkpoint.cumulative_distance_miles || 0)} miles
            </strong>
          </div>

          <div className="bg-slate-50/80 p-2 rounded-lg border border-slate-100">
            <span className="text-[10px] text-slate-500 block">ETA (Local)</span>
            <strong className="text-slate-900 font-bold font-mono text-xs truncate block" title={formatEta(checkpoint.estimated_arrival_time)}>
              {formatEta(checkpoint.estimated_arrival_time)}
            </strong>
          </div>

          <div className="bg-slate-50/80 p-2 rounded-lg border border-slate-100">
            <span className="text-[10px] text-slate-500 block">Coordinates</span>
            <strong className="text-slate-900 font-bold font-mono text-[11px] truncate block" title={`${lat.toFixed(4)}, ${lon.toFixed(4)}`}>
              {lat.toFixed(4)}, {lon.toFixed(4)}
            </strong>
          </div>
        </div>

        {/* 3 Weather Condition Boxes: Wind, Rain, Snow */}
        <div className="grid grid-cols-3 gap-2 text-xs mb-3">
          {/* Wind */}
          <div className="bg-slate-50/60 p-2.5 rounded-lg border border-slate-100/90 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                  <Wind className="w-3 h-3 text-slate-400" /> Wind
                </span>
                <span className={`px-1.5 py-0.2 rounded text-[9.5px] font-bold border ${RISK_THEMES[windRisk]?.badge || 'bg-slate-100'}`}>
                  {windRisk}
                </span>
              </div>
              <strong className="text-slate-900 font-bold text-xs font-mono block">
                {windMph} mph
              </strong>
            </div>
            <span className="text-[9.5px] text-slate-400 mt-1 leading-tight block">
              {windSubtitle}
            </span>
          </div>

          {/* Rain */}
          <div className="bg-slate-50/60 p-2.5 rounded-lg border border-slate-100/90 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                  <CloudRain className="w-3 h-3 text-slate-400" /> Rain
                </span>
                <span className={`px-1.5 py-0.2 rounded text-[9.5px] font-bold border ${RISK_THEMES[rainRisk]?.badge || 'bg-slate-100'}`}>
                  {rainRisk}
                </span>
              </div>
              <strong className="text-slate-900 font-bold text-xs font-mono block">
                {rainInHr} in/hr
              </strong>
            </div>
            <span className="text-[9.5px] text-slate-400 mt-1 leading-tight block">
              {rainSubtitle}
            </span>
          </div>

          {/* Snow */}
          <div className="bg-slate-50/60 p-2.5 rounded-lg border border-slate-100/90 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                  <Snowflake className="w-3 h-3 text-slate-400" /> Snow
                </span>
                <span className={`px-1.5 py-0.2 rounded text-[9.5px] font-bold border ${RISK_THEMES[snowRisk]?.badge || 'bg-slate-100'}`}>
                  {snowRisk}
                </span>
              </div>
              <strong className="text-slate-900 font-bold text-xs font-mono block">
                {snowInHr} in/hr
              </strong>
            </div>
            <span className="text-[9.5px] text-slate-400 mt-1 leading-tight block">
              {snowSubtitle}
            </span>
          </div>
        </div>
      </div>

      {/* Factual Explanation Alert Card */}
      <div className={`p-2.5 rounded-lg border ${theme.alertBg} text-xs mt-1`}>
        <div className="flex items-start gap-2">
          <AlertCircle className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${theme.iconColor}`} />
          <div className="space-y-0.5">
            <span className={`font-bold block text-[11px] ${theme.titleColor}`}>
              Why {overallRisk} Risk?
            </span>
            <p className="text-[11px] leading-relaxed opacity-90">
              {explanationText}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
