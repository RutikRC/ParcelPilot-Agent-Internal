from fastapi import APIRouter, Depends

from app.schemas.response import APIResponse
from app.config.settings import get_settings

router = APIRouter(prefix="/health", tags=["Health"])


@router.get("", response_model=APIResponse)
async def health(settings=Depends(get_settings)):
    return APIResponse.success_response(message="Service is healthy", data={"app_name": settings.APP_NAME})


@router.get("/live", response_model=APIResponse)
async def live(settings=Depends(get_settings)):
    return APIResponse.success_response(message="Liveness check passed", data={})


@router.get("/ready", response_model=APIResponse)
async def ready(settings=Depends(get_settings)):
    return APIResponse.success_response(message="Readiness check passed", data={})
