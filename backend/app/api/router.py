"""Main API router that aggregates all route modules.

Combines individual route modules (auth, health, testing) into a single API router with
the /api prefix. This is the central point for registering all backend HTTP endpoints.
"""

from fastapi import APIRouter

from .routes import auth, health, rooms, spotify, testing

api_router = APIRouter(prefix='/api')

api_router.include_router(health.router, tags=['health'])
api_router.include_router(auth.router, tags=['auth'])
api_router.include_router(testing.router, tags=['testing'])
api_router.include_router(spotify.router, tags=['spotify'])
api_router.include_router(rooms.router, tags=['rooms'])
