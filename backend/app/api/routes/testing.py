"""
Testing routes for development and screenshot capture.

These routes are only available when the application is in test/debug mode.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from ...core.settings import settings
from ...testing.mock_data import clear_test_data, seed_test_data

router = APIRouter(prefix="/testing", tags=["Testing"])
logger = logging.getLogger(__name__)


def is_test_mode() -> bool:
    """Check if the application is in test mode."""
    return settings.spotify_mode.lower() == "test" or settings.debug


@router.post("/seed", summary="Seed test data")
async def seed_data() -> dict[str, str]:
    """
    Seed the database with realistic test data for screenshots and development.

    This creates multiple rooms in different states:
    - Room 123: Empty lobby (1 player)
    - Room 456: Lobby with 7 players, no songs
    - Room 789: Lobby with 7 players and 3 song pairs
    - Room 111: Playing state
    - Room 222: Guessing state
    - Room 333: Reveal state

    Only available in test/debug mode.
    """
    if not is_test_mode():
        raise HTTPException(
            status_code=403,
            detail="Test data seeding is only available in test/debug mode"
        )

    try:
        await seed_test_data()
        logger.info("Test data seeded successfully")
        return {
            "message": "Test data seeded successfully",
            "rooms": ["123", "456", "789", "111", "222", "333"]
        }
    except Exception as e:
        logger.error(f"Error seeding test data: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to seed test data: {str(e)}")


@router.delete("/clear", summary="Clear test data")
async def clear_data() -> dict[str, str]:
    """
    Clear all test data from the database.

    Only available in test/debug mode.
    """
    if not is_test_mode():
        raise HTTPException(
            status_code=403,
            detail="Test data clearing is only available in test/debug mode"
        )

    try:
        await clear_test_data()
        logger.info("Test data cleared successfully")
        return {"message": "Test data cleared successfully"}
    except Exception as e:
        logger.error(f"Error clearing test data: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to clear test data: {str(e)}")


@router.get("/status", summary="Get testing mode status")
async def get_status() -> dict[str, bool]:
    """
    Check if testing features are available.

    Returns:
        Dict with test mode status
    """
    return {
        "test_mode_enabled": is_test_mode(),
        "spotify_mode": settings.spotify_mode,
        "debug": settings.debug
    }
