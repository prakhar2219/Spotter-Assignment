"""
Deterministic Risk Classification Engine.
Implements Spotter assessment thresholds, boundary conventions, and load-dependent rules.
Completely independent of HTTP requests and external APIs.
"""

from typing import Optional, Dict, Any, Union
from .constants import (
    RiskLevel,
    RISK_SCORES,
    WIND_LOW_MAX,
    WIND_MODERATE_MAX,
    WIND_HIGH_MAX,
    WIND_SEVERE_MAX,
    WIND_NO_TRAVEL_MIN,
    RAIN_LOW_MAX,
    RAIN_MODERATE_MAX,
    RAIN_HIGH_MAX,
    RAIN_SEVERE_MAX,
    RAIN_NO_TRAVEL_MIN,
    SNOW_LOW_MAX,
    SNOW_MODERATE_MAX,
    SNOW_HIGH_MAX,
    SNOW_SEVERE_MAX,
    SNOW_NO_TRAVEL_MIN,
    LOAD_CROSSWIND_SEVERE_THRESHOLD_LB,
    LOAD_CROSSWIND_HIGH_THRESHOLD_LB,
)
from .models import ConditionRisk, CheckpointRisk

def classify_wind_risk(
    wind_speed_mph: Optional[float],
    load_weight_lb: float = 0.0,
) -> ConditionRisk:
    """
    Classifies wind risk according to speed thresholds and truck load rules.

    Thresholds:
      - < 25 mph: Low
      - 25–34 mph: Moderate
      - 35–44 mph: High (Elevated to Severe if load > 40,000 lb)
      - 45–54 mph: Severe (Elevated to No Travel if load > 30,000 lb)
      - >= 55 mph: No Travel (All loads)
    """
    if wind_speed_mph is None:
        return ConditionRisk(
            condition="wind",
            value=None,
            unit="mph",
            risk=RiskLevel.UNKNOWN,
            score=RISK_SCORES[RiskLevel.UNKNOWN],
            reason="Wind speed data is missing or unavailable.",
            elevated_by_load=False,
        )

    try:
        wind = float(wind_speed_mph)
        load = max(0.0, float(load_weight_lb))
    except (ValueError, TypeError):
        return ConditionRisk(
            condition="wind",
            value=None,
            unit="mph",
            risk=RiskLevel.UNKNOWN,
            score=RISK_SCORES[RiskLevel.UNKNOWN],
            reason="Invalid wind or load values.",
            elevated_by_load=False,
        )

    if wind < 0:
        return ConditionRisk(
            condition="wind",
            value=wind,
            unit="mph",
            risk=RiskLevel.UNKNOWN,
            score=RISK_SCORES[RiskLevel.UNKNOWN],
            reason="Negative wind speed is invalid.",
            elevated_by_load=False,
        )

    # 1. Absolute No Travel: >= 55 mph for ANY load
    if wind >= WIND_NO_TRAVEL_MIN:
        return ConditionRisk(
            condition="wind",
            value=wind,
            unit="mph",
            risk=RiskLevel.NO_TRAVEL,
            score=RISK_SCORES[RiskLevel.NO_TRAVEL],
            reason=f"Wind speed ({wind:.1f} mph) >= 55 mph requires No Travel for any load.",
            elevated_by_load=False,
        )

    # 2. Severe range: 45–54 mph
    # With load > 30,000 lb -> elevated to No Travel
    # With load <= 30,000 lb -> Severe
    if wind >= WIND_HIGH_MAX and wind < WIND_SEVERE_MAX:
        if load > LOAD_CROSSWIND_SEVERE_THRESHOLD_LB:
            return ConditionRisk(
                condition="wind",
                value=wind,
                unit="mph",
                risk=RiskLevel.NO_TRAVEL,
                score=RISK_SCORES[RiskLevel.NO_TRAVEL],
                reason=(
                    f"Wind speed ({wind:.1f} mph) in 45–54 mph with truck load ({load:,.0f} lb) "
                    f"> 30,000 lb elevates risk to No Travel."
                ),
                elevated_by_load=True,
            )
        else:
            return ConditionRisk(
                condition="wind",
                value=wind,
                unit="mph",
                risk=RiskLevel.SEVERE,
                score=RISK_SCORES[RiskLevel.SEVERE],
                reason=f"Wind speed ({wind:.1f} mph) in 45–54 mph is Severe (load {load:,.0f} lb <= 30,000 lb).",
                elevated_by_load=False,
            )

    # 3. High range: 35–44 mph
    # With load > 40,000 lb -> elevated to Severe
    # With load <= 40,000 lb -> High
    if wind >= WIND_MODERATE_MAX and wind < WIND_HIGH_MAX:
        if load > LOAD_CROSSWIND_HIGH_THRESHOLD_LB:
            return ConditionRisk(
                condition="wind",
                value=wind,
                unit="mph",
                risk=RiskLevel.SEVERE,
                score=RISK_SCORES[RiskLevel.SEVERE],
                reason=(
                    f"Wind speed ({wind:.1f} mph) in 35–44 mph with truck load ({load:,.0f} lb) "
                    f"> 40,000 lb elevates risk to Severe."
                ),
                elevated_by_load=True,
            )
        else:
            return ConditionRisk(
                condition="wind",
                value=wind,
                unit="mph",
                risk=RiskLevel.HIGH,
                score=RISK_SCORES[RiskLevel.HIGH],
                reason=f"Wind speed ({wind:.1f} mph) in 35–44 mph is High (load {load:,.0f} lb <= 40,000 lb).",
                elevated_by_load=False,
            )

    # 4. Moderate range: 25–34 mph
    if wind >= WIND_LOW_MAX and wind < WIND_MODERATE_MAX:
        return ConditionRisk(
            condition="wind",
            value=wind,
            unit="mph",
            risk=RiskLevel.MODERATE,
            score=RISK_SCORES[RiskLevel.MODERATE],
            reason=f"Wind speed ({wind:.1f} mph) in 25–34 mph is Moderate.",
            elevated_by_load=False,
        )

    # 5. Low range: < 25 mph
    return ConditionRisk(
        condition="wind",
        value=wind,
        unit="mph",
        risk=RiskLevel.LOW,
        score=RISK_SCORES[RiskLevel.LOW],
        reason=f"Wind speed ({wind:.1f} mph) below 25 mph is Low.",
        elevated_by_load=False,
    )

