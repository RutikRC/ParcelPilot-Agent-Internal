from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from starlette.status import HTTP_200_OK

from app.core.logger import logger
from app.schemas.extraction import ExtractionData, ExtractionRequest
from app.schemas.response import APIResponse
from app.services.extraction.extraction_service import ExtractionService

router = APIRouter(prefix="/extraction", tags=["Extraction"])


@router.post(
    "/extract",
    response_model=APIResponse,
    status_code=HTTP_200_OK,
    summary="Extract text from a document",
    description="Extracts text content from PDF, DOCX, TXT, or MD files.",
)
async def extract_text(
    request: ExtractionRequest,
    http_request: Request,
    extraction_service: ExtractionService = Depends(),
) -> APIResponse:
    """Extract text from the provided document file.

    Accepts a document ID and file path, validates the file exists and has a
    supported extension, then extracts the text content.
    """
    trace_id = getattr(http_request.state, "request_id", "")

    logger.info(
        "Extraction requested [%s] | documentId=%s | filePath=%s",
        trace_id,
        request.documentId,
        request.filePath,
    )

    result: ExtractionData = await extraction_service.extract(
        request=request, trace_id=trace_id
    )

    return APIResponse.success_response(
        message="Text extracted successfully",
        data=result.model_dump(),
        trace_id=trace_id,
    )