import React, { useEffect, useRef, useMemo, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Ensure window.L is available for leaflet plugins in Vite/ESM
if (typeof window !== 'undefined' && !window.L) {
  window.L = L;
}
import 'leaflet.heat';

import { RISK_LEVELS } from './RiskLegend';
import { Navigation, ZoomIn, Maximize2, Layers, Flame } from 'lucide-react';

// Fix default Leaflet icon paths in bundlers (prevents 404s for default marker PNGs)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

/**
 * Extracts active weather and risk data for a checkpoint at the given timeline offset.
 * Uses pre-evaluated hourly forecasts from backend Open-Meteo series when offsetHours > 0.
 */
function getActiveCheckpointData(checkpoint, offsetHours) {
  if (
    offsetHours > 0 &&
    Array.isArray(checkpoint?.hourly_forecasts) &&
    checkpoint.hourly_forecasts.length > 0
  ) {
    const hourly = checkpoint.hourly_forecasts.find((h) => h.offset_hours === offsetHours);
    if (hourly) {
      return {
        isTimeline: true,
        offsetHours,
        forecastTime: hourly.forecast_time || hourly.target_time,
        targetTime: hourly.target_time,
        weather: {
          wind_speed_mph: hourly.wind_speed_mph,
          precipitation_in_hr: hourly.precipitation_in_hr,
          snowfall_in_hr: hourly.snowfall_in_hr,
          temperature_f: hourly.temperature_f,
          weather_code: hourly.weather_code,
          weather_description: hourly.weather_description,
          is_available: hourly.is_available,
        },
        risk: {
          overall_risk: hourly.overall_risk,
          overall_score: hourly.overall_score,
          governing_factor: hourly.governing_factor,
          is_no_travel: hourly.is_no_travel,
          conditions: {
            wind: { risk: hourly.overall_risk },
            rain: { risk: hourly.overall_risk },
            snow: { risk: hourly.overall_risk },
          },
        },
      };
    }
  }

  // Fallback to time-aware arrival ETA data
  return {
    isTimeline: false,
    offsetHours: 0,
    forecastTime: checkpoint?.weather?.forecast_time,
    targetTime: checkpoint?.estimated_arrival_time,
    weather: checkpoint?.weather || {},
    risk: checkpoint?.risk || {},
  };
}

/**
 * Creates accessible custom Leaflet markers for checkpoints.
 */
function createCheckpointIcon(checkpoint, offsetHours = 0) {
  const isOrigin = checkpoint.is_origin;
  const isDest = checkpoint.is_destination;
  const activeData = getActiveCheckpointData(checkpoint, offsetHours);
  const r = activeData.risk || {};
  const riskLevel = r.overall_risk || (activeData.weather?.is_available === false ? 'Unknown' : 'Low');
  const riskInfo = RISK_LEVELS[riskLevel] || RISK_LEVELS['Low'];
  const isNoTravel = r.is_no_travel || riskLevel === 'No Travel';
  const isUnknown = riskLevel === 'Unknown' || activeData.weather?.is_available === false;

  if (isOrigin) {
    return L.divIcon({
      className: 'custom-map-icon',
      html: `
        <div style="position: relative; width: 30px; height: 30px;">
          <div style="background-color: #059669; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 800; font-size: 13px; box-shadow: 0 3px 8px rgba(0,0,0,0.35); border: 2.5px solid white;">
            A
          </div>
          <span style="position: absolute; -bottom: 16px; left: 50%; transform: translateX(-50%); background: #059669; color: white; font-size: 8px; font-weight: bold; padding: 1px 4px; border-radius: 3px; white-space: nowrap; box-shadow: 0 1px 3px rgba(0,0,0,0.3);">START</span>
        </div>
      `,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [0, -16],
    });
  }

  if (isDest) {
    return L.divIcon({
      className: 'custom-map-icon',
      html: `
        <div style="position: relative; width: 30px; height: 30px;">
          <div style="background-color: #e11d48; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 800; font-size: 13px; box-shadow: 0 3px 8px rgba(0,0,0,0.35); border: 2.5px solid white;">
            B
          </div>
          <span style="position: absolute; -bottom: 16px; left: 50%; transform: translateX(-50%); background: #e11d48; color: white; font-size: 8px; font-weight: bold; padding: 1px 4px; border-radius: 3px; white-space: nowrap; box-shadow: 0 1px 3px rgba(0,0,0,0.3);">DEST</span>
        </div>
      `,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [0, -16],
    });
  }

  // 1. No Travel: Octagon hazard shape with ✕ symbol & pulse ring (accessible non-color shape)
  if (isNoTravel) {
    return L.divIcon({
      className: 'custom-map-icon',
      html: `
        <div style="position: relative; width: 28px; height: 28px;">
          <div class="no-travel-pulse" style="position: absolute; top: -5px; left: -5px; width: 38px; height: 38px; border-radius: 50%; background-color: #e11d48; opacity: 0.5;"></div>
          <div style="position: relative; width: 28px; height: 28px; background-color: #be123c; color: white; clip-path: polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%); display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 900; font-family: monospace; border: 2px solid white; box-shadow: 0 3px 8px rgba(0,0,0,0.45);">
            <span style="font-size: 8px; line-height: 1; margin-top: -1px;">✕</span>
            <span style="font-size: 9px; line-height: 1;">${checkpoint.index}</span>
          </div>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -15],
    });
  }

  // 2. Unknown Weather: Dashed border with '?' icon (distinct from Low risk)
  if (isUnknown) {
    return L.divIcon({
      className: 'custom-map-icon',
      html: `
        <div style="position: relative; width: 24px; height: 24px;">
          <div style="position: relative; background-color: #7c3aed; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: bold; font-family: monospace; border: 2px dashed #ede9fe; box-shadow: 0 2px 6px rgba(124, 58, 237, 0.45);">
            <span style="font-size: 7.5px; line-height: 1; color: #fdf4ff;">?</span>
            <span style="font-size: 8.5px; line-height: 1;">${checkpoint.index}</span>
          </div>
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
      popupAnchor: [0, -13],
    });
  }

  // 3. Standard Checkpoints (Low, Moderate, High, Severe)
  const riskColor = riskInfo.color || '#10b981';
  return L.divIcon({
    className: 'custom-map-icon',
    html: `
      <div style="position: relative; width: 22px; height: 22px;">
        <div style="position: relative; background-color: ${riskColor}; color: white; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 10px; font-family: monospace; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">
          ${checkpoint.index}
        </div>
      </div>
    `,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -12],
  });
}

