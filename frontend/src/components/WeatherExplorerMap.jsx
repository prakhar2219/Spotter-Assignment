import React, { useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ZoomIn, Maximize2, Layers, Wind, CloudRain, Snowflake, ShieldAlert } from 'lucide-react';

// Fix Leaflet marker icons in Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const RISK_COLORS = {
  'Low': '#10B981',        // Emerald
  'Moderate': '#F59E0B',   // Amber
  'High': '#F97316',       // Orange
  'Severe': '#EF4444',     // Red
  'No Travel': '#BE123C',  // Crimson
  'Unknown': '#7C3AED',    // Purple
};

/**
 * Returns weather data at a specific timeline offset (0-48h) for a checkpoint
 */
export function getCheckpointTimelineData(checkpoint, offsetHours) {
  if (Array.isArray(checkpoint?.hourly_forecasts) && checkpoint.hourly_forecasts.length > 0) {
    const hourly = checkpoint.hourly_forecasts.find((h) => h.offset_hours === offsetHours);
    if (hourly) {
      return {
        isTimeline: true,
        offsetHours,
        forecastTime: hourly.forecast_time || hourly.target_time,
        targetTime: hourly.target_time,
        wind_speed_mph: hourly.wind_speed_mph !== undefined ? hourly.wind_speed_mph : 0,
        precipitation_in_hr: hourly.precipitation_in_hr !== undefined ? hourly.precipitation_in_hr : 0,
        snowfall_in_hr: hourly.snowfall_in_hr !== undefined ? hourly.snowfall_in_hr : 0,
        temperature_f: hourly.temperature_f,
        weather_code: hourly.weather_code,
        overall_risk: hourly.overall_risk || 'Low',
        overall_score: hourly.overall_score !== undefined ? hourly.overall_score : 0,
        governing_factor: hourly.governing_factor || '',
        is_no_travel: hourly.is_no_travel || false,
        is_available: hourly.is_available !== false,
      };
    }
  }

  // Fallback to primary ETA weather
  const w = checkpoint?.weather || {};
  const r = checkpoint?.risk || {};
  return {
    isTimeline: false,
    offsetHours: 0,
    forecastTime: w.forecast_time,
    targetTime: checkpoint?.estimated_arrival_time,
    wind_speed_mph: w.wind_speed_mph !== undefined ? w.wind_speed_mph : 0,
    precipitation_in_hr: w.precipitation_in_hr !== undefined ? w.precipitation_in_hr : 0,
    snowfall_in_hr: w.snowfall_in_hr !== undefined ? w.snowfall_in_hr : 0,
    temperature_f: w.temperature_f,
    weather_code: w.weather_code,
    overall_risk: r.overall_risk || 'Low',
    overall_score: r.overall_score !== undefined ? r.overall_score : 0,
    governing_factor: r.governing_factor || '',
    is_no_travel: r.is_no_travel || false,
    is_available: w.is_available !== false,
  };
}

/**
 * Returns color representation for a checkpoint based on the active weather layer
 */
function getLayerColor(data, activeLayer) {
  if (!data.is_available) return '#7C3AED';

  if (activeLayer === 'wind') {
    const w = data.wind_speed_mph || 0;
    if (w < 15) return '#10B981';
    if (w < 25) return '#0EA5E9';
    if (w < 35) return '#F59E0B';
    if (w < 45) return '#F97316';
    return '#BE123C';
  }

  if (activeLayer === 'rain') {
    const r = data.precipitation_in_hr || 0;
    if (r <= 0.01) return '#10B981';
    if (r < 0.1) return '#0EA5E9';
    if (r < 0.25) return '#F59E0B';
    if (r < 0.5) return '#F97316';
    return '#BE123C';
  }

  if (activeLayer === 'snow') {
    const s = data.snowfall_in_hr || 0;
    if (s <= 0.0) return '#10B981';
    if (s < 0.1) return '#06B6D4';
    if (s < 0.3) return '#3B82F6';
    if (s < 0.6) return '#8B5CF6';
    return '#BE123C';
  }

  // Default: overall risk
  return RISK_COLORS[data.overall_risk] || '#10B981';
}