def classify_rain_risk(precipitation_in_hr: Optional[float]) -> ConditionRisk:
    """
    Classifies rain intensity risk.
    Convention: [lower, upper)
      - < 0.10 in/hr: Low
      - 0.10 <= r < 0.25: Moderate
      - 0.25 <= r < 0.50: High
      - 0.50 <= r <= 1.00: Severe
      - > 1.00 in/hr: No Travel
    """
    if precipitation_in_hr is None:
        return ConditionRisk(
            condition="rain",
            value=None,
            unit="in/hr",
            risk=RiskLevel.UNKNOWN,
            score=RISK_SCORES[RiskLevel.UNKNOWN],
            reason="Precipitation data is missing or unavailable.",
            elevated_by_load=False,
        )

    try:
        rain = float(precipitation_in_hr)
    except (ValueError, TypeError):
        return ConditionRisk(
            condition="rain",
            value=None,
            unit="in/hr",
            risk=RiskLevel.UNKNOWN,
            score=RISK_SCORES[RiskLevel.UNKNOWN],
            reason="Invalid precipitation value.",
            elevated_by_load=False,
        )

    if rain < 0:
        return ConditionRisk(
            condition="rain",
            value=rain,
            unit="in/hr",
            risk=RiskLevel.UNKNOWN,
            score=RISK_SCORES[RiskLevel.UNKNOWN],
            reason="Negative precipitation is invalid.",
            elevated_by_load=False,
        )

    if rain > RAIN_NO_TRAVEL_MIN:
        return ConditionRisk(
            condition="rain",
            value=rain,
            unit="in/hr",
            risk=RiskLevel.NO_TRAVEL,
            score=RISK_SCORES[RiskLevel.NO_TRAVEL],
            reason=f"Rain intensity ({rain:.2f} in/hr) above 1.00 in/hr is No Travel.",
            elevated_by_load=False,
        )
    elif rain >= RAIN_HIGH_MAX:  # 0.50 <= r <= 1.00
        return ConditionRisk(
            condition="rain",
            value=rain,
            unit="in/hr",
            risk=RiskLevel.SEVERE,
            score=RISK_SCORES[RiskLevel.SEVERE],
            reason=f"Rain intensity ({rain:.2f} in/hr) in 0.50–1.00 in/hr is Severe.",
            elevated_by_load=False,
        )
    elif rain >= RAIN_MODERATE_MAX:  # 0.25 <= r < 0.50
        return ConditionRisk(
            condition="rain",
            value=rain,
            unit="in/hr",
            risk=RiskLevel.HIGH,
            score=RISK_SCORES[RiskLevel.HIGH],
            reason=f"Rain intensity ({rain:.2f} in/hr) in 0.25–0.50 in/hr is High.",
            elevated_by_load=False,
        )
    elif rain >= RAIN_LOW_MAX:  # 0.10 <= r < 0.25
        return ConditionRisk(
            condition="rain",
            value=rain,
            unit="in/hr",
            risk=RiskLevel.MODERATE,
            score=RISK_SCORES[RiskLevel.MODERATE],
            reason=f"Rain intensity ({rain:.2f} in/hr) in 0.10–0.25 in/hr is Moderate.",
            elevated_by_load=False,
        )
    else:  # < 0.10
        return ConditionRisk(
            condition="rain",
            value=rain,
            unit="in/hr",
            risk=RiskLevel.LOW,
            score=RISK_SCORES[RiskLevel.LOW],
            reason=f"Rain intensity ({rain:.2f} in/hr) below 0.10 in/hr is Low.",
            elevated_by_load=False,
        )

