from fastapi import APIRouter
from app.config import settings
import time

router = APIRouter()
startup_time = time.time()

@router.get("/health")
async def health_check():
    return {
        "status": "ok",
        "version": settings.API_VERSION,
        "uptime": time.time() - startup_time
    }
