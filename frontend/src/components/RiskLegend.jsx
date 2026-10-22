import React from 'react';
import { ShieldAlert, Info } from 'lucide-react';
import { RISK_LEVELS } from '../constants/risk';
export { RISK_LEVELS };

export default function RiskLegend({ compact = false }) {
  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
        <span className="font-semibold text-slate-700">Risk Scale:</span>
        {Object.entries(RISK_LEVELS).map(([level, info]) => (
          <span key={level} className="inline-flex items-center gap-1.5 font-medium">
            <span
              className="w-2.5 h-2.5 rounded-full inline-block"
              style={{
                backgroundColor: info.color,
                border: info.shape === 'dashed' ? '1px dashed #ffffff' : 'none',
              }}
            />
            {level} {info.score !== '—' ? `(${info.score})` : ''}
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

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {Object.entries(RISK_LEVELS).map(([level, info]) => (
          <div key={level} className={`p-2.5 rounded-lg border ${info.bg} flex flex-col justify-between`}>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold flex items-center gap-1 text-[11px]">
                  <span>{info.symbol}</span>
                  <span>{level}</span>
                </span>
                <span className="font-mono text-[9.5px] px-1 py-0.2 rounded bg-white/70">
                  {info.score !== '—' ? `Score: ${info.score}` : 'Unsafe'}
                </span>
              </div>
              <p className="text-[10px] leading-snug opacity-90">{info.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
        <p className="font-semibold text-slate-800 flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
          Load-Dependent Safety Thresholds & Accessible Symbols:
        </p>
        <ul className="list-disc list-inside space-y-0.5 text-slate-600 text-[10.5px]">
          <li><strong>Wind &ge; 55 mph:</strong> Instant No Travel for all truck gross weights.</li>
          <li><strong>Wind 45–54 mph:</strong> No Travel if cargo load &gt; 30,000 lb (elevated from Severe).</li>
          <li><strong>Wind 35–44 mph:</strong> Severe risk if cargo load &gt; 40,000 lb (elevated from High).</li>
          <li><strong>Shape Indicators:</strong> No Travel checkpoints use an <strong>Octagon (⛔)</strong> shape. Unknown data uses a <strong>Dashed (?)</strong> badge.</li>
        </ul>
      </div>
    </div>
  );
}