def classify_snow_risk(snowfall_in_hr: Optional[float]) -> ConditionRisk:
    """
    Classifies snowfall intensity risk.
    Convention: [lower, upper)
      - < 0.50 in/hr: Low
      - 0.50 <= s < 1.00: Moderate
      - 1.00 <= s < 2.00: High
      - 2.00 <= s <= 3.00: Severe
      - > 3.00 in/hr: No Travel
    """
    if snowfall_in_hr is None:
        return ConditionRisk(
            condition="snow",
            value=None,
            unit="in/hr",
            risk=RiskLevel.UNKNOWN,
            score=RISK_SCORES[RiskLevel.UNKNOWN],
            reason="Snowfall data is missing or unavailable.",
            elevated_by_load=False,
        )

    try:
        snow = float(snowfall_in_hr)
    except (ValueError, TypeError):
        return ConditionRisk(
            condition="snow",
            value=None,
            unit="in/hr",
            risk=RiskLevel.UNKNOWN,
            score=RISK_SCORES[RiskLevel.UNKNOWN],
            reason="Invalid snowfall value.",
            elevated_by_load=False,
        )

    if snow < 0:
        return ConditionRisk(
            condition="snow",
            value=snow,
            unit="in/hr",
            risk=RiskLevel.UNKNOWN,
            score=RISK_SCORES[RiskLevel.UNKNOWN],
            reason="Negative snowfall is invalid.",
            elevated_by_load=False,
        )

    if snow > SNOW_NO_TRAVEL_MIN:
        return ConditionRisk(
            condition="snow",
            value=snow,
            unit="in/hr",
            risk=RiskLevel.NO_TRAVEL,
            score=RISK_SCORES[RiskLevel.NO_TRAVEL],
            reason=f"Snowfall intensity ({snow:.2f} in/hr) above 3.0 in/hr is No Travel.",
            elevated_by_load=False,
        )
    elif snow >= SNOW_HIGH_MAX:  # 2.00 <= s <= 3.00
        return ConditionRisk(
            condition="snow",
            value=snow,
            unit="in/hr",
            risk=RiskLevel.SEVERE,
            score=RISK_SCORES[RiskLevel.SEVERE],
            reason=f"Snowfall intensity ({snow:.2f} in/hr) in 2.0–3.0 in/hr is Severe.",
            elevated_by_load=False,
        )
    elif snow >= SNOW_MODERATE_MAX:  # 1.00 <= s < 2.00
        return ConditionRisk(
            condition="snow",
            value=snow,
            unit="in/hr",
            risk=RiskLevel.HIGH,
            score=RISK_SCORES[RiskLevel.HIGH],
            reason=f"Snowfall intensity ({snow:.2f} in/hr) in 1.0–2.0 in/hr is High.",
            elevated_by_load=False,
        )
    elif snow >= SNOW_LOW_MAX:  # 0.50 <= s < 1.00
        return ConditionRisk(
            condition="snow",
            value=snow,
            unit="in/hr",
            risk=RiskLevel.MODERATE,
            score=RISK_SCORES[RiskLevel.MODERATE],
            reason=f"Snowfall intensity ({snow:.2f} in/hr) in 0.5–1.0 in/hr is Moderate.",
            elevated_by_load=False,
        )
    else:  # < 0.50
        return ConditionRisk(
            condition="snow",
            value=snow,
            unit="in/hr",
            risk=RiskLevel.LOW,
            score=RISK_SCORES[RiskLevel.LOW],
            reason=f"Snowfall intensity ({snow:.2f} in/hr) below 0.5 in/hr is Low.",
            elevated_by_load=False,
        )

