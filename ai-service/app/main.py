from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.v1.health import router as health_router
from app.routers.extraction import router as extraction_router
from app.routers.chunking import router as chunking_router
from app.routers.embedding import router as embedding_router
from app.routers.retrieval import router as retrieval_router
from app.routers.chat import router as chat_router
from app.config.settings import get_settings
from app.core.exceptions import (
    generic_exception_handler,
    http_exception_handler,
    request_validation_exception_handler,
)
from app.core.logger import configure_logger, logger
from app.middleware.request_id import RequestIDMiddleware


def create_application() -> FastAPI:
    settings = get_settings()
    configure_logger(settings.LOG_LEVEL)

    app = FastAPI(
        title=settings.APP_NAME,
        description=(
            "AI Document Management and Retrieval service foundation "
            "with production-ready FastAPI architecture."
        ),
        version=settings.APP_VERSION,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ALLOW_ORIGINS,
        allow_methods=["*"],
        allow_headers=["*"],
        allow_credentials=True,
    )

    app.add_middleware(RequestIDMiddleware)

    app.include_router(health_router, prefix="/api/v1")
    app.include_router(extraction_router, prefix="/api/v1")
    app.include_router(chunking_router, prefix="/api/v1")
    app.include_router(embedding_router, prefix="/api/v1")
    app.include_router(retrieval_router, prefix="/api/v1")
    app.include_router(chat_router, prefix="/api/v1")

    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, request_validation_exception_handler)
    app.add_exception_handler(Exception, generic_exception_handler)

    @app.on_event("startup")
    async def on_startup() -> None:
        logger.info("AI Service Started")

    @app.on_event("shutdown")
    async def on_shutdown() -> None:
        logger.info("AI Service Stopped")

    return app


app = create_application()
