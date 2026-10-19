"""
Route Recommendation Ranker.
Applies strict 4-tier lexicographical ranking to select the safest eligible route.
"""

from dataclasses import dataclass
from typing import List, Dict, Any, Optional, Tuple
from .metrics import calculate_route_risk_metrics, RouteRiskMetrics

@dataclass
class RecommendationResult:
    recommended_route_id: Optional[str]
    winning_route_name: Optional[str]
    status: str  # "recommended", "no_eligible_routes", "no_routes"
    explanation: str
    tradeoffs_summary: str
    decision_criterion: str  # "fewest_severe_miles", "fewest_high_miles", "lowest_average_risk", "shortest_travel_time", "identical"
    ranked_route_ids: List[str]
    ineligible_route_ids: List[str]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "recommended_route_id": self.recommended_route_id,
            "winning_route_name": self.winning_route_name,
            "status": self.status,
            "explanation": self.explanation,
            "tradeoffs_summary": self.tradeoffs_summary,
            "decision_criterion": self.decision_criterion,
            "ranked_route_ids": self.ranked_route_ids,
            "ineligible_route_ids": self.ineligible_route_ids,
        }

def get_lexicographical_key(route_dict: Dict[str, Any]) -> Tuple[float, float, float, float]:
    """
    Constructs the 4-tier tuple for strict lexicographical ranking:
    Tier 1: Fewest Severe miles
    Tier 2: Fewest High miles
    Tier 3: Lowest distance-weighted average risk
    Tier 4: Shortest travel time (seconds)
    """
    metrics = route_dict.get("metrics", {})
    return (
        float(metrics.get("severe_miles", 0.0)),
        float(metrics.get("high_miles", 0.0)),
        float(metrics.get("distance_weighted_average_risk", 0.0)),
        float(metrics.get("travel_time_seconds", 0.0)),
    )

def generate_tradeoffs_explanation(
    winner: Dict[str, Any],
    other_eligible: List[Dict[str, Any]],
    ineligible: List[Dict[str, Any]],
    decision_criterion: str,
) -> Tuple[str, str]:
    """
    Generates transparent, human-readable explanations of why the winning route was chosen and its tradeoffs.
    """
    w_name = winner.get("name", winner.get("id"))
    w_m = winner.get("metrics", {})
    w_severe = w_m.get("severe_miles", 0.0)
    w_high = w_m.get("high_miles", 0.0)
    w_avg = w_m.get("distance_weighted_average_risk", 0.0)
    w_time = w_m.get("travel_time_formatted", "")
    w_dist = w_m.get("total_distance_miles", 0.0)

    reasons: List[str] = []
    tradeoffs: List[str] = []

    if decision_criterion == "fewest_severe_miles":
        reasons.append(
            f"{w_name} is recommended because it has the fewest Severe miles ({w_severe:.1f} mi), "
            f"minimizing exposure to severe weather hazards."
        )
    elif decision_criterion == "fewest_high_miles":
        reasons.append(
            f"{w_name} is recommended because it ties on Severe miles ({w_severe:.1f} mi) and "
            f"minimizes High risk exposure with only {w_high:.1f} High miles."
        )
    elif decision_criterion == "lowest_average_risk":
        reasons.append(
            f"{w_name} is recommended because it ties on Severe ({w_severe:.1f} mi) and High miles ({w_high:.1f} mi) "
            f"and provides the lowest overall distance-weighted average risk score ({w_avg:.2f})."
        )
    elif decision_criterion == "shortest_travel_time":
        reasons.append(
            f"{w_name} is recommended because it shares identical weather risk metrics with other eligible routes "
            f"and offers the shortest travel duration ({w_time})."
        )
    else:
        reasons.append(f"{w_name} is recommended as all safety and travel metrics are equal across eligible routes.")

    # Contrast against other eligible alternatives
    for alt in other_eligible:
        a_name = alt.get("name", alt.get("id"))
        a_m = alt.get("metrics", {})
        diff_severe = a_m.get("severe_miles", 0.0) - w_severe
        diff_high = a_m.get("high_miles", 0.0) - w_high
        diff_time_s = a_m.get("travel_time_seconds", 0.0) - w_m.get("travel_time_seconds", 0.0)
        diff_time_min = int(round(diff_time_s / 60))

        if diff_severe > 0:
            tradeoffs.append(f"Avoids {diff_severe:.1f} additional Severe miles compared to {a_name}.")
        elif diff_high > 0:
            tradeoffs.append(f"Avoids {diff_high:.1f} additional High miles compared to {a_name}.")

        if diff_time_min < 0:
            tradeoffs.append(
                f"Tradeoff: Adds {abs(diff_time_min)} minutes of driving time compared to {a_name} "
                f"to ensure safer travel conditions."
            )
        elif diff_time_min > 0:
            tradeoffs.append(f"Saves {diff_time_min} minutes of driving time over {a_name}.")

    if ineligible:
        ineligible_names = ", ".join(r.get("name", r.get("id")) for r in ineligible)
        tradeoffs.append(f"Excluded {len(ineligible)} alternative route(s) ({ineligible_names}) due to No Travel hazard rules.")

    explanation = " ".join(reasons)
    tradeoff_summary = " ".join(tradeoffs) if tradeoffs else "Optimal route with minimal meteorological risk."

    return explanation, tradeoff_summary

