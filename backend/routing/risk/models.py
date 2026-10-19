"""
Data models for risk classification results.
"""

from dataclasses import dataclass, asdict
from typing import Optional, Dict, Any, List
from .constants import RiskLevel, RISK_SCORES

@dataclass
class ConditionRisk:
    condition: str
    value: Optional[float]
    unit: str
    risk: RiskLevel
    score: int
    reason: str
    elevated_by_load: bool = False

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["risk"] = self.risk.value
        return d

@dataclass
class CheckpointRisk:
    overall_risk: RiskLevel
    overall_score: int
    is_safe: bool
    is_no_travel: bool
    wind: ConditionRisk
    rain: ConditionRisk
    snow: ConditionRisk
    governing_factor: str
    explanation: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "overall_risk": self.overall_risk.value,
            "overall_score": self.overall_score,
            "is_safe": self.is_safe,
            "is_no_travel": self.is_no_travel,
            "governing_factor": self.governing_factor,
            "explanation": self.explanation,
            "conditions": {
                "wind": self.wind.to_dict(),
                "rain": self.rain.to_dict(),
                "snow": self.snow.to_dict(),
            }
        }
