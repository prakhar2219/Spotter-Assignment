"""
Exceptions for Routing Services.
"""

class RoutingError(Exception):
    """Base exception for all routing related errors."""
    pass

class MissingApiKeyError(RoutingError):
    """Raised when required provider API credentials are not configured."""
    pass

class GeocodingError(RoutingError):
    """Raised when geocoding a location string fails or returns no results."""
    pass

class ProviderUnavailableError(RoutingError):
    """Raised when the upstream routing provider is down, timed out, or returning 5xx."""
    pass

class RateLimitError(RoutingError):
    """Raised when upstream routing provider returns 429 Too Many Requests."""
    pass

class InvalidTripInputError(RoutingError):
    """Raised when origin/destination coordinates or inputs are invalid."""
    pass

class NoRoutesFoundError(RoutingError):
    """Raised when no route could be found between the given coordinates."""
    pass
