"""
WSGI bridge for Vercel Django framework detection.
"""
import os
from config.wsgi import application

# Expose WSGI application handler
app = application
