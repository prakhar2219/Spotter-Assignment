import React, { useMemo, useState } from 'react';
import { Activity } from 'lucide-react';

const RISK_SCORE_MAP = {
  'Low': 0,
  'Moderate': 1,
  'High': 2,
  'Severe': 3,
  'No Travel': 4,
  'Unknown': 1.5,
};

const RISK_COLOR_MAP = {
  'Low': '#10B981',        // Emerald
  'Moderate': '#F59E0B',   // Amber
  'High': '#F97316',       // Orange
  'Severe': '#EF4444',     // Red
  'No Travel': '#BE123C',  // Rose
  'Unknown': '#7C3AED',    // Purple
};

export default function RouteRiskTimeline({
  route,
  selectedCheckpointId,
  onSelectCheckpoint,
}) {
  const [hoveredCpIndex, setHoveredCpIndex] = useState(null);

  const checkpoints = route?.checkpoints || [];
  const metrics = route?.metrics || {};
  const totalDistance = Math.max(route?.distance_miles || metrics.total_distance_miles || 1, 1);

  // Severe, High, and Moderate/Low miles from backend metrics
  const severeMiles = Math.round(metrics.severe_miles || 0);
  const highMiles = Math.round(metrics.high_miles || 0);
  const modLowMiles = Math.max(0, Math.round(totalDistance - severeMiles - highMiles));

  // Percentages for bottom segmented bar
  const pctSevere = Math.min(100, Math.max(0, (severeMiles / totalDistance) * 100));
  const pctHigh = Math.min(100 - pctSevere, Math.max(0, (highMiles / totalDistance) * 100));
  const pctModLow = Math.max(0, 100 - pctSevere - pctHigh);

  // SVG dimensions
  const svgWidth = 520;
  const svgHeight = 150;
  const padLeft = 45;
  const padRight = 20;
  const padTop = 15;
  const padBottom = 25;
  const plotWidth = svgWidth - padLeft - padRight;
  const plotHeight = svgHeight - padTop - padBottom;

  // Active checkpoint for tooltip
  const activeCheckpoint = useMemo(() => {
    const targetIdx = hoveredCpIndex !== null ? hoveredCpIndex : selectedCheckpointId;
    return checkpoints.find((c) => c.index === targetIdx) || checkpoints[0] || null;
  }, [checkpoints, hoveredCpIndex, selectedCheckpointId]);

  // Map each checkpoint to SVG (x, y) coordinates
  const points = useMemo(() => {
    if (!checkpoints || checkpoints.length === 0) return [];
    return checkpoints.map((cp) => {
      const dist = Math.min(cp.cumulative_distance_miles || 0, totalDistance);
      const x = padLeft + (dist / totalDistance) * plotWidth;
      const riskLevel = cp.risk?.overall_risk || 'Low';
      const score = RISK_SCORE_MAP[riskLevel] !== undefined ? RISK_SCORE_MAP[riskLevel] : 0;
      // Invert Y so 0 (Low) is at bottom and 4 (No Travel) is at top
      const y = padTop + plotHeight - (score / 4) * plotHeight;
      return {
        ...cp,
        x,
        y,
        riskLevel,
        score,
        color: RISK_COLOR_MAP[riskLevel] || '#10B981',
      };
    });
  }, [checkpoints, totalDistance, plotWidth, plotHeight, padLeft, padTop]);

  // Construct SVG Path
  const linePath = useMemo(() => {
    if (points.length === 0) return '';
    return points.reduce((acc, pt, i) => {
      return i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
    }, '');
  }, [points]);

  // Construct SVG Area Path (underneath curve)
  const areaPath = useMemo(() => {
    if (points.length === 0) return '';
    const firstX = points[0].x;
    const lastX = points[points.length - 1].x;
    const bottomY = padTop + plotHeight;
    return `${linePath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  }, [points, linePath, padTop, plotHeight]);

  // Active point for vertical indicator line & tooltip
  const activePoint = useMemo(() => {
    if (!activeCheckpoint) return null;
    return points.find((p) => p.index === activeCheckpoint.index) || null;
  }, [points, activeCheckpoint]);

  const yLabels = [
    { label: 'No Travel', score: 4 },
    { label: 'Severe', score: 3 },
    { label: 'High', score: 2 },
    { label: 'Moderate', score: 1 },
    { label: 'Low', score: 0 },
  ];

  // X-axis tick markers (e.g. 0, 100, 200, 300, 400, 500, 600, 700, total)
  const xTicks = useMemo(() => {
    const ticks = [0];
    const step = totalDistance > 500 ? 100 : totalDistance > 200 ? 50 : 25;
    for (let d = step; d < totalDistance; d += step) {
      ticks.push(d);
    }
    ticks.push(Math.round(totalDistance));
    return ticks;
  }, [totalDistance]);

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-4 flex flex-col justify-between h-full">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-600" />
            <div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Route Risk Timeline
              </h4>
              <p className="text-[10px] text-slate-400">
                Illustrative risk profile by distance along the route
              </p>
            </div>
          </div>
        </div>

        {/* SVG Chart Container */}
        <div className="relative w-full overflow-hidden select-none">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-auto overflow-visible"
          >
            <defs>
              <linearGradient id="timelineRiskGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#F97316" stopOpacity="0.3" />
                <stop offset="60%" stopColor="#F59E0B" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#10B981" stopOpacity="0.03" />
              </linearGradient>
            </defs>

            {/* Horizontal Gridlines & Y-Axis Labels */}
            {yLabels.map(({ label, score }) => {
              const y = padTop + plotHeight - (score / 4) * plotHeight;
              return (
                <g key={score}>
                  <line
                    x1={padLeft}
                    y1={y}
                    x2={padLeft + plotWidth}
                    y2={y}
                    stroke="#F1F5F9"
                    strokeWidth="1"
                    strokeDasharray={score > 0 ? '3, 3' : undefined}
                  />
                  <text
                    x={padLeft - 6}
                    y={y + 3}
                    textAnchor="end"
                    className="text-[8.5px] fill-slate-400 font-sans"
                  >
                    {label}
                  </text>
                </g>
              );
            })}

            {/* X-Axis Ticks */}
            {xTicks.map((tickVal) => {
              const x = padLeft + (tickVal / totalDistance) * plotWidth;
              return (
                <g key={tickVal}>
                  <line
                    x1={x}
                    y1={padTop + plotHeight}
                    x2={x}
                    y2={padTop + plotHeight + 4}
                    stroke="#CBD5E1"
                    strokeWidth="1"
                  />
                  <text
                    x={x}
                    y={padTop + plotHeight + 14}
                    textAnchor="middle"
                    className="text-[8.5px] fill-slate-400 font-mono"
                  >
                    {tickVal}
                  </text>
                </g>
              );
            })}

            {/* Area Fill */}
            {areaPath && (
              <path d={areaPath} fill="url(#timelineRiskGradient)" />
            )}

            {/* Primary Risk Curve Line */}
            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke="#F97316"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Active Vertical Guideline */}
            {activePoint && (
              <line
                x1={activePoint.x}
                y1={padTop}
                x2={activePoint.x}
                y2={padTop + plotHeight}
                stroke="#2563EB"
                strokeWidth="1.5"
                strokeDasharray="3, 3"
              />
            )}

            {/* Interactive Checkpoint Dots */}
            {points.map((pt) => {
              const isSelected = activePoint && activePoint.index === pt.index;
              return (
                <g
                  key={pt.index}
                  className="cursor-pointer"
                  onClick={() => onSelectCheckpoint && onSelectCheckpoint(pt.index)}
                  onMouseEnter={() => setHoveredCpIndex(pt.index)}
                  onMouseLeave={() => setHoveredCpIndex(null)}
                >
                  {/* Invisible enlarged hit target for easy tapping */}
                  <circle cx={pt.x} cy={pt.y} r={12} fill="transparent" />

                  {/* Visual Circle */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isSelected ? 5.5 : 3.5}
                    fill={pt.color}
                    stroke="white"
                    strokeWidth={isSelected ? 2 : 1.5}
                  />
                </g>
              );
            })}
          </svg>

          {/* Floating Tooltip Box over Active Point */}
          {activePoint && (
            <div
              className="absolute z-20 pointer-events-none transform -translate-x-1/2 -translate-y-full"
              style={{
                left: `${(activePoint.x / svgWidth) * 100}%`,
                top: `${(activePoint.y / svgHeight) * 100 - 4}%`,
              }}
            >
              <div className="bg-white/95 backdrop-blur-xs border border-slate-200/90 shadow-md px-2 py-1 rounded-md text-center text-[10px] whitespace-nowrap">
                <span className="font-bold text-slate-800 block text-[10.5px]">
                  Checkpoint {activePoint.index}
                </span>
                <span className="text-slate-500 font-mono text-[9.5px]">
                  {Math.round(activePoint.cumulative_distance_miles)} mi &bull;{' '}
                  <strong style={{ color: activePoint.color }}>
                    {activePoint.riskLevel} Risk
                  </strong>
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Segmented Mileage Breakdown Bar (Underneath Timeline) */}
      <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-1.5">
        <div className="w-full h-2 rounded-full overflow-hidden flex bg-slate-100 border border-slate-100">
          {pctSevere > 0 && (
            <div
              style={{ width: `${pctSevere}%` }}
              className="bg-[#EF4444] h-full"
              title={`${severeMiles} mi Severe`}
            />
          )}
          {pctHigh > 0 && (
            <div
              style={{ width: `${pctHigh}%` }}
              className="bg-[#F97316] h-full"
              title={`${highMiles} mi High`}
            />
          )}
          {pctModLow > 0 && (
            <div
              style={{ width: `${pctModLow}%` }}
              className="bg-[#10B981] h-full"
              title={`${modLowMiles} mi Moderate/Low`}
            />
          )}
        </div>

        <div className="flex items-center justify-between text-[10px] font-semibold text-slate-600 px-0.5">
          <span className="text-red-600 font-bold">{severeMiles} mi Severe</span>
          <span className="text-orange-600 font-bold">{highMiles} mi High</span>
          <span className="text-emerald-700 font-bold">{modLowMiles} mi Moderate/Low</span>
        </div>
      </div>
    </div>
  );
}
