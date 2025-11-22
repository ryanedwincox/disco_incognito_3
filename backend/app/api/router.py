from fastapi import APIRouter

from .routes import auth, health, testing

api_router = APIRouter(prefix='/api')

api_router.include_router(health.router, tags=['health'])
api_router.include_router(auth.router, tags=['auth'])
api_router.include_router(testing.router, tags=['testing'])