def rank_and_recommend_routes(routes: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], RecommendationResult]:
    """
    Evaluates, ranks, and recommends routes using strict lexicographical priority:
      1. Fewest Severe miles
      2. Fewest High miles
      3. Lowest distance-weighted average risk
      4. Shortest travel time
    Routes with any No Travel checkpoint are excluded.
    Returns:
      (enriched_routes_with_metrics, recommendation_result)
    """
    if not routes:
        result = RecommendationResult(
            recommended_route_id=None,
            winning_route_name=None,
            status="no_routes",
            explanation="No routes were provided for evaluation.",
            tradeoffs_summary="No routes available.",
            decision_criterion="none",
            ranked_route_ids=[],
            ineligible_route_ids=[],
        )
        return routes, result

    # 1. Calculate risk metrics for each route if not already computed
    for rt in routes:
        if "metrics" not in rt:
            cps = rt.get("checkpoints", [])
            dist = float(rt.get("distance_miles", 0.0))
            dur_s = float(rt.get("duration_seconds", 0.0))
            dur_f = rt.get("duration_formatted", "")
            metrics = calculate_route_risk_metrics(cps, dist, dur_s, dur_f)
            rt["metrics"] = metrics.to_dict()

    eligible_routes: List[Dict[str, Any]] = []
    ineligible_routes: List[Dict[str, Any]] = []

    for rt in routes:
        m = rt.get("metrics", {})
        if m.get("is_eligible", False):
            eligible_routes.append(rt)
        else:
            ineligible_routes.append(rt)

    ineligible_ids = [r.get("id") for r in ineligible_routes]

    # 2. Case: All routes ineligible
    if not eligible_routes:
        reasons_list = []
        for r in ineligible_routes:
            m = r.get("metrics", {})
            reasons = m.get("ineligibility_reasons", [])
            reason_text = reasons[0] if reasons else "Hazardous conditions exceed safety rules."
            reasons_list.append(f"{r.get('name', r.get('id'))}: {reason_text}")

        reasons_summary = "; ".join(reasons_list)
        result = RecommendationResult(
            recommended_route_id=None,
            winning_route_name=None,
            status="no_eligible_routes",
            explanation="No route meets the configured safety rules. All alternatives contain No Travel hazard conditions.",
            tradeoffs_summary=f"Safety violation details: {reasons_summary}",
            decision_criterion="none",
            ranked_route_ids=[],
            ineligible_route_ids=ineligible_ids,
        )
        return routes, result

    # 3. Sort eligible routes strictly lexicographically
    eligible_routes.sort(key=get_lexicographical_key)
    winner = eligible_routes[0]
    other_eligible = eligible_routes[1:]
    ranked_ids = [r.get("id") for r in eligible_routes]

    # Determine which tier made the winning decision
    decision_criterion = "identical"
    if other_eligible:
        w_key = get_lexicographical_key(winner)
        runner_up_key = get_lexicographical_key(other_eligible[0])

        if w_key[0] < runner_up_key[0]:
            decision_criterion = "fewest_severe_miles"
        elif w_key[1] < runner_up_key[1]:
            decision_criterion = "fewest_high_miles"
        elif w_key[2] < runner_up_key[2]:
            decision_criterion = "lowest_average_risk"
        elif w_key[3] < runner_up_key[3]:
            decision_criterion = "shortest_travel_time"
    else:
        decision_criterion = "sole_eligible_route"

    explanation, tradeoffs = generate_tradeoffs_explanation(
        winner=winner,
        other_eligible=other_eligible,
        ineligible=ineligible_routes,
        decision_criterion=decision_criterion,
    )

    result = RecommendationResult(
        recommended_route_id=winner.get("id"),
        winning_route_name=winner.get("name", winner.get("id")),
        status="recommended",
        explanation=explanation,
        tradeoffs_summary=tradeoffs,
        decision_criterion=decision_criterion,
        ranked_route_ids=ranked_ids,
        ineligible_route_ids=ineligible_ids,
    )

    return routes, result
