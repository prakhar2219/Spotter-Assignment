"""
Weather Data Models and Normalization.
Ensures wind speed is in mph, precipitation in in/hr, and snowfall in in/hr.
"""

from dataclasses import dataclass, asdict
from typing import Optional, Dict, Any

@dataclass
class NormalizedWeather:
    wind_speed_mph: Optional[float]
    precipitation_in_hr: Optional[float]
    snowfall_in_hr: Optional[float]
    temperature_f: Optional[float]
    weather_code: Optional[int]
    weather_description: Optional[str]
    forecast_time: Optional[str]  # ISO timestamp of matched forecast hour
    is_available: bool
    status: str = "available"  # "available", "outside_forecast_horizon", "provider_error", "unknown"
    error_message: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def unavailable(cls, status: str = "outside_forecast_horizon", error_message: str = None) -> 'NormalizedWeather':
        """
        Creates an explicitly unavailable / unknown weather object.
        Never classify this as safe / Low risk.
        """
        return cls(
            wind_speed_mph=None,
            precipitation_in_hr=None,
            snowfall_in_hr=None,
            temperature_f=None,
            weather_code=None,
            weather_description="Weather data unavailable",
            forecast_time=None,
            is_available=False,
            status=status,
            error_message=error_message,
        )