/**
 * Creates custom div icon for checkpoint markers in Weather Explorer
 */
function createExplorerMarkerIcon(checkpoint, data, activeLayer, isSelected) {
  const color = getLayerColor(data, activeLayer);
  const isNoTravel = data.is_no_travel || data.overall_risk === 'No Travel';
  const size = isSelected ? 28 : 20;
  const half = size / 2;

  if (isNoTravel && activeLayer === 'overall') {
    return L.divIcon({
      className: 'custom-weather-marker',
      html: `
        <div style="position: relative; width: ${size}px; height: ${size}px;">
          ${isSelected ? `<div style="position: absolute; top: -6px; left: -6px; width: ${size + 12}px; height: ${size + 12}px; border-radius: 50%; background: #BE123C; opacity: 0.35; animation: ping 1.5s infinite;"></div>` : ''}
          <div style="width: ${size}px; height: ${size}px; background-color: #BE123C; color: white; clip-path: polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: ${isSelected ? '10px' : '8px'}; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.4);">
            ✕
          </div>
        </div>
      `,
      iconSize: [size, size],
      iconAnchor: [half, half],
      popupAnchor: [0, -half - 4],
    });
  }

  return L.divIcon({
    className: 'custom-weather-marker',
    html: `
      <div style="position: relative; width: ${size}px; height: ${size}px;">
        ${isSelected ? `<div style="position: absolute; top: -5px; left: -5px; width: ${size + 10}px; height: ${size + 10}px; border-radius: 50%; background: ${color}; opacity: 0.35;"></div>` : ''}
        <div style="width: ${size}px; height: ${size}px; background-color: ${color}; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: ${isSelected ? '10px' : '8.5px'}; border: ${isSelected ? '2.5px solid white' : '1.5px solid white'}; box-shadow: 0 2px 5px rgba(0,0,0,0.35);">
          ${checkpoint.index}
        </div>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [half, half],
    popupAnchor: [0, -half - 4],
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

export default function WeatherExplorerMap({
  route,
  trip = {},
  timelineOffsetHours = 0,
  activeLayer = 'overall',
  setActiveLayer,
  selectedCheckpointId,
  onSelectCheckpoint,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const polylineLayerRef = useRef(null);
  const heatmapLayerRef = useRef(null);
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

    heatmapLayerRef.current = L.layerGroup().addTo(map);
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

  // Synchronize Route Geometry, Heatmap, and Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !route) return;

    if (heatmapLayerRef.current) heatmapLayerRef.current.clearLayers();
    if (polylineLayerRef.current) polylineLayerRef.current.clearLayers();
    if (markersLayerRef.current) markersLayerRef.current.clearLayers();
    if (pinsLayerRef.current) pinsLayerRef.current.clearLayers();
    markerByCpIndexRef.current = {};

    const coords = extractValidLatLngs(route.geometry?.coordinates);
    if (coords.length > 0) {
      // 1. Draw Route Polyline
      const poly = L.polyline(coords, {
        color: '#2563EB',
        weight: 5,
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round',
      });
      polylineLayerRef.current.addLayer(poly);

      // Start & Dest City Pins
      const originName = trip.origin?.display_name || trip.origin || 'Origin';
      const destName = trip.destination?.display_name || trip.destination || 'Destination';

      const startMarker = L.marker(coords[0], {
        icon: createCityPinIcon(originName, false),
        interactive: false,
      });
      pinsLayerRef.current.addLayer(startMarker);

      const destMarker = L.marker(coords[coords.length - 1], {
        icon: createCityPinIcon(destName, true),
        interactive: false,
      });
      pinsLayerRef.current.addLayer(destMarker);
    }

    // 2. Render Corridor Weather Heatmap Halos
    const checkpoints = route.checkpoints || [];
    const haloRadius = Math.max((trip.sampling_interval_miles || 25) * 1609.34 * 0.9, 24000);

    checkpoints.forEach((cp) => {
      if (!cp.coordinates || cp.coordinates.length < 2) return;
      const lon = Number(cp.coordinates[0]);
      const lat = Number(cp.coordinates[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

      const data = getCheckpointTimelineData(cp, timelineOffsetHours);
      const color = getLayerColor(data, activeLayer);

      const halo = L.circle([lat, lon], {
        radius: haloRadius,
        fillColor: color,
        fillOpacity: 0.35,
        color: color,
        weight: 0,
        interactive: false,
      });
      heatmapLayerRef.current.addLayer(halo);

      // 3. Render Checkpoint Markers
      const isSelected = cp.index === selectedCheckpointId;
      const marker = L.marker([lat, lon], {
        icon: createExplorerMarkerIcon(cp, data, activeLayer, isSelected),
        riseOnHover: true,
      });

      // Rich Tooltip matching Panel 3 "Checkpoint Tooltip"
      let etaFormatted = '—';
      if (cp.estimated_arrival_time) {
        try {
          etaFormatted = new Date(cp.estimated_arrival_time).toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit',
          });
        } catch {
          etaFormatted = cp.estimated_arrival_time;
        }
      }

      const popupHtml = `
        <div style="font-family: inherit; font-size: 11.5px; line-height: 1.4; color: #1E293B; min-width: 175px;">
          <div style="font-weight: 800; font-size: 13px; color: #0F172A; margin-bottom: 2px;">
            Checkpoint ${cp.index}
          </div>
          <div style="color: #64748B; font-size: 11px; margin-bottom: 4px;">
            Distance: ${Math.round(cp.cumulative_distance_miles || 0)} miles<br/>
            ETA: ${etaFormatted}
          </div>
          <div style="border-top: 1px solid #E2E8F0; padding-top: 4px; margin-bottom: 4px;">
            <div>💨 Wind: <strong>${data.wind_speed_mph} mph</strong></div>
            <div>🌧 Rain: <strong>${data.precipitation_in_hr} in/hr</strong></div>
            <div>❄ Snow: <strong>${data.snowfall_in_hr} in/hr</strong></div>
          </div>
          <div style="border-top: 1px solid #E2E8F0; padding-top: 3px; font-weight: 800; color: ${color};">
            Overall Risk: ${data.overall_risk}
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml, { maxWidth: 240 });
      marker.on('click', () => {
        if (onSelectCheckpoint) onSelectCheckpoint(cp.index);
      });

      markersLayerRef.current.addLayer(marker);
      markerByCpIndexRef.current[cp.index] = marker;

      if (isSelected) {
        marker.openPopup();
      }
    });

    if (coords.length > 0) {
      try {
        map.fitBounds(L.latLngBounds(coords), { padding: [40, 40], maxZoom: 13 });
      } catch (err) {
        console.warn('Could not fit map bounds:', err);
      }
    }
  }, [route, trip, timelineOffsetHours, activeLayer]);

  // Handle active marker updates when selectedCheckpointId changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !route?.checkpoints) return;

    route.checkpoints.forEach((cp) => {
      const marker = markerByCpIndexRef.current[cp.index];
      if (!marker) return;

      const data = getCheckpointTimelineData(cp, timelineOffsetHours);
      const isSelected = cp.index === selectedCheckpointId;
      marker.setIcon(createExplorerMarkerIcon(cp, data, activeLayer, isSelected));

      if (isSelected) {
        marker.openPopup();
        if (cp.coordinates && cp.coordinates.length >= 2) {
          const lon = Number(cp.coordinates[0]);
          const lat = Number(cp.coordinates[1]);
          if (Number.isFinite(lat) && Number.isFinite(lon)) {
            map.panTo([lat, lon], { animate: true, duration: 0.5 });
          }
        }
      }
    });
  }, [selectedCheckpointId, timelineOffsetHours, activeLayer, route]);

  const handleFitRoute = () => {
    const map = mapInstanceRef.current;
    if (!map || !route?.geometry?.coordinates) return;
    const coords = extractValidLatLngs(route.geometry.coordinates);
    if (coords.length > 0) {
      map.fitBounds(L.latLngBounds(coords), { padding: [40, 40], maxZoom: 13 });
    }
  };

  return (
    <div className="relative w-full h-[480px] sm:h-[520px] lg:h-[550px] rounded-2xl overflow-hidden border border-slate-200/90 shadow-xs bg-slate-100 flex flex-col">
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Floating Weather Layers Control Panel (Top-Left) */}
      <div className="absolute top-3 left-3 z-[1000] bg-white/95 backdrop-blur-xs p-3 rounded-xl border border-slate-200 shadow-md text-xs space-y-2 min-w-[150px] select-none">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block border-b border-slate-100 pb-1">
          Weather Layers
        </span>

        <div className="space-y-1.5">
          <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded transition">
            <input
              type="radio"
              name="weatherLayer"
              checked={activeLayer === 'overall'}
              onChange={() => setActiveLayer('overall')}
              className="text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
            />
            <span className="font-semibold text-slate-800 text-[11.5px]">Overall Risk</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded transition">
            <input
              type="radio"
              name="weatherLayer"
              checked={activeLayer === 'wind'}
              onChange={() => setActiveLayer('wind')}
              className="text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
            />
            <span className="font-medium text-slate-700 text-[11.5px] flex items-center gap-1.5">
              <Wind className="w-3 h-3 text-sky-600" /> Wind Speed
            </span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded transition">
            <input
              type="radio"
              name="weatherLayer"
              checked={activeLayer === 'rain'}
              onChange={() => setActiveLayer('rain')}
              className="text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
            />
            <span className="font-medium text-slate-700 text-[11.5px] flex items-center gap-1.5">
              <CloudRain className="w-3 h-3 text-blue-600" /> Rainfall
            </span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded transition">
            <input
              type="radio"
              name="weatherLayer"
              checked={activeLayer === 'snow'}
              onChange={() => setActiveLayer('snow')}
              className="text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
            />
            <span className="font-medium text-slate-700 text-[11.5px] flex items-center gap-1.5">
              <Snowflake className="w-3 h-3 text-cyan-600" /> Snowfall
            </span>
          </label>
        </div>
      </div>

      {/* Map Control Button (Top-Right) */}
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

      {/* Floating Dynamic Legend (Bottom-Center or Bottom-Left) */}
      <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 z-[1000] bg-white/95 backdrop-blur-xs px-4 py-2 rounded-xl border border-slate-200 shadow-md text-xs select-none max-w-sm">
        {activeLayer === 'overall' && (
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
        )}

        {activeLayer === 'wind' && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-600">
              <span>Wind Speed (mph)</span>
            </div>
            <div
              className="h-2 rounded-full w-56 shadow-2xs"
              style={{
                background: 'linear-gradient(to right, #10B981 0%, #0EA5E9 25%, #F59E0B 50%, #F97316 75%, #BE123C 100%)',
              }}
            />
            <div className="flex items-center justify-between text-[9px] font-mono text-slate-500">
              <span>0</span>
              <span>10</span>
              <span>20</span>
              <span>30</span>
              <span>40</span>
              <span>50</span>
              <span>60+</span>
            </div>
          </div>
        )}

        {activeLayer === 'rain' && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-600">
              <span>Rainfall Rate (in/hr)</span>
            </div>
            <div
              className="h-2 rounded-full w-56 shadow-2xs"
              style={{
                background: 'linear-gradient(to right, #10B981 0%, #0EA5E9 25%, #F59E0B 55%, #F97316 80%, #BE123C 100%)',
              }}
            />
            <div className="flex items-center justify-between text-[9px] font-mono text-slate-500">
              <span>0.0</span>
              <span>0.1</span>
              <span>0.2</span>
              <span>0.3</span>
              <span>0.5</span>
              <span>1.0+</span>
            </div>
          </div>
        )}

        {activeLayer === 'snow' && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-600">
              <span>Snowfall Rate (in/hr)</span>
            </div>
            <div
              className="h-2 rounded-full w-56 shadow-2xs"
              style={{
                background: 'linear-gradient(to right, #10B981 0%, #06B6D4 30%, #3B82F6 60%, #8B5CF6 85%, #BE123C 100%)',
              }}
            />
            <div className="flex items-center justify-between text-[9px] font-mono text-slate-500">
              <span>0.0</span>
              <span>0.1</span>
              <span>0.2</span>
              <span>0.4</span>
              <span>0.6</span>
              <span>1.0+</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
