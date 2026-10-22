import React from 'react';
import {
  Navigation,
  GitCompare,
  FileText,
  CloudSun,
  Clock,
  ShieldCheck,
  Compass,
} from 'lucide-react';

export default function Sidebar({
  activeView = 'plan',
  setActiveView,
  hasPlanResult = false,
}) {
  const navItems = [
    {
      id: 'plan',
      label: 'Plan Trip',
      icon: Navigation,
      badge: null,
    },
    {
      id: 'comparison',
      label: 'Route Comparison',
      icon: GitCompare,
      badge: null,
      disabled: !hasPlanResult,
    },
    {
      id: 'details',
      label: 'Route Details',
      icon: FileText,
      disabled: !hasPlanResult,
    },
    {
      id: 'weather',
      label: 'Weather Explorer',
      icon: CloudSun,
      disabled: !hasPlanResult,
    },
  ];

  const secondaryNavItems = [
    {
      id: 'history',
      label: 'Trip History',
      icon: Clock,
    },
  ];


  return (
    <aside className="w-60 bg-[#0B1528] text-slate-300 flex flex-col justify-between shrink-0 h-screen border-r border-slate-800/80 select-none">
      {/* Brand Header */}
      <div>
        <div className="p-4 flex items-center gap-2.5 border-b border-slate-800/70">
          <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 shadow-inner">
            <Compass className="w-4 h-4 text-teal-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
              Spotter
            </h1>
            <p className="text-[10px] font-medium text-slate-400 tracking-wide">
              Weather-Aware Routing
            </p>
          </div>
        </div>

        {/* Primary Navigation */}
        <nav className="p-2 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (!item.disabled) setActiveView(item.id);
                }}
                disabled={item.disabled}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-teal-600 text-white shadow-xs shadow-teal-900/40'
                    : item.disabled
                    ? 'text-slate-600 hover:text-slate-500 cursor-not-allowed opacity-60'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          <div className="pt-2 pb-1.5">
            <div className="h-px bg-slate-800/80 mx-2" />
          </div>

          {/* Secondary Navigation */}
          {secondaryNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveView(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-teal-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer / Value Prop Badge */}
      <div className="p-3 border-t border-slate-800/70">
        <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-slate-900/60 border border-slate-800">
          <ShieldCheck className="w-3.5 h-3.5 text-teal-400 shrink-0" />
          <div className="text-[10px] leading-tight text-slate-300 font-medium">
            <span>Drive Safer.</span>
            <span className="block text-slate-400 font-normal">Deliver Smarter.</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
