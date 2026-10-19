import React, { useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { RISK_LEVELS } from './RiskLegend';
import { Navigation } from 'lucide-react';

function createCheckpointIcon(checkpoint) {
  const isOrigin = checkpoint.is_origin;
  const isDest = checkpoint.is_destination;
  const risk = checkpoint.risk || {};
  const riskLevel = risk.overall_risk || 'Low';
  const riskColor = RISK_LEVELS[riskLevel]?.color || '#10b981';
  const isNoTravel = risk.is_no_travel || riskLevel === 'No Travel';

  if (isOrigin) {
    return L.divIcon({
      className: 'custom-map-icon',
      html: `
        <div style="background-color: #059669; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; box-shadow: 0 2px 6px rgba(0,0,0,0.35); border: 2px solid white;">
          A
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
  }

  if (isDest) {
    return L.divIcon({
      className: 'custom-map-icon',
      html: `
        <div style="background-color: #e11d48; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; box-shadow: 0 2px 6px rgba(0,0,0,0.35); border: 2px solid white;">
          B
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
  }

  const pulseRing = isNoTravel
    ? `<div class="no-travel-pulse" style="position: absolute; top: -4px; left: -4px; width: 30px; height: 30px; border-radius: 50%; background-color: #e11d48; opacity: 0.6;"></div>`
    : '';

  return L.divIcon({
    className: 'custom-map-icon',
    html: `
      <div style="position: relative; width: 22px; height: 22px;">
        ${pulseRing}
        <div style="position: relative; background-color: ${riskColor}; color: white; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 10px; font-family: monospace; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.25);">
          ${checkpoint.index}
        </div>
      </div>
    `,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

function renderPopupHtml(checkpoint) {
  const w = checkpoint.weather || {};
  const r = checkpoint.risk || {};
  const cond = r.conditions || {};
  const wind = cond.wind || {};
  const isNoTravel = r.is_no_travel;
  const etaFormatted = new Date(checkpoint.estimated_arrival_time).toLocaleTimeString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const badgeBg = isNoTravel
    ? '#ffe4e6; color: #9f1239; border-color: #f43f5e'
    : r.overall_risk === 'Severe'
    ? '#ffedd5; color: #7c2d12; border-color: #f97316'
    : r.overall_risk === 'High'
    ? '#fef3c7; color: #78350f; border-color: #f59e0b'
    : r.overall_risk === 'Moderate'
    ? '#e0f2fe; color: #075985; border-color: #0284c7'
    : '#ecfdf5; color: #065f46; border-color: #10b981';

  return `
    <div style="font-family: inherit; font-size: 12px; line-height: 1.4; color: #1e293b; padding: 2px;">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 6px;">
        <strong style="color: #0f172a; font-size: 13px;">${checkpoint.name}</strong>
        <span style="font-family: monospace; color: #64748b; font-size: 11px;">${checkpoint.cumulative_distance_miles} mi</span>
      </div>

      <div style="margin-bottom: 6px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
          <span style="color: #64748b;">ETA:</span>
          <strong style="font-family: monospace;">${etaFormatted}</strong>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <span style="color: #64748b;">Overall Risk:</span>
          <span style="background: ${badgeBg}; border: 1px solid; border-radius: 9999px; padding: 1px 8px; font-weight: bold; font-size: 10px;">
            ${r.overall_risk || 'Low'} (Score: ${r.overall_score ?? 0})
          </span>
        </div>

        ${r.governing_factor ? `
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 4px 6px; font-size: 10.5px; color: #475569;">
            <strong>Governing:</strong> ${r.governing_factor}
          </div>
        ` : ''}
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; border-top: 1px solid #f1f5f9; padding-top: 6px; font-size: 10px;">
        <div style="background: #f8fafc; padding: 4px; border-radius: 4px;">
          <span style="color: #64748b; display: block;">Wind Speed:</span>
          <strong style="font-family: monospace; color: #0f172a;">${w.wind_speed_mph ?? '—'} mph</strong>
          ${wind.elevated_by_load ? '<span style="color: #b45309; display: block; font-size: 9px; font-weight: bold;">(Load elevated)</span>' : ''}
        </div>

        <div style="background: #f8fafc; padding: 4px; border-radius: 4px;">
          <span style="color: #64748b; display: block;">Precipitation:</span>
          <strong style="font-family: monospace; color: #0f172a;">${w.precipitation_in_hr ?? 0} in/hr</strong>
        </div>

        <div style="background: #f8fafc; padding: 4px; border-radius: 4px;">
          <span style="color: #64748b; display: block;">Snowfall:</span>
          <strong style="font-family: monospace; color: #0f172a;">${w.snowfall_in_hr ?? 0} in/hr</strong>
        </div>

        <div style="background: #f8fafc; padding: 4px; border-radius: 4px;">
          <span style="color: #64748b; display: block;">Temperature:</span>
          <strong style="font-family: monospace; color: #0f172a;">${w.temperature_f ? `${w.temperature_f}°F` : '—'}</strong>
        </div>
      </div>
    </div>
  `;
}

export default function RouteMap({
  routes = [],
  selectedRouteId,
  onSelectRoute,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const polylinesLayerRef = useRef(null);
  const markersLayerRef = useRef(null);

  const selectedRoute = useMemo(() => {
    return routes.find(r => r.id === selectedRouteId) || routes[0];
  }, [routes, selectedRouteId]);

  // Initialize map instance once
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [39.9526, -75.1652],
      zoom: 8,
      scrollWheelZoom: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    polylinesLayerRef.current = L.layerGroup().addTo(map);
    markersLayerRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Synchronize polylines and checkpoints whenever routes or selection change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (polylinesLayerRef.current) polylinesLayerRef.current.clearLayers();
    if (markersLayerRef.current) markersLayerRef.current.clearLayers();

    if (!routes || routes.length === 0) return;

    let selectedLatLngs = [];

    // Draw all routes
    routes.forEach((rt) => {
      const isSelected = rt.id === selectedRouteId;
      const coords = rt.geometry?.coordinates?.map(([lon, lat]) => [lat, lon]) || [];
      if (coords.length === 0) return;

      if (isSelected) {
        selectedLatLngs = coords;
      }

      const poly = L.polyline(coords, {
        color: isSelected ? '#0d9488' : '#94a3b8',
        weight: isSelected ? 5 : 3,
        opacity: isSelected ? 0.95 : 0.5,
        dashArray: isSelected ? undefined : '5, 8',
      });

      poly.on('click', () => {
        if (onSelectRoute) onSelectRoute(rt.id);
      });

      polylinesLayerRef.current.addLayer(poly);
    });

    // Draw checkpoints for selected route
    if (selectedRoute?.checkpoints) {
      selectedRoute.checkpoints.forEach((cp) => {
        const lat = cp.coordinates[1];
        const lon = cp.coordinates[0];
        const marker = L.marker([lat, lon], {
          icon: createCheckpointIcon(cp),
        });

        marker.bindPopup(renderPopupHtml(cp), { maxWidth: 300 });
        markersLayerRef.current.addLayer(marker);
      });
    }

    // Auto fit bounds to active route
    if (selectedLatLngs.length > 0) {
      try {
        const bounds = L.latLngBounds(selectedLatLngs);
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      } catch (err) {
        console.warn('Could not fit bounds:', err);
      }
    }
  }, [routes, selectedRouteId, selectedRoute, onSelectRoute]);

  return (
    <div className="relative w-full h-[440px] sm:h-[480px] lg:h-[520px] rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100">
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Floating Header Badge */}
      <div className="absolute top-3 left-3 z-[1000] bg-white/95 backdrop-blur-xs px-3 py-1.5 rounded-lg border border-slate-200 shadow-xs flex items-center gap-2 text-xs pointer-events-none">
        <Navigation className="w-3.5 h-3.5 text-teal-600" />
        <span className="font-bold text-slate-800">
          Viewing: {selectedRoute?.name || 'Corridor Route'}
        </span>
        <span className="text-[11px] font-mono text-slate-500">
          ({selectedRoute?.checkpoints?.length || 0} checkpoints)
        </span>
      </div>
    </div>
  );
}
