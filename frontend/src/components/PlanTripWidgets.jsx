import React from 'react';
import {
  Settings,
  BarChart2,
  Info,
  MapPin,
  Cloud,
  ShieldAlert,
  Award,
  ArrowRight,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  RotateCcw,
  Edit2,
  Truck,
  Calendar,
  Clock,
} from 'lucide-react';

/**
 * Clean Truck Highway Banner matching plan_trip page.png
 */
export function TruckBanner() {
  return (
    <div className="rounded-xl overflow-hidden border border-slate-200/90 shadow-2xs bg-slate-900 w-full relative h-[195px] sm:h-[210px] shrink-0">
      <img
        src="/truck_banner.jpg"
        alt="Commercial semi-truck on interstate highway"
        className="w-full h-full object-cover object-[center_60%]"
      />
    </div>
  );
}

/**
 * How It Works Card
 */
export function HowItWorksCard() {
  const steps = [
    {
      num: 1,
      title: 'Find Routes',
      desc: 'Generate up to 3 alternative routes',
      icon: MapPin,
    },
    {
      num: 2,
      title: 'Check Weather',
      desc: 'Analyze forecast at key checkpoints',
      icon: Cloud,
    },
    {
      num: 3,
      title: 'Assess Risk',
      desc: 'Apply weather and load-based rules',
      icon: ShieldAlert,
    },
    {
      num: 4,
      title: 'Recommend',
      desc: 'Select the safest eligible route',
      icon: Award,
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 p-3 sm:p-3.5 shadow-2xs">
      <div className="flex items-center gap-1.5 text-slate-900 border-b border-slate-100 pb-2 mb-2">
        <Settings className="w-3.5 h-3.5 text-teal-600" />
        <h3 className="text-xs font-bold uppercase tracking-wider">How It Works</h3>
      </div>

      <div className="grid grid-cols-4 gap-1.5 relative">
        {steps.map((st, i) => {
          const Icon = st.icon;
          return (
            <div key={st.num} className="flex flex-col items-center text-center relative px-0.5">
              <div className="w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center text-[10px] font-bold mb-1 shadow-2xs">
                {st.num}
              </div>
              <div className="w-6 h-6 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center mb-1">
                <Icon className="w-3.5 h-3.5" />
              </div>
              <h4 className="text-[11px] font-bold text-slate-900 leading-tight">{st.title}</h4>
              <p className="text-[9.5px] text-slate-500 mt-0.5 leading-snug">{st.desc}</p>

              {/* Arrow connector */}
              {i < steps.length - 1 && (
                <div className="hidden sm:block absolute top-2 -right-1 text-slate-300">
                  <ArrowRight className="w-2.5 h-2.5" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Weather Risk Levels Card (5 horizontally displayed cards)
 */
export function WeatherRiskLevelsCard() {
  const levels = [
    { key: 'Low', dot: 'bg-emerald-500', border: 'border-emerald-200', bg: 'bg-emerald-50/70', title: 'Low', sub: 'Normal conditions', impact: 'No significant risk' },
    { key: 'Moderate', dot: 'bg-amber-500', border: 'border-amber-200', bg: 'bg-amber-50/70', title: 'Moderate', sub: 'Some caution', impact: 'recommended' },
    { key: 'High', dot: 'bg-orange-500', border: 'border-orange-200', bg: 'bg-orange-50/70', title: 'High', sub: 'Increased risk', impact: 'Use caution' },
    { key: 'Severe', dot: 'bg-red-500', border: 'border-red-200', bg: 'bg-red-50/70', title: 'Severe', sub: 'High risk conditions', impact: 'Consider alternate route' },
    { key: 'No Travel', dot: 'bg-rose-600', border: 'border-rose-300', bg: 'bg-rose-50/70', title: 'No Travel', sub: 'Unsafe conditions', impact: 'Do not travel' },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 p-3 sm:p-3.5 shadow-2xs">
      <div className="flex items-center gap-1.5 text-slate-900 border-b border-slate-100 pb-2 mb-2">
        <BarChart2 className="w-3.5 h-3.5 text-teal-600" />
        <h3 className="text-xs font-bold uppercase tracking-wider">Weather Risk Levels</h3>
      </div>

      <div className="grid grid-cols-5 gap-1.5">
        {levels.map((lvl) => (
          <div
            key={lvl.key}
            className={`rounded-lg border ${lvl.border} ${lvl.bg} p-2 flex flex-col justify-between min-h-[64px]`}
          >
            <div>
              <div className="flex items-center gap-1 mb-0.5">
                <span className={`w-1.5 h-1.5 rounded-full ${lvl.dot}`} />
                <span className="text-[10.5px] font-bold text-slate-900">{lvl.title}</span>
              </div>
              <p className="text-[9.5px] font-medium text-slate-600 leading-tight">{lvl.sub}</p>
            </div>
            <p className="text-[9px] text-slate-500 mt-1 font-normal leading-tight">{lvl.impact}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Important Notes Card
 */
export function ImportantNotesCard() {
  return (
    <div className="bg-[#EFF6FF] border border-[#BFDBFE]/60 rounded-xl p-3 sm:p-3.5 shadow-2xs text-slate-700">
      <div className="flex items-center gap-1.5 text-blue-900 mb-1.5">
        <Info className="w-3.5 h-3.5 text-blue-600 shrink-0" />
        <h4 className="text-xs font-bold">Important Notes</h4>
      </div>
      <ul className="text-[10.5px] space-y-1 text-slate-600 list-disc list-inside leading-snug pl-0.5">
        <li>Weather forecasts are based on estimated arrival times at checkpoints.</li>
        <li>A route with any &quot;No Travel&quot; checkpoint will be marked as ineligible.</li>
        <li>Results are provided for planning purposes only. Always use professional judgment.</li>
      </ul>
    </div>
  );
}

/**
 * State 4: Loading / Processing Card
 */
export function ProcessingStateCard({ activeStep = 2 }) {
  const steps = [
    {
      num: 1,
      title: 'Finding routes',
      desc: 'Retrieving alternative routes...',
    },
    {
      num: 2,
      title: 'Checking weather',
      desc: 'Analyzing forecast at checkpoints...',
    },
    {
      num: 3,
      title: 'Assessing risk',
      desc: 'Applying weather and load-based rules...',
    },
    {
      num: 4,
      title: 'Finalizing results',
      desc: 'Almost done...',
    },
  ];

  return (
    <div className="space-y-4 py-2">
      <div className="text-center space-y-1">
        <h3 className="text-lg font-bold text-slate-900">Planning Your Trip</h3>
        <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
          This may take a few moments while we find the best routes and analyze weather conditions.
        </p>
      </div>

      <div className="max-w-sm mx-auto space-y-3 py-1">
        {steps.map((st) => {
          const isDone = st.num < activeStep;
          const isActive = st.num === activeStep;

          return (
            <div key={st.num} className="flex items-center gap-3">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-colors ${
                  isDone
                    ? 'bg-teal-600 text-white'
                    : isActive
                    ? 'border-2 border-teal-600 text-teal-600 bg-teal-50 animate-pulse'
                    : 'border border-slate-300 text-slate-400 bg-slate-50'
                }`}
              >
                {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : st.num}
              </div>
              <div className="flex-1">
                <div className="text-xs font-bold text-slate-900">{st.title}</div>
                <div className="text-[10px] text-slate-500">{st.desc}</div>
              </div>
              {isActive && (
                <Loader2 className="w-3.5 h-3.5 text-teal-600 animate-spin shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      <div className="p-2.5 bg-blue-50/70 border border-blue-200/80 rounded-lg flex items-center gap-2 text-xs text-blue-900 max-w-sm mx-auto">
        <Info className="w-3.5 h-3.5 text-blue-600 shrink-0" />
        <span className="text-[10.5px]">
          Please keep this window open. We&apos;re analyzing real-time data to provide the most accurate results.
        </span>
      </div>
    </div>
  );
}

/**
 * State 5: Sample Submitted (Preview Summary) Card
 */
export function SubmittedSummaryCard({
  tripData,
  onEdit,
  onViewComparison,
}) {
  return (
    <div className="space-y-3">
      {/* Green Success Banner */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-start gap-2.5">
        <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5">
          <CheckCircle2 className="w-3.5 h-3.5" />
        </div>
        <div>
          <h4 className="text-xs font-bold text-emerald-900">Trip details submitted successfully!</h4>
          <p className="text-[10.5px] text-emerald-700 mt-0.5">
            We&apos;re generating routes and analyzing weather conditions.
          </p>
        </div>
      </div>

      {/* Trip Summary Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-1.5">
            <Truck className="w-3.5 h-3.5 text-teal-600" />
            <h3 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider">
              Trip Summary
            </h3>
          </div>
          <button
            type="button"
            onClick={onEdit}
            className="text-[11px] font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Edit2 className="w-3 h-3" />
            <span>Edit</span>
          </button>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between py-0.5 border-b border-slate-50">
            <span className="text-slate-500 flex items-center gap-1 text-[11px]">
              <MapPin className="w-3 h-3 text-slate-400" /> Origin
            </span>
            <span className="font-semibold text-slate-900 text-xs">{tripData.origin}</span>
          </div>
          <div className="flex items-center justify-between py-0.5 border-b border-slate-50">
            <span className="text-slate-500 flex items-center gap-1 text-[11px]">
              <MapPin className="w-3 h-3 text-slate-400" /> Destination
            </span>
            <span className="font-semibold text-slate-900 text-xs">{tripData.destination}</span>
          </div>
          <div className="flex items-center justify-between py-0.5 border-b border-slate-50">
            <span className="text-slate-500 flex items-center gap-1 text-[11px]">
              <Clock className="w-3 h-3 text-slate-400" /> Departure
            </span>
            <span className="font-semibold text-slate-900 text-xs">{tripData.departureTimeFormatted || tripData.departureTime}</span>
          </div>
          <div className="flex items-center justify-between py-0.5 border-b border-slate-50">
            <span className="text-slate-500 flex items-center gap-1 text-[11px]">
              <Truck className="w-3 h-3 text-slate-400" /> Truck Load Weight
            </span>
            <span className="font-semibold text-slate-900 text-xs">
              {Number(tripData.loadWeightLb).toLocaleString()} lb
            </span>
          </div>
          <div className="flex items-center justify-between py-0.5">
            <span className="text-slate-500 flex items-center gap-1 text-[11px]">
              <Calendar className="w-3 h-3 text-slate-400" /> Checkpoint Interval
            </span>
            <span className="font-semibold text-slate-900 text-xs">
              {tripData.samplingIntervalMiles} miles
            </span>
          </div>
        </div>

        {/* Redirecting bar & Action Button */}
        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <Loader2 className="w-3 h-3 text-teal-600 animate-spin" />
            <span>Redirecting to route comparison...</span>
          </div>
          <button
            type="button"
            onClick={onViewComparison}
            className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-[11px] font-semibold shadow-2xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
          >
            <span>View Route Comparison</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * State 6: API Error Card
 */
export function ApiErrorCard({ error, onRetry, onBackToForm }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
      {/* Alert Header */}
      <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5">
        <div className="w-7 h-7 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-4 h-4 text-red-600" />
        </div>
        <div>
          <h3 className="text-xs font-bold text-red-900">Unable to Plan Route</h3>
          <p className="text-[11px] text-red-700 mt-0.5 leading-relaxed">
            {error ||
              "We couldn't retrieve routes at this time. This may be due to a temporary issue with the routing or weather service."}
          </p>
        </div>
      </div>

      {/* Helpful Checklist */}
      <div className="space-y-1.5">
        <h4 className="text-[11px] font-bold text-slate-900">What you can do:</h4>
        <ul className="text-[10.5px] text-slate-600 space-y-1 list-disc list-inside">
          <li>Check your internet connection</li>
          <li>Verify the origin and destination locations</li>
          <li>Try again in a few minutes</li>
          <li>If the issue persists, please contact support</li>
        </ul>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={onRetry}
          className="flex-1 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Try Again</span>
        </button>
        <button
          type="button"
          onClick={onBackToForm}
          className="flex-1 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
        >
          <span>Back to Form</span>
        </button>
      </div>
    </div>
  );
}
