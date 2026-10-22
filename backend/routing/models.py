from django.db import models
from django.utils import timezone


class TripPlan(models.Model):
    """
    Persisted Trip Plan record in Spotter.
    Stores user dispatch inputs, calculated route alternatives, checkpoints,
    weather forecasts, risk metrics, and the recommended route decision.
    """
    STATUS_CHOICES = [
        ("completed", "Completed"),
        ("failed", "Failed"),
        ("in_progress", "In Progress"),
    ]

    RISK_LEVEL_CHOICES = [
        ("Low", "Low"),
        ("Moderate", "Moderate"),
        ("High", "High"),
        ("Severe", "Severe"),
        ("No Travel", "No Travel"),
        ("Unknown", "Unknown"),
    ]

    trip_id = models.CharField(max_length=64, unique=True, db_index=True)
    origin_name = models.CharField(max_length=255)
    destination_name = models.CharField(max_length=255)
    departure_time = models.DateTimeField(db_index=True)
    departure_time_iso = models.CharField(max_length=64, blank=True)
    cargo_weight_lb = models.FloatField(default=35000.0)
    checkpoint_interval_miles = models.IntegerField(default=25)
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default="completed", db_index=True)

    # Summary metrics of the recommended route
    recommended_route_id = models.CharField(max_length=64, blank=True)
    recommended_route_name = models.CharField(max_length=128, blank=True)
    distance_miles = models.FloatField(default=0.0)
    travel_time_seconds = models.FloatField(default=0.0)
    travel_time_formatted = models.CharField(max_length=64, blank=True)
    arrival_time_iso = models.CharField(max_length=64, blank=True)
    severe_miles = models.FloatField(default=0.0)
    high_miles = models.FloatField(default=0.0)
    average_risk = models.FloatField(default=0.0)
    risk_level = models.CharField(max_length=32, choices=RISK_LEVEL_CHOICES, default="Low", db_index=True)
    routes_count = models.IntegerField(default=1)

    # Complete plan result payload (routes, checkpoints, weather snapshots, recommendation)
    full_plan_payload = models.JSONField(default=dict)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Trip Plan"
        verbose_name_plural = "Trip Plans"

    def __str__(self):
        return f"{self.trip_id}: {self.origin_name} -> {self.destination_name} ({self.status})"

    def to_summary_dict(self):
        """Returns light summary for table rendering without full geometry overhead."""
        return {
            "trip_id": self.trip_id,
            "origin": self.origin_name,
            "destination": self.destination_name,
            "departure_time": self.departure_time_iso or self.departure_time.isoformat(),
            "departure_formatted": self.departure_time.strftime("%b %d, %Y, %I:%M %p"),
            "distance_miles": round(self.distance_miles, 1),
            "travel_time_formatted": self.travel_time_formatted or "—",
            "arrival_time": self.arrival_time_iso,
            "recommended_route": self.recommended_route_name or "Route A",
            "recommended_route_id": self.recommended_route_id,
            "avg_risk": round(self.average_risk, 2),
            "risk_level": self.risk_level,
            "severe_miles": round(self.severe_miles, 1),
            "high_miles": round(self.high_miles, 1),
            "cargo_weight_lb": self.cargo_weight_lb,
            "checkpoint_interval_miles": self.checkpoint_interval_miles,
            "status": self.status.capitalize(),
            "routes_count": self.routes_count,
            "created_at": self.created_at.isoformat(),
        }
