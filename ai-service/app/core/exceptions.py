from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.status import HTTP_400_BAD_REQUEST, HTTP_500_INTERNAL_SERVER_ERROR

from app.core.logger import logger
from app.schemas.response import ErrorResponse


class UnsupportedExtension(StarletteHTTPException):
    """Raised when a file extension is not supported for extraction."""

    def __init__(self, detail: str = "Unsupported file extension") -> None:
        super().__init__(status_code=HTTP_400_BAD_REQUEST, detail=detail)


class ExtractionFailure(StarletteHTTPException):
    """Raised when text extraction from a file fails."""

    def __init__(self, detail: str = "Failed to extract text from file") -> None:
        super().__init__(status_code=HTTP_500_INTERNAL_SERVER_ERROR, detail=detail)


def build_error_response(
    message: str,
    errors: list[str] | None = None,
    status_code: int = HTTP_500_INTERNAL_SERVER_ERROR,
    trace_id: str = "",
) -> JSONResponse:
    payload = ErrorResponse(
        success=False,
        message=message,
        errors=errors or [],
        traceId=trace_id,
    )
    logger.error("Error response: %s", payload.model_dump())
    return JSONResponse(status_code=status_code, content=payload.model_dump())


async def http_exception_handler(
    request: Request, exc: Exception
) -> JSONResponse:
    trace_id = getattr(request.state, "request_id", "")
    logger.warning("HTTPException [%s]: %s", trace_id, str(exc))
    assert isinstance(exc, StarletteHTTPException)
    return build_error_response(
        message=exc.detail or "Request failed",
        errors=[],
        status_code=exc.status_code,
        trace_id=trace_id,
    )


async def request_validation_exception_handler(
    request: Request, exc: Exception
) -> JSONResponse:
    trace_id = getattr(request.state, "request_id", "")
    assert isinstance(exc, RequestValidationError)
    errors = [error.get("msg", "Invalid input") for error in exc.errors()]
    logger.warning("Validation failed [%s]: %s", trace_id, errors)
    return build_error_response(
        message="Validation error",
        errors=errors,
        status_code=422,
        trace_id=trace_id,
    )


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    trace_id = getattr(request.state, "request_id", "")
    logger.exception("Unhandled exception [%s]", trace_id, exc_info=exc)
    return build_error_response(
        message="Internal server error",
        errors=["An unexpected error occurred"],
        status_code=HTTP_500_INTERNAL_SERVER_ERROR,
        trace_id=trace_id,
    )