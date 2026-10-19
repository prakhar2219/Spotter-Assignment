import React, { useEffect, useRef, useMemo, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { RISK_LEVELS } from './RiskLegend';
import { Navigation, ZoomIn, Maximize2, Layers, Flame, Clock } from 'lucide-react';

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

  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showMapLegend, setShowMapLegend] = useState(true);

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

    // 1. Draw each route polyline
    routes.forEach((rt) => {
      const isSelected = rt.id === selectedRouteId;
      const isRecommended = rt.is_recommended;
      const coords = extractValidLatLngs(rt.geometry?.coordinates);
      if (coords.length === 0) return;

      coords.forEach((pt) => allRoutesLatLngs.push(pt));

      if (isSelected) {
        selectedLatLngs = coords;
      }

      let strokeColor = '#94a3b8';
      let strokeWeight = 3.5;
      let strokeOpacity = 0.55;
      let dashPattern = '6, 8';

      if (isSelected && isRecommended) {
        strokeColor = '#0d9488'; // Vibrant teal
        strokeWeight = 6;
        strokeOpacity = 0.95;
        dashPattern = undefined;
      } else if (isSelected && !isRecommended) {
        strokeColor = '#0284c7'; // Sky/Blue
        strokeWeight = 5.5;
        strokeOpacity = 0.95;
        dashPattern = undefined;
      } else if (!isSelected && isRecommended) {
        strokeColor = '#059669'; // Distinct Emerald for unselected recommended route
        strokeWeight = 4.5;
        strokeOpacity = 0.85;
        dashPattern = undefined;
      }

      const poly = L.polyline(coords, {
        color: strokeColor,
        weight: strokeWeight,
        opacity: strokeOpacity,
        dashArray: dashPattern,
        lineCap: 'round',
        lineJoin: 'round',
      });

      // Tooltip to identify route on hover
      const badgeHtml = isRecommended
        ? '<span style="background: #fef3c7; color: #92400e; font-size: 10px; font-weight: bold; padding: 1px 5px; border-radius: 3px; margin-left: 6px;">★ RECOMMENDED</span>'
        : '';
      const tooltipText = `
        <div style="font-family: inherit; font-size: 11px;">
          <strong>${rt.name}</strong> ${badgeHtml}<br/>
          <span style="color: #64748b; font-family: monospace;">${rt.distance_miles} mi &bull; ${rt.duration_formatted}</span>
          ${!isSelected ? '<span style="display: block; color: #0d9488; font-size: 10px; margin-top: 2px;">Click to select this route</span>' : ''}
        </div>
      `;
      poly.bindTooltip(tooltipText, { sticky: true });

      poly.on('click', () => {
        if (onSelectRoute) onSelectRoute(rt.id);
      });

      poly.on('mouseover', () => {
        if (!isSelected) {
          poly.setStyle({ weight: strokeWeight + 2, opacity: 0.9 });
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
      // Dynamic halo radius matching corridor sampling interval (approx 80% of interval in meters)
      const haloRadius = Math.max((samplingIntervalMiles || 25) * 1609.34 * 0.85, 22000);

      selectedRoute.checkpoints.forEach((cp) => {
        if (!cp.coordinates || cp.coordinates.length < 2) return;
        const lon = Number(cp.coordinates[0]);
        const lat = Number(cp.coordinates[1]);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

        const activeData = getActiveCheckpointData(cp, timelineOffsetHours);
        const riskLevel = activeData.risk.overall_risk || (activeData.weather?.is_available === false ? 'Unknown' : 'Low');
        const riskInfo = RISK_LEVELS[riskLevel] || RISK_LEVELS['Low'];
        const isNoTravel = activeData.risk.is_no_travel || riskLevel === 'No Travel';
        const isUnknown = riskLevel === 'Unknown' || activeData.weather?.is_available === false;

        let fillColor = riskInfo.color || '#10b981';
        let fillOpacity = 0.22;
        let stroke = false;
        let weight = 0;
        let dashArray = undefined;

        if (riskLevel === 'Moderate') {
          fillOpacity = 0.32;
        } else if (riskLevel === 'High') {
          fillOpacity = 0.44;
          stroke = true;
          weight = 1;
        } else if (riskLevel === 'Severe') {
          fillOpacity = 0.58;
          stroke = true;
          weight = 1.5;
          dashArray = '4, 4';
        } else if (isNoTravel) {
          fillColor = '#be123c';
          fillOpacity = 0.70;
          stroke = true;
          weight = 2;
        } else if (isUnknown) {
          fillColor = '#7c3aed';
          fillOpacity = 0.30;
          stroke = true;
          weight = 1.5;
          dashArray = '3, 4';
        }

        const halo = L.circle([lat, lon], {
          radius: haloRadius,
          fillColor: fillColor,
          fillOpacity: fillOpacity,
          color: fillColor,
          weight: weight,
          stroke: stroke,
          dashArray: dashArray,
          interactive: false,
        });

        heatmapLayerRef.current.addLayer(halo);
      });

      // Corridor highway underglow track
      if (selectedLatLngs.length > 0) {
        const glow = L.polyline(selectedLatLngs, {
          color: '#0d9488',
          weight: 18,
          opacity: 0.18,
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
  }, [routes, selectedRouteId, selectedRoute, onSelectRoute, timelineOffsetHours, showHeatmap, samplingIntervalMiles]);

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
    <div className="relative w-full h-[470px] sm:h-[510px] lg:h-[550px] rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100 flex flex-col">
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Floating Active Route & Timeline Badge (Top-Left) */}
      <div className="absolute top-3 left-3 z-[1000] bg-white/95 backdrop-blur-xs px-3 py-1.5 rounded-lg border border-slate-200 shadow-xs flex items-center gap-2 text-xs">
        <Navigation className="w-3.5 h-3.5 text-teal-600" />
        <span className="font-bold text-slate-900 truncate max-w-[180px] sm:max-w-[260px]">
          {selectedRoute?.name || 'Corridor Route'}
        </span>
        {selectedRoute?.is_recommended && (
          <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-200">
            ★ Recommended
          </span>
        )}
        {timelineOffsetHours > 0 ? (
          <span className="px-1.5 py-0.2 rounded bg-teal-50 text-teal-800 text-[10px] font-bold border border-teal-200 font-mono">
            +{timelineOffsetHours}h Snapshot
          </span>
        ) : (
          <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
            (ETA-Aware View)
          </span>
        )}
      </div>

      {/* Map Control Buttons: Fit Active / Fit All / Heatmap Toggle / Legend (Top-Right) */}
      <div className="absolute top-3 right-3 z-[1000] flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setShowHeatmap(!showHeatmap)}
          title={showHeatmap ? 'Hide Corridor Heatmap' : 'Show Corridor Heatmap'}
          className={`px-2.5 py-1.5 rounded-lg border shadow-xs text-xs font-semibold flex items-center gap-1 transition ${
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
          className="px-2.5 py-1.5 rounded-lg bg-white/95 hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-200 shadow-xs text-xs font-semibold flex items-center gap-1 transition"
        >
          <ZoomIn className="w-3.5 h-3.5 text-teal-600" />
          <span className="hidden sm:inline">Active</span>
        </button>

        <button
          type="button"
          onClick={handleFitAllRoutes}
          title="Fit all routes in corridor"
          className="px-2.5 py-1.5 rounded-lg bg-white/95 hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-200 shadow-xs text-xs font-semibold flex items-center gap-1 transition"
        >
          <Maximize2 className="w-3.5 h-3.5 text-slate-600" />
          <span className="hidden sm:inline">All</span>
        </button>

        <button
          type="button"
          onClick={() => setShowMapLegend(!showMapLegend)}
          title="Toggle on-map legend"
          className={`p-1.5 rounded-lg border shadow-xs transition ${
            showMapLegend
              ? 'bg-teal-50 border-teal-300 text-teal-700'
              : 'bg-white/95 border-slate-200 text-slate-600'
          }`}
        >
          <Layers className="w-4 h-4" />
        </button>
      </div>

      {/* Floating On-Map Mini Legend & Heatmap Documentation (Bottom-Left) */}
      {showMapLegend && (
        <div className="absolute bottom-3 left-3 z-[1000] bg-white/95 backdrop-blur-xs p-2.5 rounded-lg border border-slate-200 shadow-xs text-[11px] space-y-1.5 max-w-[300px]">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1">
            <span className="font-bold text-slate-800 text-[10.5px] uppercase tracking-wider flex items-center gap-1">
              <Layers className="w-3 h-3 text-teal-600" /> Map & Heatmap Legend
            </span>
            <span className="text-[9.5px] text-slate-400 font-mono">Accessible</span>
          </div>

          <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-slate-600">
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-1 bg-teal-600 inline-block rounded" />
              <span>Active Route</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-1 bg-emerald-600 inline-block rounded" />
              <span>Recommended</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 border-t border-dashed border-slate-400 inline-block" />
              <span>Alternatives</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block border border-white" />
              <span>Low (0)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block border border-white" />
              <span>Moderate (1)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block border border-white" />
              <span>High (2)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block border border-white" />
              <span>Severe (3)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="w-3 h-3 bg-rose-600 text-white font-bold text-[8px] flex items-center justify-center rounded-xs"
                style={{
                  clipPath: 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)',
                }}
              >
                ✕
              </span>
              <strong className="text-rose-700">No Travel (4)</strong>
            </div>
            <div className="flex items-center gap-1.5 col-span-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-600 text-white font-bold text-[7px] flex items-center justify-center border border-dashed border-purple-300">
                ?
              </span>
              <span className="text-purple-800">Unknown (Forecast Missing)</span>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-1 text-[9.5px] text-slate-500 italic">
            Heatmap: Corridor risk buffer halos derived from checkpoint forecasts.
          </div>
        </div>
      )}

      {/* Empty State Fallback if no routes exist */}
      {(!routes || routes.length === 0) && (
        <div className="absolute inset-0 z-[1000] bg-slate-50/90 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center space-y-2">
          <Navigation className="w-8 h-8 text-slate-400 animate-bounce" />
          <p className="font-bold text-slate-700 text-sm">No Route Geometry Loaded</p>
          <p className="text-xs text-slate-500 max-w-sm">
            Enter origin, destination, and cargo load above, then click <strong>Plan Safe Route</strong> to view real road geometry and checkpoint weather risks.
          </p>
        </div>
      )}
    </div>
  );
}
