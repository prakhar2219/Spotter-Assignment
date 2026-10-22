from django.urls import path
from .views import (
    health_check,
    route_preview,
    route_checkpoints,
    route_plan,
    location_autocomplete,
    trip_history_list,
    trip_detail_view,
    trip_replan_view,
    trip_export_view,
)

urlpatterns = [
    path('health/', health_check, name='health-check'),
    path('locations/autocomplete/', location_autocomplete, name='location-autocomplete'),
    path('routes/preview/', route_preview, name='routes-preview'),
    path('routes/checkpoints/', route_checkpoints, name='routes-checkpoints'),
    path('routes/plan/', route_plan, name='routes-plan'),
    path('trips/', trip_history_list, name='trips-list'),
    path('trips/export/', trip_export_view, name='trips-export'),
    path('trips/<str:trip_id>/', trip_detail_view, name='trips-detail'),
    path('trips/<str:trip_id>/replan/', trip_replan_view, name='trips-replan'),
]

