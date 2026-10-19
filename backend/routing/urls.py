from django.urls import path
from .views import health_check, route_preview, route_checkpoints, route_plan

urlpatterns = [
    path('health/', health_check, name='health-check'),
    path('routes/preview/', route_preview, name='routes-preview'),
    path('routes/checkpoints/', route_checkpoints, name='routes-checkpoints'),
    path('routes/plan/', route_plan, name='routes-plan'),
]
