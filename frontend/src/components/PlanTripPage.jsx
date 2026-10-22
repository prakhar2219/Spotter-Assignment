import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Truck,
  Calendar,
  Clock,
  ArrowRight,
  ChevronDown,
} from 'lucide-react';
import AutocompleteInput from './AutocompleteInput';
import {
  TruckBanner,
  HowItWorksCard,
  WeatherRiskLevelsCard,
  ImportantNotesCard,
  ProcessingStateCard,
  SubmittedSummaryCard,
  ApiErrorCard,
} from './PlanTripWidgets';

const COMMON_TIMEZONES = [
  { value: 'America/Chicago', label: 'America/Chicago (CDT)', offset: '-05:00' },
  { value: 'America/New_York', label: 'America/New_York (EDT)', offset: '-04:00' },
  { value: 'America/Denver', label: 'America/Denver (MDT)', offset: '-06:00' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PDT)', offset: '-07:00' },
  { value: 'UTC', label: 'UTC (+00:00)', offset: '+00:00' },
];

export default function PlanTripPage({
  origin,
  setOrigin,
  destination,
  setDestination,
  departureDate,
  setDepartureDate,
  departureTime,
  setDepartureTime,
  timezone,
  setTimezone,
  loadWeightLb,
  setLoadWeightLb,
  samplingIntervalMiles,
  setSamplingIntervalMiles,
  onSubmit,
  loading = false,
  apiError = null,
  planResult = null,
  onViewComparison,
  onRetry,
}) {
  // Page UI state: 'form' | 'loading' | 'submitted' | 'error'
  const [uiState, setUiState] = useState('form');
  const [errors, setErrors] = useState({});
  const [processingStep, setProcessingStep] = useState(1);

  // Sync external loading / error / result props to UI state
  useEffect(() => {
    if (loading) {
      setUiState('loading');
    } else if (apiError) {
      setUiState('error');
    } else if (planResult && uiState === 'loading') {
      setUiState('submitted');
    }
  }, [loading, apiError, planResult, uiState]);

  // Simulate progress step ticker while loading
  useEffect(() => {
    let interval;
    if (uiState === 'loading') {
      setProcessingStep(1);
      interval = setInterval(() => {
        setProcessingStep((prev) => (prev < 4 ? prev + 1 : prev));
      }, 700);
    }
    return () => clearInterval(interval);
  }, [uiState]);

  // Validate form fields
  const validateForm = () => {
    const newErrors = {};

    if (!origin || !origin.trim()) {
      newErrors.origin = 'Origin is required.';
    }

    if (!destination || !destination.trim()) {
      newErrors.destination = 'Destination is required.';
    }

    if (!departureDate || !departureTime) {
      newErrors.departure = 'Select a valid date and time.';
    }

    if (loadWeightLb === '' || isNaN(Number(loadWeightLb)) || Number(loadWeightLb) <= 0) {
      newErrors.loadWeight = 'Load weight must be a positive number.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFormSubmit = (e) => {
    if (e) e.preventDefault();
    if (!validateForm()) {
      return;
    }
    setErrors({});
    onSubmit();
  };

  const handleBackToForm = () => {
    setUiState('form');
  };

  // Formatted date string for summary
  const getFormattedDeparture = () => {
    try {
      if (!departureDate || !departureTime) return '';
      const [year, month, day] = departureDate.split('-');
      const d = new Date(year, month - 1, day);
      const datePart = d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      const tzObj = COMMON_TIMEZONES.find((t) => t.value === timezone);
      const tzLabel = tzObj ? tzObj.label.match(/\((.*?)\)/)?.[1] || tzObj.value : timezone;
      return `${datePart}, ${departureTime} (${tzLabel})`;
    } catch {
      return `${departureDate} ${departureTime}`;
    }
  };

  return (
    <div className="min-h-full flex flex-col max-w-7xl mx-auto px-4 sm:px-6 pt-2 pb-[15px] select-none justify-between">
      {/* Main 2-Column Layout: Balanced 50/50 split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch flex-1">
        {/* Left Column (Title Header + Main Form or State Cards) - Equal 50% width */}
        <div className="flex flex-col h-full justify-between space-y-2">
          {/* Page Title Header */}
          <div className="shrink-0">
            <span className="text-[10px] font-bold text-teal-600 uppercase tracking-wider block">
              Plan Trip
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight leading-tight">
              Plan Your Route
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Get the safest and most efficient route using real-time weather forecasts.
            </p>
          </div>

          {uiState === 'loading' ? (
            <div className="bg-white rounded-xl border border-slate-200/90 p-6 shadow-2xs flex-1 flex flex-col justify-center">
              <ProcessingStateCard activeStep={processingStep} />
            </div>
          ) : uiState === 'submitted' ? (
            <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs flex-1 flex flex-col justify-between">
              <SubmittedSummaryCard
                tripData={{
                  origin,
                  destination,
                  departureTimeFormatted: getFormattedDeparture(),
                  loadWeightLb,
                  samplingIntervalMiles,
                }}
                onEdit={handleBackToForm}
                onViewComparison={onViewComparison}
              />
            </div>
          ) : uiState === 'error' ? (
            <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs flex-1 flex flex-col justify-center">
              <ApiErrorCard
                error={apiError}
                onRetry={() => {
                  if (onRetry) onRetry();
                  else handleFormSubmit();
                }}
                onBackToForm={handleBackToForm}
              />
            </div>
          ) : (
            /* State 1 / State 2 / State 3: Interactive Trip Information Form */
            <div className="bg-white rounded-xl border border-slate-200/90 p-4 sm:p-5 shadow-2xs flex-1 flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-slate-900 border-b border-slate-100 pb-2 mb-2.5">
                <MapPin className="w-3.5 h-3.5 text-teal-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Trip Information
                </h3>
              </div>

              <form onSubmit={handleFormSubmit} className="space-y-3 flex-1 flex flex-col justify-between" noValidate>

                {/* Origin Location */}
                <AutocompleteInput
                  id="origin-input"
                  label="Origin"
                  required
                  value={origin}
                  onChange={(val) => {
                    setOrigin(val);
                    if (errors.origin) setErrors((prev) => ({ ...prev, origin: null }));
                  }}
                  error={errors.origin}
                  placeholder="Enter a city, address, or landmark"
                  iconColor="text-teal-600"
                />

                {/* Destination Location */}
                <AutocompleteInput
                  id="destination-input"
                  label="Destination"
                  required
                  value={destination}
                  onChange={(val) => {
                    setDestination(val);
                    if (errors.destination) setErrors((prev) => ({ ...prev, destination: null }));
                  }}
                  error={errors.destination}
                  placeholder="Enter a city, address, or landmark"
                  iconColor="text-rose-600"
                />

                {/* Departure Date and Time */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                    Departure Date and Time <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {/* Date Picker */}
                    <div className="relative">
                      <Calendar
                        className={`w-3.5 h-3.5 absolute left-2.5 top-2 pointer-events-none ${
                          errors.departure ? 'text-red-500' : 'text-slate-400'
                        }`}
                      />
                      <input
                        type="date"
                        value={departureDate}
                        onChange={(e) => {
                          setDepartureDate(e.target.value);
                          if (errors.departure)
                            setErrors((prev) => ({ ...prev, departure: null }));
                        }}
                        className={`w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border font-medium text-slate-900 focus:outline-none focus:ring-1.5 ${
                          errors.departure
                            ? 'border-red-400 bg-red-50/20 focus:ring-red-400'
                            : 'border-slate-300 focus:ring-teal-500 bg-white'
                        }`}
                      />
                    </div>

                    {/* Time Picker */}
                    <div className="relative">
                      <Clock
                        className={`w-3.5 h-3.5 absolute left-2.5 top-2 pointer-events-none ${
                          errors.departure ? 'text-red-500' : 'text-slate-400'
                        }`}
                      />
                      <input
                        type="time"
                        value={departureTime}
                        onChange={(e) => {
                          setDepartureTime(e.target.value);
                          if (errors.departure)
                            setErrors((prev) => ({ ...prev, departure: null }));
                        }}
                        className={`w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border font-medium text-slate-900 focus:outline-none focus:ring-1.5 ${
                          errors.departure
                            ? 'border-red-400 bg-red-50/20 focus:ring-red-400'
                            : 'border-slate-300 focus:ring-teal-500 bg-white'
                        }`}
                      />
                    </div>
                  </div>

                  {errors.departure && (
                    <p className="text-[10px] font-medium text-red-600 mt-0.5">
                      {errors.departure}
                    </p>
                  )}

                  {/* Timezone Selector */}
                  <div className="mt-1 flex items-center gap-1 text-[10.5px] text-slate-500">
                    <span>Timezone:</span>
                    <div className="relative inline-block">
                      <select
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                        className="appearance-none bg-transparent pr-4 text-[10.5px] font-semibold text-slate-700 hover:text-teal-600 focus:outline-none cursor-pointer"
                      >
                        {COMMON_TIMEZONES.map((tz) => (
                          <option key={tz.value} value={tz.value}>
                            {tz.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-2.5 h-2.5 text-slate-400 absolute right-0 top-1 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* Truck Load Weight */}
                <div>
                  <label
                    htmlFor="truck-load-weight"
                    className="block text-[11px] font-semibold text-slate-700 mb-0.5"
                  >
                    Truck Load Weight <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Truck
                      className={`w-3.5 h-3.5 absolute left-2.5 top-2 pointer-events-none ${
                        errors.loadWeight ? 'text-red-500' : 'text-slate-400'
                      }`}
                    />
                    <input
                      id="truck-load-weight"
                      type="number"
                      value={loadWeightLb}
                      onChange={(e) => {
                        setLoadWeightLb(e.target.value);
                        if (errors.loadWeight)
                          setErrors((prev) => ({ ...prev, loadWeight: null }));
                      }}
                      placeholder="Enter weight"
                      className={`w-full pl-8 pr-9 py-1.5 text-xs rounded-lg border font-medium text-slate-900 focus:outline-none focus:ring-1.5 ${
                        errors.loadWeight
                          ? 'border-red-400 bg-red-50/20 focus:ring-red-400'
                          : 'border-slate-300 focus:ring-teal-500 bg-white'
                      }`}
                    />
                    <span className="absolute right-2.5 top-2 text-[11px] text-slate-500 font-medium pointer-events-none">
                      lb
                    </span>
                  </div>
                  {errors.loadWeight && (
                    <p className="text-[10px] font-medium text-red-600 mt-0.5">
                      {errors.loadWeight}
                    </p>
                  )}
                </div>

                {/* Weather Checkpoint Interval */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Weather Checkpoint Interval <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { val: 10, title: '10 miles', sub: 'More detail (higher accuracy)' },
                      { val: 25, title: '25 miles', sub: 'Balanced (recommended)' },
                      { val: 50, title: '50 miles', sub: 'Faster analysis (fewer checkpoints)' },
                    ].map((opt) => {
                      const isSelected = samplingIntervalMiles === opt.val;
                      return (
                        <button
                          key={opt.val}
                          type="button"
                          onClick={() => setSamplingIntervalMiles(opt.val)}
                          className={`p-2 rounded-lg border text-left transition-all cursor-pointer relative ${
                            isSelected
                              ? 'border-teal-500 bg-teal-50/40 shadow-xs ring-1 ring-teal-500'
                              : 'border-slate-200 hover:border-slate-300 bg-white'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <div
                              className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                                isSelected
                                  ? 'border-teal-600 bg-teal-600'
                                  : 'border-slate-300 bg-white'
                              }`}
                            >
                              {isSelected && (
                                <div className="w-1 h-1 rounded-full bg-white" />
                              )}
                            </div>
                            <span className="text-[11px] font-bold text-slate-900">
                              {opt.title}
                            </span>
                          </div>
                          <p className="text-[9px] text-slate-500 leading-tight pl-5">
                            {opt.sub}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Plan Route Submit Button */}
                <button
                  type="submit"
                  className="w-full mt-3 py-3 bg-[#0D9488] hover:bg-teal-700 active:bg-teal-800 text-white font-semibold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer group"
                >
                  <span>Plan Route</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Right Column (Truck Banner, How It Works, Risk Levels, Notes) - Equal 50% width */}
        <div className="flex flex-col h-full justify-between gap-2.5">
          <TruckBanner />
          <HowItWorksCard />
          <WeatherRiskLevelsCard />
          <ImportantNotesCard />
        </div>

      </div>
    </div>
  );
}
