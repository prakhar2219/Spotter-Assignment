from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.utils import timezone

@api_view(['GET'])
def health_check(request):
    """
    Health check endpoint for Phase 1 verification.
    Returns status, service identifier, and server timestamp.
    """
    return Response({
        "status": "healthy",
        "service": "spotter-weather-routing-backend",
        "timestamp": timezone.now().isoformat(),
        "phase": 1,
    })
