"""
Route Risk Metrics Calculation.
Calculates Severe miles, High miles, and distance-weighted average risk.

Documented Segment-Risk Assignment Method:
For each road segment k between Checkpoint C_{k-1} and Checkpoint C_k with distance Δd_k:
  risk(segment_k) = max(risk(C_{k-1}), risk(C_k))
This conservative bounding method ensures that hazardous weather encountered between
any two checkpoints is accounted for over that entire transit segment.
The sum of Low, Moderate, High, Severe, and No Travel miles equals total route distance.
Checkpoint locations are not counted as miles.
"""

from dataclasses import dataclass, asdict
from typing import List, Dict, Any, Optional
from routing.risk.constants import RiskLevel, RISK_SCORES

@dataclass
class SegmentRiskInfo:
    segment_index: int
    from_checkpoint_index: int
    to_checkpoint_index: int
    distance_miles: float
    assigned_risk: str
    risk_score: int
    governing_reason: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

@dataclass
class RouteRiskMetrics:
    total_distance_miles: float
    travel_time_seconds: float
    travel_time_formatted: str
    severe_miles: float
    high_miles: float
    moderate_miles: float
    low_miles: float
    no_travel_miles: float
    unknown_miles: float
    distance_weighted_average_risk: float
    has_no_travel: bool
    has_unknown: bool
    is_eligible: bool
    ineligibility_reasons: List[str]
    segments: List[SegmentRiskInfo]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_distance_miles": self.total_distance_miles,
            "travel_time_seconds": self.travel_time_seconds,
            "travel_time_formatted": self.travel_time_formatted,
            "severe_miles": self.severe_miles,
            "high_miles": self.high_miles,
            "moderate_miles": self.moderate_miles,
            "low_miles": self.low_miles,
            "no_travel_miles": self.no_travel_miles,
            "unknown_miles": self.unknown_miles,
            "distance_weighted_average_risk": self.distance_weighted_average_risk,
            "has_no_travel": self.has_no_travel,
            "has_unknown": self.has_unknown,
            "is_eligible": self.is_eligible,
            "ineligibility_reasons": self.ineligibility_reasons,
            "segment_risk_assignment_method": "Conservative Max-Bound: max(risk(C_{k-1}), risk(C_k))",
        }

def calculate_route_risk_metrics(
    checkpoints: List[Dict[str, Any]],
    total_distance_miles: float,
    travel_time_seconds: float,
    travel_time_formatted: str = "",
) -> RouteRiskMetrics:
    """
    Computes distance-weighted metrics across checkpoints.
    Each checkpoint must have a 'risk' dictionary with 'overall_risk' and 'overall_score'.
    """
    if not checkpoints or len(checkpoints) < 2:
        return RouteRiskMetrics(
            total_distance_miles=round(total_distance_miles, 2),
            travel_time_seconds=round(travel_time_seconds, 1),
            travel_time_formatted=travel_time_formatted,
            severe_miles=0.0,
            high_miles=0.0,
            moderate_miles=0.0,
            low_miles=0.0,
            no_travel_miles=0.0,
            unknown_miles=0.0,
            distance_weighted_average_risk=0.0,
            has_no_travel=False,
            has_unknown=True,
            is_eligible=False,
            ineligibility_reasons=["Insufficient checkpoints to assess route safety."],
            segments=[],
        )

    severe_miles = 0.0
    high_miles = 0.0
    moderate_miles = 0.0
    low_miles = 0.0
    no_travel_miles = 0.0
    unknown_miles = 0.0
    weighted_score_sum = 0.0

    has_no_travel = False
    has_unknown = False
    ineligibility_reasons: List[str] = []
    segments: List[SegmentRiskInfo] = []

    # First check individual checkpoints for No Travel or Unknown
    for idx, cp in enumerate(checkpoints):
        risk_info = cp.get("risk", {})
        r_level_str = risk_info.get("overall_risk", "Unknown")
        if r_level_str == RiskLevel.NO_TRAVEL.value or risk_info.get("is_no_travel", False):
            has_no_travel = True
            reason = risk_info.get("explanation", "Hazardous weather conditions exceed safety limits.")
            ineligibility_reasons.append(f"Checkpoint {cp.get('index', idx)}: {reason}")
        elif r_level_str == RiskLevel.UNKNOWN.value or not risk_info.get("is_safe", True):
            has_unknown = True
            ineligibility_reasons.append(f"Checkpoint {cp.get('index', idx)}: Weather forecast data unavailable.")

    # Iterate segments between consecutive checkpoints
    for i in range(1, len(checkpoints)):
        cp_prev = checkpoints[i - 1]
        cp_curr = checkpoints[i]

        cum_prev = float(cp_prev.get("cumulative_distance_miles", 0.0))
        cum_curr = float(cp_curr.get("cumulative_distance_miles", 0.0))
        seg_dist = max(0.0, cum_curr - cum_prev)

        risk_prev = cp_prev.get("risk", {})
        risk_curr = cp_curr.get("risk", {})

        score_prev = risk_prev.get("overall_score", 0)
        score_curr = risk_curr.get("overall_score", 0)

        # Conservative assignment: max score of the two endpoints
        seg_score = max(score_prev, score_curr)

        if seg_score == RISK_SCORES[RiskLevel.NO_TRAVEL]:
            assigned_level = RiskLevel.NO_TRAVEL
            no_travel_miles += seg_dist
        elif seg_score == RISK_SCORES[RiskLevel.SEVERE]:
            assigned_level = RiskLevel.SEVERE
            severe_miles += seg_dist
        elif seg_score == RISK_SCORES[RiskLevel.HIGH]:
            assigned_level = RiskLevel.HIGH
            high_miles += seg_dist
        elif seg_score == RISK_SCORES[RiskLevel.MODERATE]:
            assigned_level = RiskLevel.MODERATE
            moderate_miles += seg_dist
        elif seg_score == RISK_SCORES[RiskLevel.LOW]:
            assigned_level = RiskLevel.LOW
            low_miles += seg_dist
        else:
            assigned_level = RiskLevel.UNKNOWN
            unknown_miles += seg_dist

        # For average risk calculation, use non-negative scores (0 to 4)
        effective_score = max(0, seg_score)
        weighted_score_sum += effective_score * seg_dist

        segments.append(
            SegmentRiskInfo(
                segment_index=i,
                from_checkpoint_index=cp_prev.get("index", i - 1),
                to_checkpoint_index=cp_curr.get("index", i),
                distance_miles=round(seg_dist, 2),
                assigned_risk=assigned_level.value,
                risk_score=seg_score,
                governing_reason=risk_curr.get("explanation") or risk_prev.get("explanation") or "Standard segment transit.",
            )
        )

    # Calculate distance-weighted average risk
    total_dist = max(0.001, total_distance_miles)
    avg_risk = round(weighted_score_sum / total_dist, 3)

    is_eligible = (not has_no_travel) and (not has_unknown)

    return RouteRiskMetrics(
        total_distance_miles=round(total_distance_miles, 2),
        travel_time_seconds=round(travel_time_seconds, 1),
        travel_time_formatted=travel_time_formatted,
        severe_miles=round(severe_miles, 2),
        high_miles=round(high_miles, 2),
        moderate_miles=round(moderate_miles, 2),
        low_miles=round(low_miles, 2),
        no_travel_miles=round(no_travel_miles, 2),
        unknown_miles=round(unknown_miles, 2),
        distance_weighted_average_risk=avg_risk,
        has_no_travel=has_no_travel,
        has_unknown=has_unknown,
        is_eligible=is_eligible,
        ineligibility_reasons=ineligibility_reasons,
        segments=segments,
    )
