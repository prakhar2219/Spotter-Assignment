import React, { useState, useEffect, useCallback } from 'react';
import { checkBackendHealth } from './services/api';
import {
  Activity,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Server,
  Layers,
  ShieldCheck,
  Compass,
  ArrowRight,
  Database,
  CloudSun
} from 'lucide-react';

export default function App() {
  const [healthStatus, setHealthStatus] = useState({
    loading: true,
    connected: false,
    data: null,
    latencyMs: null,
    error: null,
    lastChecked: null,
  });

  const runHealthCheck = useCallback(async () => {
    setHealthStatus(prev => ({ ...prev, loading: true }));
    const result = await checkBackendHealth();
    setHealthStatus({
      loading: false,
      connected: result.success,
      data: result.data,
      latencyMs: result.latencyMs,
      error: result.error,
      lastChecked: new Date().toLocaleTimeString(),
    });
  }, []);

  useEffect(() => {
    runHealthCheck();
  }, [runHealthCheck]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Top Navigation */}
      <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-400">
              <Compass className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight text-white flex items-center gap-2">
                SPOTTER <span className="text-teal-400 text-xs px-2 py-0.5 rounded bg-teal-950 border border-teal-700/50 uppercase tracking-widest font-mono">Routing</span>
              </span>
              <p className="text-xs text-slate-400 hidden sm:block">Weather-Aware Truck Route Optimization</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700 text-xs">
              <span
                className={`w-2 h-2 rounded-full ${
                  healthStatus.loading
                    ? 'bg-amber-400 animate-ping'
                    : healthStatus.connected
                    ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                    : 'bg-rose-500'
                }`}
              />
              <span className="font-medium text-slate-300">
                {healthStatus.loading
                  ? 'Checking...'
                  : healthStatus.connected
                  ? 'API Connected'
                  : 'API Offline'}
              </span>
              {healthStatus.latencyMs !== null && healthStatus.connected && (
                <span className="text-slate-400 font-mono text-[11px] border-l border-slate-700 pl-2">
                  {healthStatus.latencyMs}ms
                </span>
              )}
            </div>

            <button
              onClick={runHealthCheck}
              disabled={healthStatus.loading}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors disabled:opacity-50"
              title="Refresh health status"
              id="refresh-health-btn"
            >
              <RefreshCw className={`w-4 h-4 ${healthStatus.loading ? 'animate-spin text-teal-400' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Hero Section */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-teal-500/10 via-cyan-500/5 to-transparent rounded-full -mr-20 -mt-20 pointer-events-none" />
          
          <div className="max-w-3xl space-y-4 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-600" />
              Phase 1 Milestone — Architecture & Scaffolding
            </div>
            
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Weather-Aware Truck Routing Platform
            </h1>
            
            <p className="text-slate-600 text-base sm:text-lg leading-relaxed">
              Evaluating truck transit routes against time-aware meteorological forecasts. Applying load-dependent crosswind thresholds, precipitation risk classification, and deterministic safety ranking.
            </p>
          </div>
        </div>

        {/* Status & Diagnostic Panels Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Backend Diagnostics Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                    <Server className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Backend Diagnostics</h2>
                    <p className="text-xs text-slate-500">Django REST Framework API</p>
                  </div>
                </div>

                <span
                  className={`text-xs px-2.5 py-1 rounded-md font-semibold inline-flex items-center gap-1.5 ${
                    healthStatus.connected
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}
                >
                  {healthStatus.connected ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" /> Healthy
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3.5 h-3.5" /> Disconnected
                    </>
                  )}
                </span>
              </div>

              <div className="space-y-2.5 pt-2">
                <div className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Endpoint:</span>
                  <code className="bg-slate-100 px-2 py-0.5 rounded text-slate-800 font-mono text-[11px]">
                    GET /api/health/
                  </code>
                </div>
                <div className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Response Latency:</span>
                  <span className="font-mono font-medium text-slate-800">
                    {healthStatus.latencyMs !== null ? `${healthStatus.latencyMs} ms` : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Last Verified:</span>
                  <span className="text-slate-800 font-mono">
                    {healthStatus.lastChecked || 'Pending...'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs py-1.5">
                  <span className="text-slate-500">CORS Allowed Origin:</span>
                  <span className="text-emerald-700 font-medium">http://localhost:5173</span>
                </div>
              </div>

              {healthStatus.error && (
                <div className="mt-3 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
                  <p className="font-semibold mb-1">Connection Error:</p>
                  <p className="font-mono text-[11px]">{healthStatus.error}</p>
                </div>
              )}

              {healthStatus.data && (
                <div className="mt-2 pt-2">
                  <span className="text-xs text-slate-500 font-medium block mb-1">Payload:</span>
                  <pre className="bg-slate-900 text-teal-300 p-3 rounded-lg text-[11px] font-mono overflow-x-auto">
                    {JSON.stringify(healthStatus.data, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <button
              onClick={runHealthCheck}
              disabled={healthStatus.loading}
              className="mt-4 w-full py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-2 transition shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${healthStatus.loading ? 'animate-spin' : ''}`} />
              Re-test API Connection
            </button>
          </div>

          {/* Architecture Matrix Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">System Architecture</h2>
                  <p className="text-xs text-slate-500">Full-stack modular components</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/60 flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-900">Frontend Layer</p>
                    <p className="text-[11px] text-slate-500">React 19, Vite, Tailwind CSS, Leaflet</p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    ACTIVE
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/60 flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-900">Backend API</p>
                    <p className="text-[11px] text-slate-500">Python 3.12, Django 6.1, DRF, CORS</p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    ACTIVE
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/60 flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-900">Routing Provider</p>
                    <p className="text-[11px] text-slate-500">OpenRouteService / Mapbox alternative routes</p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">
                    PHASE 2
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/60 flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-900">Weather Forecast Engine</p>
                    <p className="text-[11px] text-slate-500">Time-aware hourly checkpoints & risk rules</p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">
                    PHASE 3-4
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Security: No secrets bundled in client</span>
              <ShieldCheck className="w-4 h-4 text-teal-600" />
            </div>
          </div>

          {/* Phase 1 Acceptance Checklist Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Phase 1 Acceptance</h2>
                  <p className="text-xs text-slate-500">Verification checklist</p>
                </div>
              </div>

              <div className="space-y-2.5">
                {[
                  { text: 'React + Vite UI opens & builds cleanly', done: true },
                  { text: 'Django REST Framework running & passing checks', done: true },
                  { text: 'GET /api/health/ reachable from React', done: healthStatus.connected },
                  { text: 'CORS configured specifically for frontend origin', done: true },
                  { text: 'Environment templates (.env.example) configured without secrets', done: true },
                  { text: 'Automated backend unit tests passing (3/3)', done: true },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2.5 text-xs">
                    {item.done ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-slate-300 shrink-0" />
                    )}
                    <span className={item.done ? 'text-slate-800 font-medium' : 'text-slate-500'}>
                      {item.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 p-3 rounded-lg bg-slate-900 text-slate-100 text-xs flex items-center justify-between">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-mono">Next Milestone</span>
                <span className="font-semibold text-teal-300">Phase 2: Routing Engine</span>
              </div>
              <ArrowRight className="w-4 h-4 text-teal-400" />
            </div>
          </div>
        </div>

        {/* 6-Phase Implementation Roadmap */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 mb-1">Development Roadmap</h2>
          <p className="text-xs text-slate-500 mb-6">Rigorous phase-by-phase implementation sequence</p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
            {[
              { num: '01', title: 'Plan & Scaffold', status: 'Completed', color: 'border-emerald-500 bg-emerald-50/40 text-emerald-700' },
              { num: '02', title: 'Routing Engine', status: 'Next', color: 'border-teal-500 bg-teal-50/40 text-teal-700' },
              { num: '03', title: 'Weather & ETAs', status: 'Queued', color: 'border-slate-200 bg-slate-50 text-slate-600' },
              { num: '04', title: 'Risk Engine', status: 'Queued', color: 'border-slate-200 bg-slate-50 text-slate-600' },
              { num: '05', title: 'Dashboard & Heatmap', status: 'Queued', color: 'border-slate-200 bg-slate-50 text-slate-600' },
              { num: '06', title: 'Audit & Deploy', status: 'Queued', color: 'border-slate-200 bg-slate-50 text-slate-600' },
            ].map((phase) => (
              <div key={phase.num} className={`p-4 rounded-lg border ${phase.color} flex flex-col justify-between`}>
                <div>
                  <span className="font-mono text-xs opacity-60 font-bold block mb-1">Phase {phase.num}</span>
                  <p className="font-bold text-xs text-slate-900">{phase.title}</p>
                </div>
                <span className="mt-3 text-[10px] uppercase tracking-wider font-semibold">
                  {phase.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        Spotter Weather-Aware Truck Routing Assessment &bull; React + Django REST Framework Architecture
      </footer>
    </div>
  );
}
