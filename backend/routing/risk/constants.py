"""
Risk Engine Constants, Enums, and Documented Boundary Definitions.

Boundary Conventions:
- All precipitation and snowfall intervals follow the standard half-open [lower, upper) convention:
  - Low: value < lower_bound
  - Moderate: lower_bound <= value < mid_bound
  - High: mid_bound <= value < severe_bound
  - Severe: severe_bound <= value <= no_travel_bound
  - No Travel: value > no_travel_bound
- Wind intervals:
  - Low: wind < 25.0 mph
  - Moderate: 25.0 <= wind < 35.0 mph
  - High: 35.0 <= wind < 45.0 mph
  - Severe: 45.0 <= wind < 55.0 mph
  - No Travel: wind >= 55.0 mph
- Load rules:
  - Wind >= 55.0 mph -> No Travel (all loads)
  - Wind in [45.0, 55.0) mph and load > 30,000 lb -> No Travel (elevated from Severe)
  - Wind in [35.0, 45.0) mph and load > 40,000 lb -> Severe (elevated from High)
  - Loads <= 30,000 lb and <= 40,000 lb remain at standard base wind risk.
"""

from enum import Enum
from typing import Dict

class RiskLevel(str, Enum):
    LOW = "Low"
    MODERATE = "Moderate"
    HIGH = "High"
    SEVERE = "Severe"
    NO_TRAVEL = "No Travel"
    UNKNOWN = "Unknown"

# Numerical risk scores for distance-weighted average calculation
# Low=0, Moderate=1, High=2, Severe=3, No Travel=4
RISK_SCORES: Dict[RiskLevel, int] = {
    RiskLevel.LOW: 0,
    RiskLevel.MODERATE: 1,
    RiskLevel.HIGH: 2,
    RiskLevel.SEVERE: 3,
    RiskLevel.NO_TRAVEL: 4,
    RiskLevel.UNKNOWN: -1,
}

# Wind boundaries (mph)
WIND_LOW_MAX = 25.0
WIND_MODERATE_MAX = 35.0  # 25-34 mph
WIND_HIGH_MAX = 45.0      # 35-44 mph
WIND_SEVERE_MAX = 55.0    # 45-54 mph
WIND_NO_TRAVEL_MIN = 55.0 # >= 55 mph

# Rain boundaries (in/hr)
RAIN_LOW_MAX = 0.10
RAIN_MODERATE_MAX = 0.25
RAIN_HIGH_MAX = 0.50
RAIN_SEVERE_MAX = 1.00
RAIN_NO_TRAVEL_MIN = 1.00

# Snow boundaries (in/hr)
SNOW_LOW_MAX = 0.50
SNOW_MODERATE_MAX = 1.00
SNOW_HIGH_MAX = 2.00
SNOW_SEVERE_MAX = 3.00
SNOW_NO_TRAVEL_MIN = 3.00

# Load thresholds (lb)
LOAD_CROSSWIND_SEVERE_THRESHOLD_LB = 30000.0  # >30k lb with 45-54 mph -> No Travel
LOAD_CROSSWIND_HIGH_THRESHOLD_LB = 40000.0    # >40k lb with 35-44 mph -> Severe
