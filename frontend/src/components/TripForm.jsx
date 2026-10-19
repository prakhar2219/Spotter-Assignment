import React from 'react';
import { MapPin, Navigation, Calendar, Weight, RefreshCw, ArrowLeftRight, Settings2, Truck } from 'lucide-react';

export default function TripForm({
  origin,
  setOrigin,
  destination,
  setDestination,
  departureTime,
  setDepartureTime,
  loadWeightLb,
  setLoadWeightLb,
  samplingIntervalMiles,
  setSamplingIntervalMiles,
  provider,
  setProvider,
  onSubmit,
  loading = false,
}) {
  const handleSwap = () => {
    const temp = origin;
    setOrigin(destination);
    setDestination(temp);
  };

  const handleWeightPreset = (preset) => {
    setLoadWeightLb(preset);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <Truck className="w-4 h-4 text-teal-600" />
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Trip & Cargo Dispatch Parameters
          </h3>
        </div>
        <span className="text-[11px] font-mono text-slate-500">Live Weather-Aware Routing</span>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        {/* Origin and Destination with Swap */}
        <div className="space-y-2.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Origin Location
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-emerald-600 absolute left-3 top-2.5" />
              <input
                type="text"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="e.g. Philadelphia, PA"
                required
                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white font-medium text-slate-900"
              />
            </div>
          </div>

          <div className="flex justify-center -my-1">
            <button
              type="button"
              onClick={handleSwap}
              className="p-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
              title="Swap origin and destination"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Destination Location
            </label>
            <div className="relative">
              <Navigation className="w-4 h-4 text-rose-600 absolute left-3 top-2.5" />
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="e.g. Baltimore, MD"
                required
                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white font-medium text-slate-900"
              />
            </div>
          </div>
        </div>

        {/* Departure Time & Timezone */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-semibold text-slate-700">
              Departure Date & Time
            </label>
            <span className="text-[10.5px] font-mono text-slate-400">Timezone-aware</span>
          </div>
          <div className="relative">
            <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="datetime-local"
              value={departureTime}
              onChange={(e) => setDepartureTime(e.target.value)}
              required
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white font-medium text-slate-900"
            />
          </div>
        </div>

        {/* Truck Cargo Load Weight with Presets */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-semibold text-slate-700">
              Truck Cargo Load Weight (lb)
            </label>
            <div className="flex gap-1.5 text-[10px]">
              <button
                type="button"
                onClick={() => handleWeightPreset(15000)}
                className={`px-1.5 py-0.5 rounded border transition ${
                  loadWeightLb === 15000 ? 'bg-teal-50 text-teal-800 border-teal-300 font-bold' : 'bg-slate-50 text-slate-600 border-slate-200'
                }`}
              >
                15k (Light)
              </button>
              <button
                type="button"
                onClick={() => handleWeightPreset(35000)}
                className={`px-1.5 py-0.5 rounded border transition ${
                  loadWeightLb === 35000 ? 'bg-amber-50 text-amber-800 border-amber-300 font-bold' : 'bg-slate-50 text-slate-600 border-slate-200'
                }`}
              >
                35k (&gt;30k rule)
              </button>
              <button
                type="button"
                onClick={() => handleWeightPreset(45000)}
                className={`px-1.5 py-0.5 rounded border transition ${
                  loadWeightLb === 45000 ? 'bg-rose-50 text-rose-800 border-rose-300 font-bold' : 'bg-slate-50 text-slate-600 border-slate-200'
                }`}
              >
                45k (&gt;40k rule)
              </button>
            </div>
          </div>
          <div className="relative">
            <Weight className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="number"
              value={loadWeightLb}
              onChange={(e) => setLoadWeightLb(parseFloat(e.target.value) || 0)}
              min="0"
              step="500"
              required
              className="w-full pl-9 pr-10 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white font-mono font-medium text-slate-900"
            />
            <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-medium">lb</span>
          </div>
        </div>

        {/* Sampling Interval Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Checkpoint Sampling Interval
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[10, 25, 50].map((interval) => (
              <button
                key={interval}
                type="button"
                onClick={() => setSamplingIntervalMiles(interval)}
                className={`py-1.5 text-xs rounded-lg font-semibold transition border ${
                  samplingIntervalMiles === interval
                    ? 'bg-teal-700 text-white border-teal-700 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {interval} miles
              </button>
            ))}
          </div>
        </div>

        {/* Routing Provider Selection */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-500 flex items-center gap-1.5">
            <Settings2 className="w-3.5 h-3.5" /> Provider:
          </span>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="px-2 py-1 text-xs rounded border border-slate-200 bg-white text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-teal-500"
          >
            <option value="osrm">OSRM (OpenStreetMap)</option>
            <option value="openrouteservice">OpenRouteService</option>
            <option value="mapbox">Mapbox</option>
          </select>
        </div>

        {/* Action Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 px-4 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition disabled:opacity-50 shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Evaluating Corridor...' : 'Plan Safe Route'}
        </button>
      </form>
    </div>
  );
}
