import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ZoomIn, ZoomOut, Layers } from 'lucide-react';

const RISK_COLORS = {
  'Low': '#10B981',
  'Moderate': '#F59E0B',
  'High': '#F97316',
  'Severe': '#EF4444',
  'No Travel': '#991B1B',
  'Unknown': '#7C3AED',
};

export default function HistoricalTripOverviewMap({
  route,
  originName = 'Chicago, IL',
  destinationName = 'New York, NY',
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [mapMode, setMapMode] = useState('map'); // 'map' | 'heatmap'

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [41.2, -81.0],
        zoom: 6,
        zoomControl: false,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);

      // Add custom zoom control at top right
      L.control.zoom({ position: 'topright' }).addTo(map);

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    // Clear existing overlay layers (markers, polylines)
    map.eachLayer((layer) => {
      if (!layer._url) {
        map.removeLayer(layer);
      }
    });

    if (!route) return;

    const coords = route?.geometry?.coordinates || [];
    const latLngs = coords.map((c) => [c[1], c[0]]);

    if (latLngs.length > 0) {
      // Draw background glow / corridor
      L.polyline(latLngs, {
        color: '#2563EB',
        weight: 6,
        opacity: 0.85,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);

      // Add start marker (Chicago)
      const startCoord = latLngs[0];
      const startIcon = L.divIcon({
        className: 'custom-start-pin',
        html: `
          <div style="background-color: #10B981; color: white; padding: 4px 8px; border-radius: 9999px; font-weight: 700; font-size: 11px; display: flex; align-items: center; gap: 4px; box-shadow: 0 2px 6px rgba(0,0,0,0.3); white-space: nowrap; border: 1.5px solid white;">
            <span>📍 ${originName.split(',')[0]}</span>
          </div>
        `,
        iconSize: [80, 24],
        iconAnchor: [40, 12],
      });
      L.marker(startCoord, { icon: startIcon }).addTo(map);

      // Add end marker (New York)
      const endCoord = latLngs[latLngs.length - 1];
      const endIcon = L.divIcon({
        className: 'custom-end-pin',
        html: `
          <div style="background-color: #EF4444; color: white; padding: 4px 8px; border-radius: 9999px; font-weight: 700; font-size: 11px; display: flex; align-items: center; gap: 4px; box-shadow: 0 2px 6px rgba(0,0,0,0.3); white-space: nowrap; border: 1.5px solid white;">
            <span>🏁 ${destinationName.split(',')[0]}</span>
          </div>
        `,
        iconSize: [80, 24],
        iconAnchor: [40, 12],
      });
      L.marker(endCoord, { icon: endIcon }).addTo(map);

      // Add checkpoints along route
      const checkpoints = route.checkpoints || [];
      checkpoints.forEach((cp, idx) => {
        const cpCoords = cp.coordinates || [];
        if (cpCoords.length >= 2) {
          const lat = cpCoords[1];
          const lon = cpCoords[0];
          const riskLevel = cp.risk?.level || cp.risk?.overall_risk || 'Low';
          const color = RISK_COLORS[riskLevel] || '#10B981';

          const marker = L.circleMarker([lat, lon], {
            radius: cp.risk?.level === 'High' ? 6 : 4.5,
            fillColor: color,
            color: '#FFFFFF',
            weight: 1.5,
            opacity: 1,
            fillOpacity: 0.95,
          }).addTo(map);

          marker.bindTooltip(
            `<b>Checkpoint ${cp.sequence || idx + 1}</b><br/>${cp.cumulative_distance_miles || 0} mi<br/>Risk: ${riskLevel}`,
            { direction: 'top', offset: [0, -6] }
          );
        }
      });

      // Fit map bounds with padding
      const bounds = L.latLngBounds(latLngs);
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [route, originName, destinationName, mapMode]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col h-[380px] relative">
      {/* Map Header with Toggles */}
      <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-1 bg-slate-200/60 p-0.5 rounded-lg text-xs font-semibold">
          <button
            type="button"
            onClick={() => setMapMode('map')}
            className={`px-3 py-1 rounded-md transition-all ${
              mapMode === 'map'
                ? 'bg-white text-slate-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Map View
          </button>
          <button
            type="button"
            onClick={() => setMapMode('heatmap')}
            className={`px-3 py-1 rounded-md transition-all ${
              mapMode === 'heatmap'
                ? 'bg-white text-slate-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Weather Heatmap
          </button>
        </div>

        <div className="text-[11px] font-medium text-slate-400">
          Route Corridor & Checkpoints
        </div>
      </div>

      {/* Leaflet Map Canvas */}
      <div ref={mapContainerRef} className="flex-1 w-full relative z-0" />

      {/* Risk Legend Footer */}
      <div className="px-4 py-2 bg-white/95 backdrop-blur-xs border-t border-slate-100 flex items-center justify-center gap-4 text-[11px] font-semibold text-slate-600 select-none">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
          <span>Low</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
          <span>Moderate</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
          <span>High</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
          <span>Severe</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-900"></span>
          <span>No Travel</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span>
          <span>Unknown</span>
        </div>
      </div>
    </div>
  );
}
