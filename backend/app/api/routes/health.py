"""Health check endpoint for monitoring and container orchestration.

Provides a simple /health endpoint that returns status 'ok' for use by load balancers,
container orchestrators, and monitoring systems to verify the application is running
and responsive.
"""

from fastapi import APIRouter

router = APIRouter()


@router.get('/health', summary='Health check')
async def health_check() -> dict[str, str]:
    return {'status': 'ok'}
