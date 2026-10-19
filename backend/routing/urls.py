from django.urls import path
from .views import health_check, route_preview

urlpatterns = [
    path('health/', health_check, name='health-check'),
    path('routes/preview/', route_preview, name='routes-preview'),
]