/**
 * Builds HTML popup with full weather details, ETAs, and risk evaluation.
 */
function renderPopupHtml(checkpoint, offsetHours = 0) {
  const activeData = getActiveCheckpointData(checkpoint, offsetHours);
  const w = activeData.weather || {};
  const r = activeData.risk || {};
  const cond = r.conditions || {};
  const wind = cond.wind || {};
  const rain = cond.rain || {};
  const snow = cond.snow || {};
  const isNoTravel = r.is_no_travel || r.overall_risk === 'No Travel';
  const isUnknown = r.overall_risk === 'Unknown' || w.is_available === false;

  let etaFormatted = '—';
  if (checkpoint.estimated_arrival_time) {
    try {
      etaFormatted = new Date(checkpoint.estimated_arrival_time).toLocaleTimeString([], {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      etaFormatted = checkpoint.estimated_arrival_time;
    }
  }

  let snapshotTimeFormatted = null;
  if (activeData.isTimeline && activeData.targetTime) {
    try {
      snapshotTimeFormatted = new Date(activeData.targetTime).toLocaleTimeString([], {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      snapshotTimeFormatted = activeData.targetTime;
    }
  }

  const badgeBg = isNoTravel
    ? '#ffe4e6; color: #9f1239; border-color: #f43f5e'
    : isUnknown
    ? '#f3e8ff; color: #6b21a8; border-color: #c084fc'
    : r.overall_risk === 'Severe'
    ? '#ffedd5; color: #7c2d12; border-color: #f97316'
    : r.overall_risk === 'High'
    ? '#fef3c7; color: #78350f; border-color: #f59e0b'
    : r.overall_risk === 'Moderate'
    ? '#e0f2fe; color: #075985; border-color: #0284c7'
    : '#ecfdf5; color: #065f46; border-color: #10b981';

  return `
    <div style="font-family: inherit; font-size: 12px; line-height: 1.4; color: #1e293b; padding: 2px; min-width: 240px;">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 6px;">
        <div>
          <span style="font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase;">Checkpoint #${checkpoint.index}</span>
          <strong style="color: #0f172a; font-size: 13px; display: block;">${checkpoint.name}</strong>
        </div>
        <span style="font-family: monospace; color: #0f766e; font-weight: bold; font-size: 11px; background: #f0fdfa; padding: 2px 6px; border-radius: 4px; border: 1px solid #ccfbf1;">
          ${checkpoint.cumulative_distance_miles} mi
        </span>
      </div>

      ${activeData.isTimeline ? `
        <div style="background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 4px; padding: 3px 6px; margin-bottom: 6px; font-size: 10.5px; color: #115e59;">
          <strong>Timeline Snapshot (+${offsetHours}h):</strong> ${snapshotTimeFormatted}
          <div style="font-size: 9.5px; color: #0f766e;">(Scheduled Truck Arrival ETA: ${etaFormatted})</div>
        </div>
      ` : `
        <div style="display: flex; justify-content: space-between; margin-bottom: 3px; font-size: 11px;">
          <span style="color: #64748b;">Scheduled Arrival ETA:</span>
          <strong style="font-family: monospace; color: #1e293b;">${etaFormatted}</strong>
        </div>
      `}

      <div style="margin-bottom: 6px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <span style="color: #64748b; font-size: 11px;">Evaluated Risk:</span>
          <span style="background: ${badgeBg}; border: 1px solid; border-radius: 9999px; padding: 1.5px 8px; font-weight: bold; font-size: 10.5px; display: inline-flex; align-items: center; gap: 4px;">
            ${isNoTravel ? '⛔' : isUnknown ? '?' : '●'} ${r.overall_risk || 'Low'} ${r.overall_score !== undefined && r.overall_score !== null ? `(Score: ${r.overall_score})` : ''}
          </span>
        </div>

        ${r.governing_factor ? `
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 4px 6px; font-size: 10.5px; color: #475569; margin-top: 4px;">
            <strong style="color: #0f172a;">Governing Factor:</strong> ${r.governing_factor}
          </div>
        ` : ''}
      </div>

      ${isNoTravel ? `
        <div style="background: #fff1f2; border: 1px solid #fecdd3; border-radius: 4px; padding: 4px 6px; font-size: 10.5px; color: #9f1239; font-weight: 600; margin-bottom: 6px;">
          ⛔ NO TRAVEL HAZARD: Violates safety rules at this forecast hour.
        </div>
      ` : ''}

      ${isUnknown ? `
        <div style="background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 4px; padding: 4px 6px; font-size: 10.5px; color: #6b21a8; font-weight: 600; margin-bottom: 6px;">
          ⚠️ UNKNOWN WEATHER: Forecast data missing. Cannot verify safety.
        </div>
      ` : ''}

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; border-top: 1px solid #f1f5f9; padding-top: 6px; font-size: 10px;">
        <div style="background: #f8fafc; padding: 4px; border-radius: 4px; border: 1px solid #f1f5f9;">
          <span style="color: #64748b; display: block;">Wind & Risk:</span>
          <strong style="font-family: monospace; color: #0f172a;">${w.wind_speed_mph !== null && w.wind_speed_mph !== undefined ? `${w.wind_speed_mph} mph` : '—'}</strong>
          <span style="display: block; color: #475569;">${wind.risk || '—'}</span>
        </div>

        <div style="background: #f8fafc; padding: 4px; border-radius: 4px; border: 1px solid #f1f5f9;">
          <span style="color: #64748b; display: block;">Precipitation:</span>
          <strong style="font-family: monospace; color: #0f172a;">${w.precipitation_in_hr !== null && w.precipitation_in_hr !== undefined ? `${w.precipitation_in_hr} in/hr` : '—'}</strong>
          <span style="display: block; color: #475569;">${rain.risk || '—'}</span>
        </div>

        <div style="background: #f8fafc; padding: 4px; border-radius: 4px; border: 1px solid #f1f5f9;">
          <span style="color: #64748b; display: block;">Snowfall:</span>
          <strong style="font-family: monospace; color: #0f172a;">${w.snowfall_in_hr !== null && w.snowfall_in_hr !== undefined ? `${w.snowfall_in_hr} in/hr` : '—'}</strong>
          <span style="display: block; color: #475569;">${snow.risk || '—'}</span>
        </div>

        <div style="background: #f8fafc; padding: 4px; border-radius: 4px; border: 1px solid #f1f5f9;">
          <span style="color: #64748b; display: block;">Temperature:</span>
          <strong style="font-family: monospace; color: #0f172a;">${w.temperature_f !== null && w.temperature_f !== undefined ? `${w.temperature_f}°F` : '—'}</strong>
        </div>
      </div>
    </div>
  `;
}

/**
 * Validates GeoJSON coordinate pairs into Leaflet [lat, lon] tuples.
 */
function extractValidLatLngs(coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length === 0) return [];
  const valid = [];
  for (const pt of coordinates) {
    if (Array.isArray(pt) && pt.length >= 2) {
      const lon = Number(pt[0]);
      const lat = Number(pt[1]);
      if (
        Number.isFinite(lat) &&
        Number.isFinite(lon) &&
        Math.abs(lat) <= 90 &&
        Math.abs(lon) <= 180
      ) {
        valid.push([lat, lon]);
      }
    }
  }
  return valid;
}

export const ROUTE_COLORS = ['#EF4444', '#2563EB', '#9333EA', '#F59E0B'];

export default function RouteMap({
  routes = [],
  selectedRouteId,
  onSelectRoute,
  timelineOffsetHours = 0,
  samplingIntervalMiles = 25,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const heatmapLayerRef = useRef(null);
  const polylinesLayerRef = useRef(null);
  const markersLayerRef = useRef(null);

  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showMapLegend, setShowMapLegend] = useState(true);
  const [visibleRoutes, setVisibleRoutes] = useState({});
  const [showCheckpoints, setShowCheckpoints] = useState(true);

  const selectedRoute = useMemo(() => {
    return routes.find((r) => r.id === selectedRouteId) || routes[0];
  }, [routes, selectedRouteId]);

  // Initialize Leaflet map instance once
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [39.9526, -75.1652],
      zoom: 8,
      scrollWheelZoom: true,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    }).addTo(map);

    // Layer addition order: heatmap at bottom, then polylines, then markers on top
    heatmapLayerRef.current = L.layerGroup().addTo(map);
    polylinesLayerRef.current = L.layerGroup().addTo(map);
    markersLayerRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;

    // Use ResizeObserver to automatically invalidate map size on container resize
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Synchronize heatmap, polylines, and markers whenever routes, selection, or timeline offset changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (heatmapLayerRef.current) heatmapLayerRef.current.clearLayers();
    if (polylinesLayerRef.current) polylinesLayerRef.current.clearLayers();
    if (markersLayerRef.current) markersLayerRef.current.clearLayers();

    if (!routes || routes.length === 0) return;

    let selectedLatLngs = [];
    const allRoutesLatLngs = [];

    // 1. Draw each route polyline with distinct colors matching route_comparison page.png
    routes.forEach((rt, idx) => {
      if (visibleRoutes[rt.id] === false) return;

      const isSelected = rt.id === selectedRouteId;
      const isRecommended = rt.is_recommended;
      const coords = extractValidLatLngs(rt.geometry?.coordinates);
      if (coords.length === 0) return;

      coords.forEach((pt) => allRoutesLatLngs.push(pt));

      if (isSelected) {
        selectedLatLngs = coords;
      }

      const routeColor = ROUTE_COLORS[idx % ROUTE_COLORS.length];
      const letter = String.fromCharCode(65 + idx);

      const strokeWeight = isSelected ? 6 : 3.5;
      const strokeOpacity = isSelected ? 1.0 : 0.65;
      const dashPattern = isSelected ? undefined : '5, 5';

      const poly = L.polyline(coords, {
        color: routeColor,
        weight: strokeWeight,
        opacity: strokeOpacity,
        dashArray: dashPattern,
        lineCap: 'round',
        lineJoin: 'round',
      });

      // Tooltip to identify route on hover
      const badgeHtml = isRecommended
        ? '<span style="background: #0d9488; color: white; font-size: 10px; font-weight: bold; padding: 1px 5px; border-radius: 3px; margin-left: 6px;">★ RECOMMENDED</span>'
        : '';
      const tooltipText = `
        <div style="font-family: inherit; font-size: 11px;">
          <strong>Route ${letter}: ${rt.name}</strong> ${badgeHtml}<br/>
          <span style="color: #64748b; font-family: monospace;">${rt.distance_miles} mi &bull; ${rt.duration_formatted}</span>
          ${!isSelected ? '<span style="display: block; color: #2563eb; font-size: 10px; margin-top: 2px;">Click to select this route</span>' : ''}
        </div>
      `;
      poly.bindTooltip(tooltipText, { sticky: true });

      poly.on('click', () => {
        if (onSelectRoute) onSelectRoute(rt.id);
      });

      poly.on('mouseover', () => {
        if (!isSelected) {
          poly.setStyle({ weight: strokeWeight + 2, opacity: 0.95 });
        }
      });
      poly.on('mouseout', () => {
        if (!isSelected) {
          poly.setStyle({ weight: strokeWeight, opacity: strokeOpacity });
        }
      });

      polylinesLayerRef.current.addLayer(poly);

      if (isSelected) {
        poly.bringToFront();
      }
    });

    // 2. Render Corridor Weather Heatmap Overlay (underneath route line and markers)
    if (showHeatmap && selectedRoute?.checkpoints && selectedRoute.checkpoints.length > 0) {
      const heatPoints = [];
      const RISK_INTENSITY = {
        'Low': 0.18,
        'Moderate': 0.45,
        'High': 0.70,
        'Severe': 0.90,
        'No Travel': 1.00,
        'Unknown': 0.85,
      };

      selectedRoute.checkpoints.forEach((cp) => {
        if (!cp.coordinates || cp.coordinates.length < 2) return;
        const lon = Number(cp.coordinates[0]);
        const lat = Number(cp.coordinates[1]);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

        const activeData = getActiveCheckpointData(cp, timelineOffsetHours);
        const riskLevel = activeData.risk.overall_risk || (activeData.weather?.is_available === false ? 'Unknown' : 'Low');
        const intensity = RISK_INTENSITY[riskLevel] || 0.18;

        heatPoints.push([lat, lon, intensity]);
        heatPoints.push([lat + 0.005, lon + 0.005, intensity * 0.9]);
        heatPoints.push([lat - 0.005, lon - 0.005, intensity * 0.9]);
      });

      // Also add points along selectedLatLngs to create a continuous highway heat ribbon
      if (selectedLatLngs.length > 0) {
        const step = Math.max(Math.floor(selectedLatLngs.length / 40), 1);
        for (let i = 0; i < selectedLatLngs.length; i += step) {
          heatPoints.push([selectedLatLngs[i][0], selectedLatLngs[i][1], 0.25]);
        }
      }

      if (heatPoints.length > 0 && typeof L.heatLayer === 'function') {
        try {
          const heat = L.heatLayer(heatPoints, {
            radius: 32,
            blur: 24,
            maxZoom: 11,
            minOpacity: 0.38,
            max: 1.0,
            gradient: {
              0.15: '#10B981',
              0.40: '#F59E0B',
              0.65: '#F97316',
              0.85: '#EF4444',
              1.00: '#991B1B',
            },
          });
          heatmapLayerRef.current.addLayer(heat);
        } catch {
          // fallback to glow
        }
      }

      // Corridor highway underglow track
      if (selectedLatLngs.length > 0) {
        const glow = L.polyline(selectedLatLngs, {
          color: '#0d9488',
          weight: 16,
          opacity: 0.22,
          lineCap: 'round',
          lineJoin: 'round',
          interactive: false,
        });
        heatmapLayerRef.current.addLayer(glow);
      }
    }

    // 3. Draw checkpoints for selected route on top of heatmap and polylines
    if (selectedRoute?.checkpoints && selectedRoute.checkpoints.length > 0) {
      selectedRoute.checkpoints.forEach((cp) => {
        // If checkpoints are hidden, still display the Origin and Destination markers
        if (!showCheckpoints && !cp.is_origin && !cp.is_destination) {
          return;
        }

        if (!cp.coordinates || cp.coordinates.length < 2) return;
        const lon = Number(cp.coordinates[0]);
        const lat = Number(cp.coordinates[1]);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

        const marker = L.marker([lat, lon], {
          icon: createCheckpointIcon(cp, timelineOffsetHours),
          title: `Checkpoint ${cp.index}: ${cp.name} (${cp.cumulative_distance_miles} mi)`,
          riseOnHover: true,
        });

        marker.bindPopup(renderPopupHtml(cp, timelineOffsetHours), { maxWidth: 330 });
        markersLayerRef.current.addLayer(marker);
      });
    }

    // 4. Auto fit bounds
    if (selectedLatLngs.length > 0) {
      try {
        const bounds = L.latLngBounds(selectedLatLngs);
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      } catch (err) {
        console.warn('Could not fit bounds to selected route:', err);
      }
    } else if (allRoutesLatLngs.length > 0) {
      try {
        const bounds = L.latLngBounds(allRoutesLatLngs);
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      } catch (err) {
        console.warn('Could not fit bounds to all routes:', err);
      }
    }
  }, [routes, selectedRouteId, selectedRoute, onSelectRoute, timelineOffsetHours, showHeatmap, samplingIntervalMiles, visibleRoutes, showCheckpoints]);

  // Action: Zoom/Fit to selected route
  const handleFitSelectedRoute = () => {
    const map = mapInstanceRef.current;
    if (!map || !selectedRoute?.geometry?.coordinates) return;
    const coords = extractValidLatLngs(selectedRoute.geometry.coordinates);
    if (coords.length > 0) {
      map.fitBounds(L.latLngBounds(coords), { padding: [40, 40], maxZoom: 14 });
    }
  };

  // Action: Zoom/Fit all candidate routes simultaneously
  const handleFitAllRoutes = () => {
    const map = mapInstanceRef.current;
    if (!map || !routes || routes.length === 0) return;
    const allCoords = [];
    routes.forEach((rt) => {
      const pts = extractValidLatLngs(rt.geometry?.coordinates);
      pts.forEach((p) => allCoords.push(p));
    });
    if (allCoords.length > 0) {
      map.fitBounds(L.latLngBounds(allCoords), { padding: [40, 40], maxZoom: 14 });
    }
  };

  return (
    <div className="relative w-full h-[440px] sm:h-[480px] lg:h-[500px] rounded-xl overflow-hidden border border-slate-200/90 shadow-xs bg-slate-100 flex flex-col">
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Floating Layer Controls Panel (Top-Left) */}
      <div className="absolute top-3 left-3 z-[1000] bg-white/95 backdrop-blur-xs p-2.5 rounded-xl border border-slate-200/90 shadow-md text-xs space-y-2 min-w-[155px]">
        <div className="flex items-center justify-between border-b border-slate-100 pb-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Route Layers
          </span>
          <span className="text-[9.5px] font-mono text-slate-400">
            {routes.length} paths
          </span>
        </div>

        <div className="space-y-1">
          {routes.map((rt, idx) => {
            const isVisible = visibleRoutes[rt.id] !== false;
            const isSelected = rt.id === selectedRouteId;
            const color = ROUTE_COLORS[idx % ROUTE_COLORS.length];
            const letter = String.fromCharCode(65 + idx);

            return (
              <label
                key={rt.id}
                className={`flex items-center justify-between gap-2 px-1.5 py-1 rounded cursor-pointer select-none transition-colors ${
                  isSelected ? 'bg-blue-50/80 font-bold' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isVisible}
                    onChange={(e) =>
                      setVisibleRoutes((prev) => ({ ...prev, [rt.id]: e.target.checked }))
                    }
                    className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span
                    className="w-3.5 h-1.5 rounded-full inline-block shadow-2xs"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-[11.5px] text-slate-800">
                    Route {letter}
                  </span>
                </div>
                {rt.is_recommended && (
                  <span className="text-[9px] font-bold text-teal-700 bg-teal-50 px-1 py-0.2 rounded border border-teal-200">
                    ★ Rec
                  </span>
                )}
              </label>
            );
          })}
        </div>

        <div className="border-t border-slate-100 pt-1.5">
          <label className="flex items-center gap-2 px-1.5 py-0.5 rounded hover:bg-slate-50 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showCheckpoints}
              onChange={(e) => setShowCheckpoints(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
            />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block shadow-2xs" />
            <span className="text-[11px] font-medium text-slate-700">Checkpoints</span>
          </label>
        </div>
      </div>

      {/* Map Control Buttons (Top-Right) */}
      <div className="absolute top-3 right-3 z-[1000] flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setShowHeatmap(!showHeatmap)}
          title={showHeatmap ? 'Hide Corridor Heatmap' : 'Show Corridor Heatmap'}
          className={`px-2.5 py-1.5 rounded-lg border shadow-xs text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
            showHeatmap
              ? 'bg-teal-700 text-white border-teal-700 shadow-sm'
              : 'bg-white/95 hover:bg-white text-slate-700 border-slate-200'
          }`}
        >
          <Flame className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Heatmap</span>
        </button>

        <button
          type="button"
          onClick={handleFitSelectedRoute}
          title="Zoom to active route"
          className="px-2.5 py-1.5 rounded-lg bg-white/95 hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-200 shadow-xs text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
        >
          <ZoomIn className="w-3.5 h-3.5 text-blue-600" />
          <span className="hidden sm:inline">Active</span>
        </button>

        <button
          type="button"
          onClick={handleFitAllRoutes}
          title="Fit all routes in corridor"
          className="px-2.5 py-1.5 rounded-lg bg-white/95 hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-200 shadow-xs text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
        >
          <Maximize2 className="w-3.5 h-3.5 text-slate-600" />
          <span className="hidden sm:inline">All</span>
        </button>
      </div>

      {/* Floating Risk Legend Overlay (Bottom-Right) */}
      {showMapLegend && (
        <div className="absolute bottom-3 right-3 z-[1000] bg-white/95 backdrop-blur-xs px-3 py-2 rounded-xl border border-slate-200/90 shadow-md text-[11px] select-none">
          <div className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            Weather Risk Legend
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] inline-block shadow-2xs" />
              <span className="text-slate-600 text-[10.5px]">Low</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#0284c7] inline-block shadow-2xs" />
              <span className="text-slate-600 text-[10.5px]">Moderate</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b] inline-block shadow-2xs" />
              <span className="text-slate-600 text-[10.5px]">High</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#f97316] inline-block shadow-2xs" />
              <span className="text-slate-600 text-[10.5px]">Severe</span>
            </div>
            <div className="flex items-center gap-1">
              <span
                className="w-3 h-3 bg-[#e11d48] text-white flex items-center justify-center font-bold text-[7px] shadow-2xs"
                style={{
                  clipPath: 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)',
                }}
              >
                ✕
              </span>
              <span className="text-rose-700 font-bold text-[10.5px]">No Travel</span>
            </div>
          </div>
        </div>
      )}

      {/* Empty State Fallback if no routes exist */}
      {(!routes || routes.length === 0) && (
        <div className="absolute inset-0 z-[1000] bg-slate-50/90 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center space-y-2">
          <Navigation className="w-8 h-8 text-slate-400 animate-bounce" />
          <p className="font-bold text-slate-700 text-sm">No Route Geometry Loaded</p>
          <p className="text-xs text-slate-500 max-w-sm">
            Enter origin, destination, and cargo load, then click <strong>Plan Safe Route</strong> to view real road geometry and checkpoint weather risks.
          </p>
        </div>
      )}
    </div>
  );
}
