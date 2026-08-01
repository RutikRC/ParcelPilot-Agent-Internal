from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from starlette.status import HTTP_200_OK

from app.core.logger import logger
from app.schemas.chunking import ChunkingRequest, ChunkingResponse
from app.schemas.response import APIResponse
from app.services.chunking.chunking_service import ChunkingService

router = APIRouter(prefix="/chunking", tags=["Chunking"])


@router.post(
    "/chunk",
    response_model=APIResponse,
    status_code=HTTP_200_OK,
    summary="Split text into chunks",
    description="Splits large text content into smaller, semantically meaningful chunks suitable for embedding.",
)
async def chunk_text(
    request: ChunkingRequest,
    http_request: Request,
    chunking_service: ChunkingService = Depends(),
) -> APIResponse:
    """Split the provided text into chunks.

    Accepts plain text content and returns an ordered list of chunks with
    character counts and estimated token counts.
    """
    trace_id = getattr(http_request.state, "request_id", "")

    logger.info(
        "Chunking requested [%s] | inputChars=%d",
        trace_id,
        len(request.text),
    )

    result: ChunkingResponse = await chunking_service.chunk(
        request=request, trace_id=trace_id
    )

    chunk_summaries = [
        chunk.model_dump() for chunk in result.chunks
    ]

    return APIResponse.success_response(
        message="Text chunked successfully",
        data={"chunks": chunk_summaries},
        trace_id=trace_id,
    )