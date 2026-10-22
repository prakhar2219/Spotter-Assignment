import React, { useState, useEffect, useRef } from 'react';
import { MapPin, X, Loader2 } from 'lucide-react';
import { fetchLocationSuggestions } from '../services/api';

export default function AutocompleteInput({
  label,
  required = false,
  value,
  onChange,
  onSelectSuggestion,
  placeholder = 'Enter a city, address, or landmark',
  error = null,
  iconColor = 'text-slate-400',
  id,
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load suggestions from backend or cache
  const loadSuggestions = async (queryStr) => {
    setLoading(true);
    try {
      const results = await fetchLocationSuggestions(queryStr, 5);
      setSuggestions(results);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  // Pre-load default suggestions on mount so they are instantly ready when clicking
  useEffect(() => {
    loadSuggestions(value || '');
  }, []);

  // Fetch suggestions with debounce when value changes
  useEffect(() => {
    const timer = setTimeout(() => {
      loadSuggestions(value || '');
    }, 180);

    return () => clearTimeout(timer);
  }, [value]);

  const handleFocusOrClick = () => {
    setIsOpen(true);
    if (!suggestions || suggestions.length === 0) {
      loadSuggestions(value || '');
    }
  };

  const handleSelect = (item) => {
    onChange(item.name);
    if (onSelectSuggestion) {
      onSelectSuggestion(item);
    }
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange('');
    loadSuggestions('');
    setIsOpen(true);
  };

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label
          htmlFor={id}
          className="block text-[11px] font-semibold text-slate-700 mb-0.5"
        >
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      <div className="relative">
        <MapPin
          className={`w-3.5 h-3.5 absolute left-2.5 top-2.5 pointer-events-none ${
            error ? 'text-red-500' : iconColor
          }`}
        />

        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={handleFocusOrClick}
          onClick={handleFocusOrClick}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setIsOpen(false);
            }
          }}
          placeholder={placeholder}
          autoComplete="off"
          className={`w-full pl-8 pr-8 py-2 text-xs rounded-lg border font-medium text-slate-900 transition-colors focus:outline-none focus:ring-1.5 ${
            error
              ? 'border-red-400 bg-red-50/20 focus:ring-red-400 focus:border-red-500'
              : 'border-slate-300 bg-white focus:ring-teal-500 focus:border-teal-500 hover:border-slate-400'
          }`}
        />

        {/* Clear Button or Spinner */}
        <div className="absolute right-2 top-2.5 flex items-center">
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />
          ) : value ? (
            <button
              type="button"
              onClick={handleClear}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded transition-colors cursor-pointer"
              title="Clear location"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Field-level error */}
      {error && (
        <p className="text-[10px] font-medium text-red-600 mt-0.5">{error}</p>
      )}

      {/* Autocomplete Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden divide-y divide-slate-100">
          <div className="px-3 py-1.5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <span>{value ? 'Suggestions' : 'Suggested Logistics Hubs'}</span>
            <span className="text-[9px] font-normal lowercase text-slate-400">click to select</span>
          </div>
          <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
            {suggestions.map((item, idx) => (
              <button
                key={`${item.name}-${idx}`}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(item);
                }}
                className="w-full px-3 py-2 text-left text-xs text-slate-800 hover:bg-teal-50/60 hover:text-teal-900 flex items-center justify-between gap-2 transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2.5 truncate">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 group-hover:text-teal-600 shrink-0 transition-colors" />
                  <span className="truncate font-medium text-slate-800 group-hover:text-teal-900">
                    {item.name}
                  </span>
                </div>
                {item.category && (
                  <span className="text-[9px] uppercase font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 group-hover:bg-teal-100 group-hover:text-teal-700 shrink-0 transition-colors">
                    {item.category}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
