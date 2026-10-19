"""
Weather Enrichment Service.
Enriches route checkpoints with normalized meteorological forecasts.
"""

from typing import List, Optional
from routing.checkpoints.models import Checkpoint
from .open_meteo import OpenMeteoWeatherProvider
from .models import NormalizedWeather

_default_weather_provider = None

def get_weather_provider() -> OpenMeteoWeatherProvider:
    global _default_weather_provider
    if _default_weather_provider is None:
        _default_weather_provider = OpenMeteoWeatherProvider()
    return _default_weather_provider

def enrich_checkpoints_with_weather(
    checkpoints: List[Checkpoint],
    weather_provider: Optional[OpenMeteoWeatherProvider] = None,
    reference_time_iso: Optional[str] = None,
    load_weight_lb: float = 0.0,
    include_timeline: bool = True,
) -> List[Checkpoint]:
    """
    Enriches each checkpoint in-place with a normalized weather object for its coordinates and ETA.
    Optionally computes 0-48h timeline forecasts relative to reference_time_iso.
    Never marks unknown weather as safe.
    """
    if not checkpoints:
        return checkpoints

    provider = weather_provider or get_weather_provider()
    coordinates = [cp.coordinates for cp in checkpoints]

    # Fetch batch hourly forecasts
    forecast_series_list = provider.fetch_hourly_forecasts(coordinates)

    for idx, cp in enumerate(checkpoints):
        hourly_data = forecast_series_list[idx] if idx < len(forecast_series_list) else None
        normalized_w = provider.match_checkpoint_weather(
            hourly_data=hourly_data,
            arrival_time_iso=cp.estimated_arrival_time,
        )
        cp.weather = normalized_w.to_dict()

        if include_timeline and reference_time_iso:
            cp.hourly_forecasts = provider.generate_timeline_forecasts(
                hourly_data=hourly_data,
                reference_time_iso=reference_time_iso,
                max_offset_hours=48,
                load_weight_lb=load_weight_lb,
            )

    return checkpoints
