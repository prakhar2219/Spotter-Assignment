import React from 'react';
import { ShieldAlert, Wind, CloudRain, CloudSnow, Info } from 'lucide-react';

export const RISK_LEVELS = {
  'Low': {
    color: '#10b981',
    bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-500',
    score: 0,
    label: 'Low Risk',
    desc: 'Wind <25 mph, Rain <0.10 in/hr, Snow <0.5 in/hr',
  },
  'Moderate': {
    color: '#0284c7',
    bg: 'bg-sky-50 text-sky-800 border-sky-200',
    dot: 'bg-sky-500',
    score: 1,
    label: 'Moderate',
    desc: 'Wind 25–34 mph, Rain 0.10–0.25 in/hr, Snow 0.5–1.0 in/hr',
  },
  'High': {
    color: '#f59e0b',
    bg: 'bg-amber-50 text-amber-800 border-amber-200',
    dot: 'bg-amber-500',
    score: 2,
    label: 'High Risk',
    desc: 'Wind 35–44 mph (≤40k lb), Rain 0.25–0.50 in/hr, Snow 1.0–2.0 in/hr',
  },
  'Severe': {
    color: '#f97316',
    bg: 'bg-orange-50 text-orange-900 border-orange-300',
    dot: 'bg-orange-500',
    score: 3,
    label: 'Severe Risk',
    desc: 'Wind 45–54 mph (≤30k lb) or 35–44 mph (>40k lb), Rain 0.50–1.00 in/hr, Snow 2.0–3.0 in/hr',
  },
  'No Travel': {
    color: '#e11d48',
    bg: 'bg-rose-100 text-rose-900 border-rose-300 font-bold',
    dot: 'bg-rose-600',
    score: 4,
    label: 'NO TRAVEL',
    desc: 'Wind ≥55 mph (any load), 45–54 mph (>30k lb), Rain >1.00 in/hr, Snow >3.0 in/hr',
  },
};

export default function RiskLegend({ compact = false }) {
  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
        <span className="font-semibold text-slate-700">Risk Scale:</span>
        {Object.entries(RISK_LEVELS).map(([level, info]) => (
          <span key={level} className="inline-flex items-center gap-1.5 font-medium">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: info.color }} />
            {level} ({info.score})
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm text-xs space-y-3">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-slate-500" />
          <h4 className="font-bold text-slate-900">Safety Risk Classification & Load Rules</h4>
        </div>
        <span className="text-[11px] font-mono text-slate-500">Spotter Specification</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
        {Object.entries(RISK_LEVELS).map(([level, info]) => (
          <div key={level} className={`p-2.5 rounded-lg border ${info.bg} flex flex-col justify-between`}>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold">{level}</span>
                <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-white/70">Score: {info.score}</span>
              </div>
              <p className="text-[10px] leading-snug opacity-90">{info.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
        <p className="font-semibold text-slate-800 flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
          Load-Dependent Safety Thresholds:
        </p>
        <ul className="list-disc list-inside space-y-0.5 text-slate-600 text-[10.5px]">
          <li><strong>Wind &ge; 55 mph:</strong> Instant No Travel for all truck gross weights.</li>
          <li><strong>Wind 45–54 mph:</strong> No Travel if cargo load &gt; 30,000 lb (elevated from Severe).</li>
          <li><strong>Wind 35–44 mph:</strong> Severe risk if cargo load &gt; 40,000 lb (elevated from High).</li>
        </ul>
      </div>
    </div>
  );
}
