"""
Open-Meteo Weather Provider.
Fetches hourly forecast series for coordinates and normalizes to standard units (mph, in/hr).
"""

import requests
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Tuple, Union
from .models import NormalizedWeather
from .wmo_codes import get_wmo_description

FORECAST_HORIZON_MAX_HOURS = 168  # 7 days max forecast supported by Open-Meteo free tier
MAX_BATCH_SIZE = 50  # Max coordinates per Open-Meteo request

class OpenMeteoWeatherProvider:
    BASE_URL = "https://api.open-meteo.com/v1/forecast"

    def __init__(self, timeout: int = 15):
        self.timeout = timeout
        # Simple coordinate-cache: {(round_lat, round_lon): hourly_data}
        self._cache: Dict[Tuple[float, float], Dict[str, Any]] = {}

    def fetch_hourly_forecasts(
        self,
        coordinates: List[List[float]],
    ) -> List[Optional[Dict[str, Any]]]:
        """
        Fetches hourly forecast series for a list of [lon, lat] coordinates.
        Supports batch requests and deduplicates adjacent coordinates.
        Returns a list of hourly data dictionaries matching the input order.
        """
        if not coordinates:
            return []

        results: List[Optional[Dict[str, Any]]] = [None] * len(coordinates)
        uncached_indices: List[int] = []
        uncached_coords: List[Tuple[float, float]] = []

        # Check in-memory cache first (rounded to 2 decimal places ~ 1.1km)
        for idx, (lon, lat) in enumerate(coordinates):
            cache_key = (round(lat, 2), round(lon, 2))
            if cache_key in self._cache:
                results[idx] = self._cache[cache_key]
            else:
                uncached_indices.append(idx)
                uncached_coords.append((lat, lon))

        if not uncached_coords:
            return results

        # Process in batches
        for i in range(0, len(uncached_coords), MAX_BATCH_SIZE):
            batch_slice = uncached_coords[i:i + MAX_BATCH_SIZE]
            batch_indices = uncached_indices[i:i + MAX_BATCH_SIZE]

            lat_str = ",".join(f"{lat:.4f}" for lat, _ in batch_slice)
            lon_str = ",".join(f"{lon:.4f}" for _, lon in batch_slice)

            params = {
                "latitude": lat_str,
                "longitude": lon_str,
                "hourly": "wind_speed_10m,precipitation,snowfall,temperature_2m,weather_code",
                "wind_speed_unit": "mph",
                "precipitation_unit": "inch",
                "temperature_unit": "fahrenheit",
                "timezone": "UTC",
                "forecast_days": 7,
            }

            try:
                response = requests.get(self.BASE_URL, params=params, timeout=self.timeout)
                if response.status_code == 200:
                    data = response.json()
                    # Open-Meteo returns a single dict if only 1 location, or a list if multiple
                    if isinstance(data, dict):
                        batch_results = [data]
                    elif isinstance(data, list):
                        batch_results = data
                    else:
                        batch_results = []

                    for idx_in_batch, item in enumerate(batch_results):
                        original_idx = batch_indices[idx_in_batch]
                        hourly = item.get("hourly")
                        results[original_idx] = hourly

                        lat_val, lon_val = batch_slice[idx_in_batch]
                        self._cache[(round(lat_val, 2), round(lon_val, 2))] = hourly

            except (requests.exceptions.RequestException, ValueError):
                # Network or parsing failure; uncached entries remain None
                pass

        return results

    def match_checkpoint_weather(
        self,
        hourly_data: Optional[Dict[str, Any]],
        arrival_time_iso: str,
    ) -> NormalizedWeather:
        """
        Matches a checkpoint's arrival time against an hourly forecast dataset.
        Normalizes units to mph and in/hr.
        If data is missing or out of range, explicitly returns an unavailable weather object.
        """
        if not hourly_data:
            return NormalizedWeather.unavailable(
                status="provider_error",
                error_message="Weather provider returned no data for this coordinate."
            )

        times = hourly_data.get("time", [])
        if not times:
            return NormalizedWeather.unavailable(
                status="provider_error",
                error_message="Empty hourly series returned by weather provider."
            )

        # Parse arrival time and convert to UTC
        try:
            clean_str = arrival_time_iso.strip()
            if clean_str.endswith("Z"):
                clean_str = clean_str[:-1] + "+00:00"
            eta_dt = datetime.fromisoformat(clean_str)
            if eta_dt.tzinfo is None:
                eta_dt = eta_dt.replace(tzinfo=timezone.utc)
            else:
                eta_dt = eta_dt.astimezone(timezone.utc)
        except Exception as e:
            return NormalizedWeather.unavailable(
                status="unknown",
                error_message=f"Could not parse checkpoint arrival time: {str(e)}"
            )

        # Parse Open-Meteo times (which are in UTC as requested: "YYYY-MM-DDTHH:00")
        best_idx: Optional[int] = None
        min_diff_seconds: float = float("inf")

        for idx, t_str in enumerate(times):
            try:
                # Open-Meteo UTC timestamps
                t_dt = datetime.fromisoformat(t_str).replace(tzinfo=timezone.utc)
                diff = abs((eta_dt - t_dt).total_seconds())
                if diff < min_diff_seconds:
                    min_diff_seconds = diff
                    best_idx = idx
            except Exception:
                continue

        # If closest forecast hour is more than 3 hours away, consider it outside forecast horizon
        if best_idx is None or min_diff_seconds > (3 * 3600):
            return NormalizedWeather.unavailable(
                status="outside_forecast_horizon",
                error_message="Estimated arrival time is outside the active 7-day forecast horizon."
            )

        # Extract values at matched hour
        winds = hourly_data.get("wind_speed_10m", [])
        precips = hourly_data.get("precipitation", [])
        snows = hourly_data.get("snowfall", [])
        temps = hourly_data.get("temperature_2m", [])
        codes = hourly_data.get("weather_code", [])

        wind_val = winds[best_idx] if best_idx < len(winds) else None
        precip_val = precips[best_idx] if best_idx < len(precips) else None
        snow_val = snows[best_idx] if best_idx < len(snows) else None
        temp_val = temps[best_idx] if best_idx < len(temps) else None
        code_val = codes[best_idx] if best_idx < len(codes) else None

        # Check for missing critical values
        if wind_val is None or precip_val is None:
            return NormalizedWeather.unavailable(
                status="unknown",
                error_message="Missing meteorological parameters in provider response."
            )

        return NormalizedWeather(
            wind_speed_mph=round(float(wind_val), 1),
            precipitation_in_hr=round(float(precip_val), 2),
            snowfall_in_hr=round(float(snow_val), 2) if snow_val is not None else 0.0,
            temperature_f=round(float(temp_val), 1) if temp_val is not None else None,
            weather_code=int(code_val) if code_val is not None else None,
            weather_description=get_wmo_description(code_val),
            forecast_time=times[best_idx],
            is_available=True,
            status="available",
        )
