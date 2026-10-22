import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search,
  Filter,
  Calendar,
  ArrowRight,
  MoreHorizontal,
  RotateCcw,
  Download,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Plus,
  HelpCircle,
  ChevronDown,
  MapPin,
  Clock,
  Truck,
  AlertTriangle,
  CheckCircle,
  FileText,
  GitCompare,
  Compass,
  AlertCircle,
  Check,
  X,
} from 'lucide-react';
import {
  fetchTripHistory,
  fetchTripDetails,
  replanTrip,
  deleteTrip,
} from '../services/api';
import HistoricalTripOverviewMap from './HistoricalTripOverviewMap';
import ExportTripModal from './ExportTripModal';
import RouteComparisonPage from './RouteComparisonPage';
import RouteDetailsPage from './RouteDetailsPage';
import WeatherExplorerPage from './WeatherExplorerPage';

export default function TripHistoryPage({
  onNewTrip,
  onNavigateToPlan,
}) {
  // Page mode: 'list' | 'detail'
  const [viewMode, setViewMode] = useState('list');
  const [activeTripId, setActiveTripId] = useState(null);
  const [activeTrip, setActiveTrip] = useState(null);
  const [activeTripLoading, setActiveTripLoading] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState('overview'); // 'overview' | 'comparison' | 'details' | 'weather' | 'export'

  // List data state
  const [trips, setTrips] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter & Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedRisk, setSelectedRisk] = useState('all');
  const [selectedDateRange, setSelectedDateRange] = useState('3m');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // Dropdown open states
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [riskDropdownOpen, setRiskDropdownOpen] = useState(false);
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);

  // Sorting state
  const [sortBy, setSortBy] = useState('departure_time');
  const [sortDir, setSortDir] = useState('desc');

  // Action menu for specific trip row
  const [actionMenuTripId, setActionMenuTripId] = useState(null);

  // Export modal state
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportTargetTripId, setExportTargetTripId] = useState(null);

  // Toast / notification
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Fetch trips from backend
  const loadTrips = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetchTripHistory({
      page: currentPage,
      pageSize,
      search: searchQuery,
      status: selectedStatus,
      risk: selectedRisk,
      dateRange: selectedDateRange,
      from: customFrom,
      to: customTo,
      sortBy,
      sortDir,
    });

    setLoading(false);
    if (res.success && res.data) {
      setTrips(res.data.results || []);
      setTotalCount(res.data.total_count || 0);
      setTotalPages(res.data.total_pages || 1);
    } else {
      setError(res.error || 'Failed to load trip history');
    }
  }, [
    currentPage,
    pageSize,
    searchQuery,
    selectedStatus,
    selectedRisk,
    selectedDateRange,
    customFrom,
    customTo,
    sortBy,
    sortDir,
  ]);

  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  // Open a trip's details
  const handleOpenTripDetails = async (tripId) => {
    setActiveTripId(tripId);
    setActiveTripLoading(true);
    setViewMode('detail');
    setActiveDetailTab('overview');

    const res = await fetchTripDetails(tripId);
    setActiveTripLoading(false);
    if (res.success && res.data) {
      setActiveTrip(res.data);
    } else {
      showToast(res.error || 'Could not load trip details');
    }
  };

  // Replan a trip
  const handleReplan = async (tripId) => {
    setActionMenuTripId(null);
    showToast(`Replanning trip ${tripId}...`);
    const res = await replanTrip(tripId);
    if (res.success && res.data) {
      showToast(`Trip replanned! New Trip ID: ${res.data.new_trip_id}`);
      loadTrips();
      if (res.data.new_trip_id) {
        handleOpenTripDetails(res.data.new_trip_id);
      }
    } else {
      showToast(res.error || 'Failed to replan trip');
    }
  };

  // Delete a trip
  const handleDelete = async (tripId) => {
    setActionMenuTripId(null);
    if (!window.confirm(`Are you sure you want to delete trip ${tripId}?`)) return;

    const res = await deleteTrip(tripId);
    if (res.success) {
      showToast(`Trip ${tripId} deleted`);
      loadTrips();
      if (activeTripId === tripId) {
        setViewMode('list');
      }
    } else {
      showToast(res.error || 'Failed to delete trip');
    }
  };

  // Open Export Modal
  const handleOpenExport = (tripId = null) => {
    setActionMenuTripId(null);
    setExportTargetTripId(tripId);
    setExportModalOpen(true);
  };

  // Helper for Status Badge styling
  const renderStatusBadge = (statusStr) => {
    const s = (statusStr || '').toLowerCase();
    if (s === 'completed') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          Completed
        </span>
      );
    }
    if (s === 'failed') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
          Failed
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
        In Progress
      </span>
    );
  };

  // Helper for Avg Risk badge
  const renderRiskBadge = (avgRisk, riskLevel) => {
    const val = Number(avgRisk) || 0;
    let badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (val >= 1.5 || riskLevel === 'Severe' || riskLevel === 'No Travel') {
      badgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
    } else if (val >= 0.8 || riskLevel === 'Moderate' || riskLevel === 'High') {
      badgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
    }

    return (
      <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-bold border ${badgeClass}`}>
        {val.toFixed(2)}
      </span>
    );
  };

  // Clear all filters
  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedStatus('all');
    setSelectedRisk('all');
    setSelectedDateRange('all');
    setCustomFrom('');
    setCustomTo('');
    setCurrentPage(1);
  };

  const hasActiveFilters =
    Boolean(searchQuery) ||
    selectedStatus !== 'all' ||
    selectedRisk !== 'all' ||
    (selectedDateRange !== 'all' && selectedDateRange !== '3m');

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.dropdown-container')) {
        setStatusDropdownOpen(false);
        setRiskDropdownOpen(false);
        setDateDropdownOpen(false);
      }
      if (!e.target.closest('.action-menu-container')) {
        setActionMenuTripId(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#F8FAFC]">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-14 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-3 duration-200">
          <CheckCircle className="w-4 h-4 text-teal-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Export Modal */}
      <ExportTripModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        tripId={exportTargetTripId}
        tripIds={trips.map((t) => t.trip_id)}
      />

      {/* ========================================================================= */}
      {/* 1. MAIN LIST VIEW */}
      {/* ========================================================================= */}
      {viewMode === 'list' && (
        <div className="flex-1 flex flex-col min-h-0 p-6 max-w-7xl mx-auto w-full space-y-5">
          {/* Page Title & New Trip Action */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Trip History</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                View, search and manage all your past trip plans.
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => handleOpenExport()}
                className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export History</span>
              </button>
              <button
                type="button"
                onClick={onNewTrip}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs hover:shadow transition-all flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Trip</span>
              </button>
            </div>
          </div>

          {/* Search & Filter Toolbar (Panels 1 & 2) */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-3 flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="flex-1 min-w-[240px] relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by origin, destination or route..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-3 py-2 text-xs font-medium rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-slate-50/50 focus:bg-white transition-all text-slate-900 placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter 1: Status Dropdown */}
            <div className="relative dropdown-container">
              <button
                type="button"
                onClick={() => {
                  setStatusDropdownOpen(!statusDropdownOpen);
                  setRiskDropdownOpen(false);
                  setDateDropdownOpen(false);
                }}
                className="px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white text-xs font-medium text-slate-700 flex items-center gap-2 transition-colors min-w-[130px] justify-between"
              >
                <span>
                  {selectedStatus === 'all'
                    ? 'All Statuses'
                    : selectedStatus === 'completed'
                    ? 'Completed'
                    : selectedStatus === 'failed'
                    ? 'Failed'
                    : 'In Progress'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {statusDropdownOpen && (
                <div className="absolute left-0 mt-1.5 w-44 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100 text-xs">
                  {[
                    { id: 'all', label: 'All Statuses' },
                    { id: 'completed', label: 'Completed' },
                    { id: 'failed', label: 'Failed' },
                    { id: 'in_progress', label: 'In Progress' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setSelectedStatus(opt.id);
                        setStatusDropdownOpen(false);
                        setCurrentPage(1);
                      }}
                      className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-slate-50 font-medium ${
                        selectedStatus === opt.id ? 'text-blue-600 font-semibold bg-blue-50/40' : 'text-slate-700'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {selectedStatus === opt.id && <Check className="w-3.5 h-3.5 text-blue-600" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Filter 2: Risk Levels Dropdown */}
            <div className="relative dropdown-container">
              <button
                type="button"
                onClick={() => {
                  setRiskDropdownOpen(!riskDropdownOpen);
                  setStatusDropdownOpen(false);
                  setDateDropdownOpen(false);
                }}
                className="px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white text-xs font-medium text-slate-700 flex items-center gap-2 transition-colors min-w-[135px] justify-between"
              >
                <span>
                  {selectedRisk === 'all'
                    ? 'All Risk Levels'
                    : selectedRisk.charAt(0).toUpperCase() + selectedRisk.slice(1)}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {riskDropdownOpen && (
                <div className="absolute left-0 mt-1.5 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRisk('all');
                      setRiskDropdownOpen(false);
                      setCurrentPage(1);
                    }}
                    className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-slate-50 font-medium ${
                      selectedRisk === 'all' ? 'text-blue-600 font-semibold bg-blue-50/40' : 'text-slate-700'
                    }`}
                  >
                    <span>All Risk Levels</span>
                    {selectedRisk === 'all' && <Check className="w-3.5 h-3.5 text-blue-600" />}
                  </button>

                  {[
                    { id: 'low', label: 'Low', color: 'bg-emerald-500' },
                    { id: 'moderate', label: 'Moderate', color: 'bg-amber-500' },
                    { id: 'high', label: 'High', color: 'bg-orange-500' },
                    { id: 'severe', label: 'Severe', color: 'bg-rose-500' },
                    { id: 'no_travel', label: 'No Travel', color: 'bg-red-900' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setSelectedRisk(opt.id);
                        setRiskDropdownOpen(false);
                        setCurrentPage(1);
                      }}
                      className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-slate-50 font-medium ${
                        selectedRisk === opt.id ? 'text-blue-600 font-semibold bg-blue-50/40' : 'text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${opt.color}`}></span>
                        <span>{opt.label}</span>
                      </div>
                      {selectedRisk === opt.id && <Check className="w-3.5 h-3.5 text-blue-600" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Filter 3: Date Range Dropdown */}
            <div className="relative dropdown-container">
              <button
                type="button"
                onClick={() => {
                  setDateDropdownOpen(!dateDropdownOpen);
                  setStatusDropdownOpen(false);
                  setRiskDropdownOpen(false);
                }}
                className="px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white text-xs font-medium text-slate-700 flex items-center gap-2 transition-colors min-w-[150px] justify-between"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>
                    {selectedDateRange === '7d'
                      ? 'Last 7 days'
                      : selectedDateRange === '30d'
                      ? 'Last 30 days'
                      : selectedDateRange === '3m'
                      ? 'Last 3 months'
                      : selectedDateRange === '6m'
                      ? 'Last 6 months'
                      : selectedDateRange === '1y'
                      ? 'Last 1 year'
                      : selectedDateRange === 'custom'
                      ? 'Custom Range'
                      : 'Select Date Range'}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </button>

              {dateDropdownOpen && (
                <div className="absolute right-0 mt-1.5 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-30 animate-in fade-in zoom-in-95 duration-100 text-xs">
                  {[
                    { id: '7d', label: 'Last 7 days' },
                    { id: '30d', label: 'Last 30 days' },
                    { id: '3m', label: 'Last 3 months' },
                    { id: '6m', label: 'Last 6 months' },
                    { id: '1y', label: 'Last 1 year' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setSelectedDateRange(opt.id);
                        setDateDropdownOpen(false);
                        setCurrentPage(1);
                      }}
                      className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-slate-50 font-medium ${
                        selectedDateRange === opt.id ? 'text-blue-600 font-semibold bg-blue-50/40' : 'text-slate-700'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {selectedDateRange === opt.id && <Check className="w-3.5 h-3.5 text-blue-600" />}
                    </button>
                  ))}

                  {/* Custom Range Section */}
                  <div className="px-3 pt-2.5 pb-1 mt-1 border-t border-slate-100 space-y-2">
                    <span className="font-bold text-slate-700 text-[11px] block">Custom Range</span>
                    <div className="space-y-1.5">
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold">From</span>
                        <input
                          type="date"
                          value={customFrom}
                          onChange={(e) => setCustomFrom(e.target.value)}
                          className="w-full px-2 py-1 border border-slate-200 rounded-md text-[11px] text-slate-700"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold">To</span>
                        <input
                          type="date"
                          value={customTo}
                          onChange={(e) => setCustomTo(e.target.value)}
                          className="w-full px-2 py-1 border border-slate-200 rounded-md text-[11px] text-slate-700"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDateRange('custom');
                          setDateDropdownOpen(false);
                          setCurrentPage(1);
                        }}
                        className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold"
                      >
                        Apply
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCustomFrom('');
                          setCustomTo('');
                          setSelectedDateRange('3m');
                          setDateDropdownOpen(false);
                        }}
                        className="px-2.5 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-md text-xs font-medium"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Clear All Filters Button */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 px-2 py-1 rounded-lg hover:bg-rose-50 transition-colors"
              >
                Reset Filters
              </button>
            )}
          </div>

          {/* Desktop Table Container */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            {loading ? (
              <div className="py-20 text-center space-y-3">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-xs font-medium text-slate-500">Loading historical trip records...</p>
              </div>
            ) : trips.length === 0 ? (
              /* Empty State (Panel 6) */
              <div className="py-20 px-6 text-center max-w-sm mx-auto space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-inner">
                  <FileText className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  {hasActiveFilters ? 'No matching trips found' : 'No trips found'}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {hasActiveFilters
                    ? 'No trips matched your current search and filter criteria. Try clearing filters.'
                    : "You haven't planned any trips yet. Create your first trip to see it here."}
                </p>
                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
                  >
                    Clear All Filters
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onNewTrip}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs hover:shadow transition-all"
                  >
                    Plan Your First Trip
                  </button>
                )}
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider select-none">
                    <th className="py-3 px-4 w-12 text-center">#</th>
                    <th className="py-3 px-4">Origin → Destination</th>
                    <th className="py-3 px-4">Departure</th>
                    <th className="py-3 px-4">Distance</th>
                    <th className="py-3 px-4">Travel Time</th>
                    <th className="py-3 px-4">Recommended Route</th>
                    <th className="py-3 px-4 text-center">Avg Risk</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {trips.map((item, index) => {
                    const rowNumber = (currentPage - 1) * pageSize + (index + 1);
                    return (
                      <tr
                        key={item.trip_id}
                        className="hover:bg-blue-50/20 transition-colors group"
                      >
                        {/* Index */}
                        <td className="py-3.5 px-4 text-center text-slate-400 font-medium">
                          {rowNumber}
                        </td>

                        {/* Origin -> Destination */}
                        <td className="py-3.5 px-4 font-semibold text-slate-900">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate max-w-[140px]">{item.origin.split(',')[0]}</span>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[140px]">{item.destination.split(',')[0]}</span>
                          </div>
                        </td>

                        {/* Departure Date/Time */}
                        <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                          {item.departure_formatted || item.departure_time}
                        </td>

                        {/* Distance */}
                        <td className="py-3.5 px-4 font-medium text-slate-800 whitespace-nowrap">
                          {item.distance_miles} mi
                        </td>

                        {/* Travel Time */}
                        <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                          {item.travel_time_formatted}
                        </td>

                        {/* Recommended Route */}
                        <td className="py-3.5 px-4 font-semibold text-slate-800 whitespace-nowrap">
                          {item.recommended_route}
                        </td>

                        {/* Avg Risk */}
                        <td className="py-3.5 px-4 text-center">
                          {renderRiskBadge(item.avg_risk, item.risk_level)}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 text-center">
                          {renderStatusBadge(item.status)}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenTripDetails(item.trip_id)}
                              className="px-3 py-1 rounded-lg border border-slate-200 hover:border-blue-600 hover:text-blue-600 text-xs font-semibold text-slate-700 transition-colors"
                            >
                              View
                            </button>

                            {/* More Options Dropdown */}
                            <div className="relative action-menu-container">
                              <button
                                type="button"
                                onClick={() =>
                                  setActionMenuTripId(
                                    actionMenuTripId === item.trip_id ? null : item.trip_id
                                  )
                                }
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </button>

                              {actionMenuTripId === item.trip_id && (
                                <div className="absolute right-0 mt-1 w-36 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-30 text-xs text-left animate-in fade-in zoom-in-95 duration-100">
                                  <button
                                    type="button"
                                    onClick={() => handleReplan(item.trip_id)}
                                    className="w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                                    <span>Replan Trip</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenExport(item.trip_id)}
                                    className="w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium"
                                  >
                                    <Download className="w-3.5 h-3.5 text-slate-400" />
                                    <span>Export Trip</span>
                                  </button>
                                  <div className="my-1 border-t border-slate-100"></div>
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(item.trip_id)}
                                    className="w-full px-3 py-1.5 text-left text-rose-600 hover:bg-rose-50 flex items-center gap-2 font-medium"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                    <span>Delete Trip</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* Desktop Table Footer: Pagination */}
            {trips.length > 0 && (
              <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500 select-none">
                <div>
                  Showing {(currentPage - 1) * pageSize + 1}-
                  {Math.min(currentPage * pageSize, totalCount)} of {totalCount} trips
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="p-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    {Array.from({ length: totalPages }).map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setCurrentPage(i + 1)}
                        className={`w-7 h-7 rounded-lg text-xs font-semibold transition-all ${
                          currentPage === i + 1
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {i + 1}
                      </button>
                    ))}
                    <button
                      type="button"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className="p-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="px-2 py-1 border border-slate-200 rounded-lg bg-white text-xs text-slate-700 font-medium"
                  >
                    <option value={10}>10 per page</option>
                    <option value={25}>25 per page</option>
                    <option value={50}>50 per page</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Mobile View: Compact Cards (Panel 7) */}
          <div className="md:hidden space-y-3">
            {loading ? (
              <div className="py-12 text-center text-xs text-slate-500">Loading trips...</div>
            ) : trips.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">No trips found</div>
            ) : (
              trips.map((item) => (
                <div
                  key={item.trip_id}
                  onClick={() => handleOpenTripDetails(item.trip_id)}
                  className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs active:bg-slate-50 transition-colors flex items-center justify-between cursor-pointer"
                >
                  <div className="space-y-1">
                    <div className="text-[11px] text-slate-400 font-medium">
                      {item.departure_formatted?.split(',')[0]}
                    </div>
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <span>{item.origin.split(',')[0]}</span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                      <span>{item.destination.split(',')[0]}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium">
                      {item.distance_miles} mi • {item.travel_time_formatted}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {renderStatusBadge(item.status)}
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. TRIP DETAILS VIEW (FROM HISTORY - Panels 3 & 4) */}
      {/* ========================================================================= */}
      {viewMode === 'detail' && (
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
          {activeTripLoading ? (
            <div className="py-24 text-center space-y-3">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-xs font-medium text-slate-500">Loading historical trip details...</p>
            </div>
          ) : !activeTrip ? (
            <div className="py-20 text-center space-y-3">
              <p className="text-sm font-bold text-slate-800">Trip data could not be found.</p>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold"
              >
                Back to History
              </button>
            </div>
          ) : (
            <div className="p-6 max-w-7xl mx-auto w-full space-y-5">
              {/* Breadcrumb */}
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className="hover:text-blue-600 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span>Trip History</span>
                </button>
                <span>&gt;</span>
                <span className="text-slate-800">Trip Details</span>
              </div>

              {/* Title & Actions Bar */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                      {activeTrip.summary.origin.split(',')[0]} → {activeTrip.summary.destination.split(',')[0]}
                    </h2>
                    {renderStatusBadge(activeTrip.summary.status)}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{activeTrip.summary.departure_formatted}</span>
                    <span className="text-slate-300">•</span>
                    <span className="font-mono text-[11px] text-slate-400">
                      Trip ID: {activeTrip.trip_id}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleReplan(activeTrip.trip_id)}
                    className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                    <span>Replan Trip</span>
                  </button>
                  <button
                    type="button"
                    onClick={onNewTrip}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs hover:shadow transition-all flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New Trip</span>
                  </button>
                </div>
              </div>

              {/* Tab Navigation (Overview, Route Comparison, Route Details, Weather Explorer, Export) */}
              <div className="flex items-center gap-1 border-b border-slate-200">
                <button
                  type="button"
                  onClick={() => setActiveDetailTab('overview')}
                  className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                    activeDetailTab === 'overview'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Overview
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDetailTab('comparison')}
                  className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                    activeDetailTab === 'comparison'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Route Comparison
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDetailTab('details')}
                  className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                    activeDetailTab === 'details'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Route Details ({activeTrip.summary.recommended_route || 'Route B'})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDetailTab('weather')}
                  className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                    activeDetailTab === 'weather'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Weather Explorer
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenExport(activeTrip.trip_id)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-900 border-b-2 border-transparent transition-all cursor-pointer flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export</span>
                </button>
              </div>

              {/* ========================================================================= */}
              {/* TAB 1: OVERVIEW (Panel 3) */}
              {/* ========================================================================= */}
              {activeDetailTab === 'overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left Column: Trip Summary + Route Metrics (Recommended) */}
                  <div className="lg:col-span-5 space-y-6">
                    {/* Trip Summary Card */}
                    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 space-y-4">
                      <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
                        Trip Summary
                      </h3>
                      <div className="space-y-3 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Origin</span>
                          <span className="font-semibold text-slate-900 text-right">
                            {activeTrip.summary.origin}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Destination</span>
                          <span className="font-semibold text-slate-900 text-right">
                            {activeTrip.summary.destination}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Departure</span>
                          <span className="font-semibold text-slate-900 text-right">
                            {activeTrip.summary.departure_formatted}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Estimated Arrival</span>
                          <span className="font-semibold text-slate-900 text-right">
                            {activeTrip.summary.arrival_time
                              ? new Date(activeTrip.summary.arrival_time).toLocaleString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                  hour: 'numeric',
                                  minute: 'numeric',
                                })
                              : '—'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Truck Load Weight</span>
                          <span className="font-semibold text-slate-900 text-right">
                            {Number(activeTrip.summary.cargo_weight_lb).toLocaleString()} lb
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Checkpoint Interval</span>
                          <span className="font-semibold text-slate-900 text-right">
                            {activeTrip.summary.checkpoint_interval_miles} miles
                          </span>
                        </div>
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-slate-500">Status</span>
                          {renderStatusBadge(activeTrip.summary.status)}
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                          <span className="text-slate-500">Recommended Route</span>
                          <span className="font-bold text-blue-600 text-sm">
                            {activeTrip.summary.recommended_route}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Route Metrics (Recommended) Card */}
                    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 space-y-4">
                      <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
                        Route Metrics (Recommended)
                      </h3>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-100 flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                            <Truck className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 font-semibold uppercase block">
                              Distance
                            </span>
                            <span className="text-sm font-bold text-slate-900">
                              {activeTrip.summary.distance_miles} mi
                            </span>
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-100 flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                            <Clock className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 font-semibold uppercase block">
                              Travel Time
                            </span>
                            <span className="text-sm font-bold text-slate-900">
                              {activeTrip.summary.travel_time_formatted}
                            </span>
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-100 flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                            <AlertTriangle className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 font-semibold uppercase block">
                              Severe Miles
                            </span>
                            <span className="text-sm font-bold text-slate-900">
                              {activeTrip.summary.severe_miles} mi
                            </span>
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-100 flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                            <AlertCircle className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 font-semibold uppercase block">
                              High Miles
                            </span>
                            <span className="text-sm font-bold text-slate-900">
                              {activeTrip.summary.high_miles} mi
                            </span>
                          </div>
                        </div>

                        <div className="col-span-2 p-3 rounded-xl bg-slate-50/70 border border-slate-100 flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                            <CheckCircle className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 font-semibold uppercase block">
                              Avg Risk Score
                            </span>
                            <span className="text-sm font-bold text-slate-900">
                              {activeTrip.summary.avg_risk} / 4.0
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Leaflet Map + Route Comparison Summary Table */}
                  <div className="lg:col-span-7 space-y-6">
                    {/* Interactive Leaflet Map Card */}
                    <HistoricalTripOverviewMap
                      route={
                        activeTrip.plan?.routes?.find(
                          (r) =>
                            r.id === activeTrip.summary.recommended_route_id ||
                            r.name === activeTrip.summary.recommended_route
                        ) || activeTrip.plan?.routes?.[0]
                      }
                      originName={activeTrip.summary.origin}
                      destinationName={activeTrip.summary.destination}
                    />

                    {/* Route Comparison Summary Table Card */}
                    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 space-y-3">
                      <h3 className="text-sm font-bold text-slate-900">
                        Route Comparison Summary
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                              <th className="py-2.5 px-3">Route</th>
                              <th className="py-2.5 px-3">Distance</th>
                              <th className="py-2.5 px-3">Travel Time</th>
                              <th className="py-2.5 px-3">Severe Miles</th>
                              <th className="py-2.5 px-3">High Miles</th>
                              <th className="py-2.5 px-3">Avg Risk</th>
                              <th className="py-2.5 px-3 text-right">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-700">
                            {(activeTrip.plan?.routes || []).map((r) => {
                              const isRec = r.is_recommended || r.status === 'Recommended';
                              const isInelig = !r.is_eligible || r.status === 'Ineligible';

                              return (
                                <tr
                                  key={r.id}
                                  className={isRec ? 'bg-blue-50/30 font-semibold' : ''}
                                >
                                  <td className="py-3 px-3 font-bold text-slate-900 flex items-center gap-1.5">
                                    <span className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px]">
                                      {r.name?.replace('Route ', '') || 'A'}
                                    </span>
                                    <span>{r.name}</span>
                                  </td>
                                  <td className="py-3 px-3">{r.distance_miles} mi</td>
                                  <td className="py-3 px-3">{r.duration_formatted}</td>
                                  <td className="py-3 px-3 text-slate-800">
                                    {r.metrics?.severe_miles ?? 0} mi
                                  </td>
                                  <td className="py-3 px-3 text-slate-800">
                                    {r.metrics?.high_miles ?? 0} mi
                                  </td>
                                  <td className="py-3 px-3">
                                    {renderRiskBadge(
                                      r.metrics?.distance_weighted_average_risk,
                                      r.metrics?.has_no_travel ? 'No Travel' : 'Low'
                                    )}
                                  </td>
                                  <td className="py-3 px-3 text-right">
                                    {isRec ? (
                                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                                        Recommended
                                      </span>
                                    ) : isInelig ? (
                                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                        Ineligible
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        Eligible
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================================= */}
              {/* TAB 2: ROUTE COMPARISON */}
              {/* ========================================================================= */}
              {activeDetailTab === 'comparison' && (
                <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6">
                  <RouteComparisonPage
                    planResult={activeTrip.plan}
                    selectedRouteId={activeTrip.summary.recommended_route_id}
                    setSelectedRouteId={() => {}}
                    timelineOffsetHours={0}
                    setTimelineOffsetHours={() => {}}
                    departureTime={activeTrip.summary.departure_time}
                    onEditTrip={onNavigateToPlan}
                    onRefresh={() => handleReplan(activeTrip.trip_id)}
                    onNavigateToDetails={() => setActiveDetailTab('details')}
                    onNavigateToWeather={() => setActiveDetailTab('weather')}
                    loading={false}
                    apiError={null}
                  />
                </div>
              )}

              {/* ========================================================================= */}
              {/* TAB 3: ROUTE DETAILS (Route B) (Panel 4) */}
              {/* ========================================================================= */}
              {activeDetailTab === 'details' && (
                <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6">
                  <RouteDetailsPage
                    planResult={activeTrip.plan}
                    selectedRouteId={activeTrip.summary.recommended_route_id}
                    onBackToComparison={() => setActiveDetailTab('overview')}
                    onNewTrip={onNewTrip}
                    onNavigateToWeather={() => setActiveDetailTab('weather')}
                  />
                </div>
              )}

              {/* ========================================================================= */}
              {/* TAB 4: WEATHER EXPLORER */}
              {/* ========================================================================= */}
              {activeDetailTab === 'weather' && (
                <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6">
                  <WeatherExplorerPage
                    planResult={activeTrip.plan}
                    selectedRouteId={activeTrip.summary.recommended_route_id}
                    setSelectedRouteId={() => {}}
                    departureTime={activeTrip.summary.departure_time}
                    onBackToComparison={() => setActiveDetailTab('overview')}
                    onNewTrip={onNewTrip}
                    onRefresh={() => handleReplan(activeTrip.trip_id)}
                    loading={false}
                    apiError={null}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
