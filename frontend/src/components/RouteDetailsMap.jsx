import React, { useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ZoomIn, Maximize2, Layers } from 'lucide-react';

// Fix default Leaflet icon paths in bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const RISK_COLORS = {
  'Low': '#10B981',        // Emerald
  'Moderate': '#F59E0B',   // Amber / Yellow
  'High': '#F97316',       // Orange
  'Severe': '#EF4444',     // Red
  'No Travel': '#BE123C',  // Rose / Crimson
  'Unknown': '#7C3AED',    // Purple
};

/**
 * Validates and extracts [lat, lon] coordinates from geojson LineString coordinates [[lon, lat], ...].
 */
function extractValidLatLngs(coords) {
  if (!Array.isArray(coords)) return [];
  const valid = [];
  for (let i = 0; i < coords.length; i++) {
    const pt = coords[i];
    if (Array.isArray(pt) && pt.length >= 2) {
      const lon = Number(pt[0]);
      const lat = Number(pt[1]);
      if (Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
        valid.push([lat, lon]);
      }
    }
  }
  return valid;
}

/**
 * Creates custom div icon for checkpoint markers
 */
function createCheckpointMarkerIcon(checkpoint, isSelected) {
  const riskLevel = checkpoint?.risk?.overall_risk || 'Low';
  const color = RISK_COLORS[riskLevel] || '#10B981';
  const isNoTravel = riskLevel === 'No Travel';
  const isUnknown = riskLevel === 'Unknown' || checkpoint?.weather?.is_available === false;

  const size = isSelected ? 30 : 22;
  const halfSize = size / 2;

  if (isNoTravel) {
    return L.divIcon({
      className: 'custom-cp-marker',
      html: `
        <div style="position: relative; width: ${size}px; height: ${size}px;">
          ${isSelected ? `<div style="position: absolute; top: -6px; left: -6px; width: ${size + 12}px; height: ${size + 12}px; border-radius: 50%; background: #BE123C; opacity: 0.35; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>` : ''}
          <div style="width: ${size}px; height: ${size}px; background-color: #BE123C; color: white; clip-path: polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: ${isSelected ? '11px' : '9px'}; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.4);">
            ✕
          </div>
        </div>
      `,
      iconSize: [size, size],
      iconAnchor: [halfSize, halfSize],
      popupAnchor: [0, -halfSize - 4],
    });
  }

  if (isUnknown) {
    return L.divIcon({
      className: 'custom-cp-marker',
      html: `
        <div style="position: relative; width: ${size}px; height: ${size}px;">
          ${isSelected ? `<div style="position: absolute; top: -5px; left: -5px; width: ${size + 10}px; height: ${size + 10}px; border-radius: 50%; background: #7C3AED; opacity: 0.35;"></div>` : ''}
          <div style="width: ${size}px; height: ${size}px; background-color: #7C3AED; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: ${isSelected ? '11px' : '9px'}; border: 2px dashed #EDE9FE; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">
            ?
          </div>
        </div>
      `,
      iconSize: [size, size],
      iconAnchor: [halfSize, halfSize],
      popupAnchor: [0, -halfSize - 4],
    });
  }

  return L.divIcon({
    className: 'custom-cp-marker',
    html: `
      <div style="position: relative; width: ${size}px; height: ${size}px;">
        ${isSelected ? `<div style="position: absolute; top: -5px; left: -5px; width: ${size + 10}px; height: ${size + 10}px; border-radius: 50%; background: ${color}; opacity: 0.35;"></div>` : ''}
        <div style="width: ${size}px; height: ${size}px; background-color: ${color}; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: ${isSelected ? '11px' : '9px'}; border: ${isSelected ? '2.5px solid white' : '1.5px solid white'}; box-shadow: 0 2px 5px rgba(0,0,0,0.35);">
          ${checkpoint.index}
        </div>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [halfSize, halfSize],
    popupAnchor: [0, -halfSize - 4],
  });
}

/**
 * Creates Start & Destination city pin markers
 */
function createCityPinIcon(cityName, isDestination = false) {
  const bg = isDestination ? '#EF4444' : '#10B981';
  const label = cityName ? cityName.split(',')[0].trim() : (isDestination ? 'Destination' : 'Origin');
  return L.divIcon({
    className: 'custom-city-pin',
    html: `
      <div style="display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%);">
        <div style="background: white; border: 1.5px solid ${bg}; color: #0F172A; font-weight: 800; font-size: 11px; padding: 2px 7px; border-radius: 6px; box-shadow: 0 2px 6px rgba(0,0,0,0.25); white-space: nowrap; margin-bottom: 2px;">
          ${label}
        </div>
        <div style="width: 14px; height: 14px; background: ${bg}; border: 2.5px solid white; border-radius: 50%; box-shadow: 0 2px 5px rgba(0,0,0,0.35);"></div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

/**
 * Generates rich HTML popup content matching route_Details.png design
 */
function renderDetailsPopupHtml(checkpoint) {
  const w = checkpoint.weather || {};
  const r = checkpoint.risk || {};
  const conditions = r.conditions || {};
  const windRisk = conditions.wind?.risk || 'Low';
  const rainRisk = conditions.rain?.risk || 'Low';
  const snowRisk = conditions.snow?.risk || 'Low';
  const overallRisk = r.overall_risk || 'Low';

  let etaFormatted = '—';
  if (checkpoint.estimated_arrival_time) {
    try {
      const d = new Date(checkpoint.estimated_arrival_time);
      etaFormatted = d.toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      });
      // Try to append timezone abbreviation if possible
      const tzMatch = checkpoint.estimated_arrival_time.match(/([+-]\d{2}:\d{2}|Z)$/);
      if (tzMatch) {
        etaFormatted += ` (${tzMatch[0]})`;
      }
    } catch {
      etaFormatted = checkpoint.estimated_arrival_time;
    }
  }

  const riskColor = RISK_COLORS[overallRisk] || '#10B981';

  return `
    <div style="font-family: inherit; font-size: 12px; line-height: 1.4; color: #1E293B; min-width: 190px; padding: 2px;">
      <div style="font-weight: 800; font-size: 13.5px; color: #0F172A; margin-bottom: 2px;">
        ${checkpoint.name || `Checkpoint ${checkpoint.index}`}
      </div>
      <div style="color: #64748B; font-size: 11px; margin-bottom: 6px;">
        ${checkpoint.cumulative_distance_miles} miles from start<br/>
        <strong>ETA:</strong> ${etaFormatted}
      </div>

      <div style="border-top: 1px solid #E2E8F0; padding-top: 5px; margin-bottom: 5px; font-size: 11.5px; space-y: 2px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px;">
          <span style="color: #475569;">💨 Wind:</span>
          <strong>${w.wind_speed_mph !== undefined ? `${w.wind_speed_mph} mph` : '—'} <span style="font-size: 10px; color: ${RISK_COLORS[windRisk] || '#475569'};">(${windRisk})</span></strong>
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px;">
          <span style="color: #475569;">🌧 Rain:</span>
          <strong>${w.precipitation_in_hr !== undefined ? `${w.precipitation_in_hr} in/hr` : '—'} <span style="font-size: 10px; color: ${RISK_COLORS[rainRisk] || '#475569'};">(${rainRisk})</span></strong>
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
          <span style="color: #475569;">❄ Snow:</span>
          <strong>${w.snowfall_in_hr !== undefined ? `${w.snowfall_in_hr} in/hr` : '—'} <span style="font-size: 10px; color: ${RISK_COLORS[snowRisk] || '#475569'};">(${snowRisk})</span></strong>
        </div>
      </div>

      <div style="border-top: 1px solid #E2E8F0; padding-top: 5px; text-align: center;">
        <span style="font-weight: 800; font-size: 12px; color: ${riskColor};">
          Overall Risk: ${overallRisk}
        </span>
      </div>
    </div>
  `;
}

export default function RouteDetailsMap({
  route,
  trip = {},
  selectedCheckpointId,
  onSelectCheckpoint,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const polylineLayerRef = useRef(null);
  const markersLayerRef = useRef(null);
  const pinsLayerRef = useRef(null);
  const markerByCpIndexRef = useRef({});

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [39.9526, -75.1652],
      zoom: 7,
      scrollWheelZoom: true,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    }).addTo(map);

    polylineLayerRef.current = L.layerGroup().addTo(map);
    markersLayerRef.current = L.layerGroup().addTo(map);
    pinsLayerRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;

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

  // Update Geometry, Checkpoints, and Start/End Pins
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !route) return;

    if (polylineLayerRef.current) polylineLayerRef.current.clearLayers();
    if (markersLayerRef.current) markersLayerRef.current.clearLayers();
    if (pinsLayerRef.current) pinsLayerRef.current.clearLayers();
    markerByCpIndexRef.current = {};

    const coords = extractValidLatLngs(route.geometry?.coordinates);
    if (coords.length > 0) {
      // Draw Polyline
      const poly = L.polyline(coords, {
        color: '#2563EB',
        weight: 5,
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round',
      });
      polylineLayerRef.current.addLayer(poly);

      // Start Pin
      const startPt = coords[0];
      const originName = trip.origin?.display_name || trip.origin || 'Origin';
      const startMarker = L.marker(startPt, {
        icon: createCityPinIcon(originName, false),
        interactive: false,
      });
      pinsLayerRef.current.addLayer(startMarker);

      // Destination Pin
      const destPt = coords[coords.length - 1];
      const destName = trip.destination?.display_name || trip.destination || 'Destination';
      const destMarker = L.marker(destPt, {
        icon: createCityPinIcon(destName, true),
        interactive: false,
      });
      pinsLayerRef.current.addLayer(destMarker);

      try {
        map.fitBounds(L.latLngBounds(coords), { padding: [40, 40], maxZoom: 13 });
      } catch (err) {
        console.warn('Could not fit map bounds:', err);
      }
    }

    // Draw Checkpoint Markers
    const checkpoints = route.checkpoints || [];
    checkpoints.forEach((cp) => {
      if (!cp.coordinates || cp.coordinates.length < 2) return;
      const lon = Number(cp.coordinates[0]);
      const lat = Number(cp.coordinates[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

      const isSelected = cp.index === selectedCheckpointId;
      const marker = L.marker([lat, lon], {
        icon: createCheckpointMarkerIcon(cp, isSelected),
        riseOnHover: true,
      });

      marker.bindPopup(renderDetailsPopupHtml(cp), {
        maxWidth: 260,
        className: 'route-details-popup',
      });

      marker.on('click', () => {
        if (onSelectCheckpoint) onSelectCheckpoint(cp.index);
      });

      markersLayerRef.current.addLayer(marker);
      markerByCpIndexRef.current[cp.index] = marker;

      // If initially selected, open its popup
      if (isSelected) {
        marker.openPopup();
      }
    });
  }, [route, trip]);

  // Synchronize Active Checkpoint Marker selection & popup
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !route?.checkpoints) return;

    route.checkpoints.forEach((cp) => {
      const marker = markerByCpIndexRef.current[cp.index];
      if (!marker) return;

      const isSelected = cp.index === selectedCheckpointId;
      marker.setIcon(createCheckpointMarkerIcon(cp, isSelected));

      if (isSelected) {
        marker.openPopup();
        // Center gently on the selected checkpoint
        if (cp.coordinates && cp.coordinates.length >= 2) {
          const lon = Number(cp.coordinates[0]);
          const lat = Number(cp.coordinates[1]);
          if (Number.isFinite(lat) && Number.isFinite(lon)) {
            map.panTo([lat, lon], { animate: true, duration: 0.6 });
          }
        }
      }
    });
  }, [selectedCheckpointId, route]);

  // Zoom / Fit Helpers
  const handleFitRoute = () => {
    const map = mapInstanceRef.current;
    if (!map || !route?.geometry?.coordinates) return;
    const coords = extractValidLatLngs(route.geometry.coordinates);
    if (coords.length > 0) {
      map.fitBounds(L.latLngBounds(coords), { padding: [40, 40], maxZoom: 13 });
    }
  };

  return (
    <div className="relative w-full h-[380px] sm:h-[440px] lg:h-[460px] rounded-xl overflow-hidden border border-slate-200/90 shadow-xs bg-slate-100 flex flex-col">
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Map Control Buttons (Top-Right) */}
      <div className="absolute top-3 right-3 z-[1000] flex items-center gap-1.5">
        <button
          type="button"
          onClick={handleFitRoute}
          title="Fit route in view"
          className="p-2 rounded-lg bg-white/95 hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-200 shadow-xs text-xs font-semibold flex items-center transition cursor-pointer"
        >
          <Maximize2 className="w-3.5 h-3.5 text-slate-600" />
        </button>
      </div>

      {/* Floating Risk Legend (Bottom-Center) */}
      <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 z-[1000] bg-white/95 backdrop-blur-xs px-3.5 py-1.5 rounded-full border border-slate-200 shadow-md text-xs select-none">
        <div className="flex items-center gap-3 text-[11px] font-medium text-slate-700">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] inline-block shadow-2xs" />
            <span>Low</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B] inline-block shadow-2xs" />
            <span>Moderate</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#F97316] inline-block shadow-2xs" />
            <span>High</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444] inline-block shadow-2xs" />
            <span>Severe</span>
          </div>
          <div className="flex items-center gap-1">
            <span
              className="w-2.5 h-2.5 bg-[#BE123C] inline-block shadow-2xs"
              style={{ clipPath: 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)' }}
            />
            <span className="text-rose-700 font-bold">No Travel</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#7C3AED] inline-block shadow-2xs" />
            <span>Unknown</span>
          </div>
        </div>
      </div>
    </div>
  );
}
