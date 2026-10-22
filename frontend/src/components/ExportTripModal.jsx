import React, { useState } from 'react';
import { X, FileSpreadsheet, FileText, Download, Check } from 'lucide-react';
import { exportTrips } from '../services/api';

export default function ExportTripModal({
  isOpen,
  onClose,
  tripId = null,
  tripIds = [],
}) {
  const [format, setFormat] = useState('csv'); // 'csv' | 'pdf' | 'json'
  const [dateRange, setDateRange] = useState('3m');
  const [scope, setScope] = useState({
    include_summary: true,
    include_routes: true,
    include_checkpoints: true,
    include_weather: false,
  });
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState(null);

  if (!isOpen) return null;

  const handleCheckboxChange = (key) => {
    setScope((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleExport = async () => {
    setIsExporting(true);
    setExportError(null);

    const idsToExport = tripId ? [tripId] : tripIds;

    if (format === 'pdf') {
      setIsExporting(false);
      onClose();
      // Trigger browser's print dialog which allows saving as PDF
      window.print();
      return;
    }

    const result = await exportTrips({
      format,
      tripIds: idsToExport,
      scope,
    });

    setIsExporting(false);

    if (result.success) {
      onClose();
    } else {
      setExportError(result.error || 'Failed to export');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 select-none">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {tripId ? `Export Trip (${tripId})` : 'Export Trip History'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Select your export format and data requirements
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {exportError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
              {exportError}
            </div>
          )}

          {/* Export Format Radios */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              Export Format
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              <label
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium cursor-pointer transition-all ${
                  format === 'csv'
                    ? 'border-blue-600 bg-blue-50/50 text-blue-900 ring-2 ring-blue-500/20'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="format"
                  value="csv"
                  checked={format === 'csv'}
                  onChange={() => setFormat('csv')}
                  className="sr-only"
                />
                <FileSpreadsheet className={`w-5 h-5 mb-1.5 ${format === 'csv' ? 'text-blue-600' : 'text-slate-400'}`} />
                <span className="font-semibold">CSV</span>
                <span className="text-[10px] text-slate-400">Spreadsheet</span>
              </label>

              <label
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium cursor-pointer transition-all ${
                  format === 'pdf'
                    ? 'border-blue-600 bg-blue-50/50 text-blue-900 ring-2 ring-blue-500/20'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="format"
                  value="pdf"
                  checked={format === 'pdf'}
                  onChange={() => setFormat('pdf')}
                  className="sr-only"
                />
                <FileText className={`w-5 h-5 mb-1.5 ${format === 'pdf' ? 'text-blue-600' : 'text-slate-400'}`} />
                <span className="font-semibold">PDF</span>
                <span className="text-[10px] text-slate-400">Report</span>
              </label>

              <label
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium cursor-pointer transition-all ${
                  format === 'json'
                    ? 'border-blue-600 bg-blue-50/50 text-blue-900 ring-2 ring-blue-500/20'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="format"
                  value="json"
                  checked={format === 'json'}
                  onChange={() => setFormat('json')}
                  className="sr-only"
                />
                <Download className={`w-5 h-5 mb-1.5 ${format === 'json' ? 'text-blue-600' : 'text-slate-400'}`} />
                <span className="font-semibold">JSON</span>
                <span className="text-[10px] text-slate-400">Raw Data</span>
              </label>
            </div>
          </div>

          {/* Date Range Scope */}
          {!tripId && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Date Range
              </label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 bg-slate-50/50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="3m">Last 3 months</option>
                <option value="6m">Last 6 months</option>
                <option value="1y">Last 1 year</option>
                <option value="all">All Trips</option>
              </select>
            </div>
          )}

          {/* Include Fields Checkboxes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              Include Data
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <label className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={scope.include_summary}
                  onChange={() => handleCheckboxChange('include_summary')}
                  className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                />
                <span className="text-slate-700 font-medium">Trip Summary</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={scope.include_routes}
                  onChange={() => handleCheckboxChange('include_routes')}
                  className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                />
                <span className="text-slate-700 font-medium">Route Metrics</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={scope.include_checkpoints}
                  onChange={() => handleCheckboxChange('include_checkpoints')}
                  className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                />
                <span className="text-slate-700 font-medium">Checkpoint Details</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={scope.include_weather}
                  onChange={() => handleCheckboxChange('include_weather')}
                  className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                />
                <span className="text-slate-700 font-medium">Weather Data</span>
              </label>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="px-6 py-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-white hover:border-slate-300 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs hover:shadow transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isExporting ? (
              <span>Exporting...</span>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Export</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
