import React, { useState, useEffect, useRef } from 'react';
import {
  HelpCircle,
  ChevronDown,
  Navigation,
  GitCompare,
  FileText,
  CloudSun,
  Clock,
  Activity,
  Bell,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  User,
  LogOut,
  Radio,
} from 'lucide-react';

export default function Header({
  activeViewTitle = 'Plan Trip',
  activeView = 'plan',
  healthStatus = { connected: true },
  user = { name: 'John Doe', role: 'Fleet Dispatcher', initials: 'JD' },
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const headerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (headerRef.current && !headerRef.current.contains(event.target)) {
        setProfileOpen(false);
        setHelpOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const viewConfig = {
    plan: { icon: Navigation, accent: 'text-teal-600 bg-teal-50 border-teal-200/80' },
    comparison: { icon: GitCompare, accent: 'text-blue-600 bg-blue-50 border-blue-200/80' },
    details: { icon: FileText, accent: 'text-indigo-600 bg-indigo-50 border-indigo-200/80' },
    weather: { icon: CloudSun, accent: 'text-amber-600 bg-amber-50 border-amber-200/80' },
    history: { icon: Clock, accent: 'text-cyan-600 bg-cyan-50 border-cyan-200/80' },
  };

  const currentView = viewConfig[activeView] || viewConfig.plan;
  const ViewIcon = currentView.icon;

  return (
    <header
      ref={headerRef}
      className="h-12 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-5 flex items-center justify-between shrink-0 select-none shadow-[0_1px_2px_0_rgba(0,0,0,0.03)] z-30"
    >
      {/* Left Section: Active View Identity & Breadcrumb */}
      <div className="flex items-center gap-3">
        {/* Active View Icon Pill */}
        <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 shadow-2xs ${currentView.accent}`}>
          <ViewIcon className="w-3.5 h-3.5" />
        </div>

        {/* Title and Workspace Hierarchy */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-slate-400 hidden sm:inline">
            Spotter
          </span>
          <span className="text-slate-300 hidden sm:inline text-xs font-light">/</span>
          <h2 className="text-xs font-bold text-slate-900 tracking-tight">
            {activeViewTitle}
          </h2>
        </div>

        {/* Live Operational Status Pill */}
        <div className="hidden md:flex items-center gap-1.5 pl-3 border-l border-slate-200/70">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-[10px] font-semibold text-slate-500">
            Weather & OSRM Engine Live
          </span>
        </div>
      </div>

      {/* Right Section: System Status, Docs, User Profile */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Live Weather Feed Badge */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100/80 border border-slate-200/60 text-slate-600 text-[10.5px] font-medium">
          <Radio className="w-3 h-3 text-teal-600 animate-pulse" />
          <span>Open-Meteo 48h Radar</span>
        </div>

        {/* Help & Documentation Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setHelpOpen(!helpOpen);
              setProfileOpen(false);
            }}
            title="Help & Safety Rules"
            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
              helpOpen
                ? 'bg-slate-100 border-slate-300 text-slate-800'
                : 'border-slate-200/70 hover:border-slate-300 text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          {helpOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 p-3 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
              <div className="flex items-center gap-1.5 text-slate-900 font-bold mb-2 pb-1.5 border-b border-slate-100">
                <ShieldCheck className="w-4 h-4 text-teal-600" />
                <span>Safety Rules Quick Reference</span>
              </div>
              <ul className="text-[11px] text-slate-600 space-y-1.5 leading-snug">
                <li>• <b>Severe Wind</b>: ≥ 45 mph for any truck load, or ≥ 40 mph if load &lt; 20k lb.</li>
                <li>• <b>Heavy Rain</b>: &gt; 0.30 in/hr.</li>
                <li>• <b>Heavy Snow</b>: &gt; 0.20 in/hr.</li>
                <li>• <b>No Travel</b>: routes with active No Travel conditions are strictly ineligible.</li>
              </ul>
              <div className="mt-2.5 pt-2 border-t border-slate-100 text-[10px] text-slate-400">
                Spotter Weather-Aware Routing v2.4
              </div>
            </div>
          )}
        </div>

        {/* User Profile Pill & Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setProfileOpen(!profileOpen);
              setHelpOpen(false);
            }}
            className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-slate-200/80 cursor-pointer group focus:outline-none"
          >
            {/* Gradient Avatar */}
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#0B1528] via-[#1E293B] to-teal-800 text-white flex items-center justify-center text-[10px] font-bold tracking-tight shadow-xs border border-white/20 group-hover:scale-105 transition-transform">
              {user.initials}
            </div>

            {/* User Name & Role */}
            <div className="hidden sm:flex flex-col text-left leading-tight">
              <span className="text-xs font-bold text-slate-800 group-hover:text-teal-600 transition-colors">
                {user.name}
              </span>
              <span className="text-[9.5px] font-medium text-slate-400">
                {user.role}
              </span>
            </div>

            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-transform ${
                profileOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {profileOpen && (
            <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-2 border-b border-slate-100">
                <p className="font-bold text-slate-900">{user.name}</p>
                <p className="text-[10px] text-slate-400">{user.role} • Active</p>
              </div>

              <div className="py-1 text-slate-600">
                <div className="px-3 py-1.5 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Routing Provider</span>
                  <span className="font-semibold text-slate-800">OSRM</span>
                </div>
                <div className="px-3 py-1.5 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Backend Status</span>
                  <span className="font-semibold text-emerald-600 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Online
                  </span>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-1">
                <button
                  type="button"
                  onClick={() => setProfileOpen(false)}
                  className="w-full px-3 py-1.5 text-left text-slate-600 hover:bg-slate-50 flex items-center gap-2 font-medium"
                >
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>Dispatcher Profile</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