def evaluate_checkpoint_risk(
    weather: Optional[Union[Dict[str, Any], Any]],
    load_weight_lb: float = 0.0,
) -> CheckpointRisk:
    """
    Evaluates overall checkpoint risk from wind, rain, and snow conditions.
    Worst condition determines overall risk.
    Unknown weather is never considered safe.
    """
    if weather is None:
        weather_dict = {}
        is_available = False
    elif hasattr(weather, "to_dict"):
        weather_dict = weather.to_dict()
        is_available = weather_dict.get("is_available", True)
    elif isinstance(weather, dict):
        weather_dict = weather
        is_available = weather_dict.get("is_available", True)
    else:
        weather_dict = {}
        is_available = False

    if not is_available:
        unknown_wind = classify_wind_risk(None, load_weight_lb)
        unknown_rain = classify_rain_risk(None)
        unknown_snow = classify_snow_risk(None)
        return CheckpointRisk(
            overall_risk=RiskLevel.UNKNOWN,
            overall_score=RISK_SCORES[RiskLevel.UNKNOWN],
            is_safe=False,
            is_no_travel=False,
            wind=unknown_wind,
            rain=unknown_rain,
            snow=unknown_snow,
            governing_factor="Unavailable forecast",
            explanation="Weather forecast data is unavailable for this checkpoint. Cannot verify safety.",
        )

    wind_speed = weather_dict.get("wind_speed_mph")
    rain_rate = weather_dict.get("precipitation_in_hr")
    snow_rate = weather_dict.get("snowfall_in_hr")

    wind_eval = classify_wind_risk(wind_speed, load_weight_lb)
    rain_eval = classify_rain_risk(rain_rate)
    snow_eval = classify_snow_risk(snow_rate)

    conditions = [wind_eval, rain_eval, snow_eval]

    # Rule: If any condition is NO_TRAVEL -> overall is NO_TRAVEL
    no_travel_conditions = [c for c in conditions if c.risk == RiskLevel.NO_TRAVEL]
    if no_travel_conditions:
        governing = no_travel_conditions[0]
        return CheckpointRisk(
            overall_risk=RiskLevel.NO_TRAVEL,
            overall_score=RISK_SCORES[RiskLevel.NO_TRAVEL],
            is_safe=False,
            is_no_travel=True,
            wind=wind_eval,
            rain=rain_eval,
            snow=snow_eval,
            governing_factor=f"{governing.condition.capitalize()} ({governing.value} {governing.unit})",
            explanation=governing.reason,
        )

    # Rule: If any condition is UNKNOWN and none is NO_TRAVEL -> overall is UNKNOWN (unsafe)
    unknown_conditions = [c for c in conditions if c.risk == RiskLevel.UNKNOWN]
    if unknown_conditions:
        governing = unknown_conditions[0]
        return CheckpointRisk(
            overall_risk=RiskLevel.UNKNOWN,
            overall_score=RISK_SCORES[RiskLevel.UNKNOWN],
            is_safe=False,
            is_no_travel=False,
            wind=wind_eval,
            rain=rain_eval,
            snow=snow_eval,
            governing_factor=f"Missing {governing.condition} data",
            explanation="One or more weather parameters are missing. Checkpoint cannot be verified as safe.",
        )

    # Worst condition determines overall risk
    governing = max(conditions, key=lambda c: c.score)

    return CheckpointRisk(
        overall_risk=governing.risk,
        overall_score=governing.score,
        is_safe=(governing.risk not in (RiskLevel.NO_TRAVEL, RiskLevel.UNKNOWN)),
        is_no_travel=False,
        wind=wind_eval,
        rain=rain_eval,
        snow=snow_eval,
        governing_factor=f"{governing.condition.capitalize()} ({governing.value} {governing.unit})",
        explanation=governing.reason,
    )
