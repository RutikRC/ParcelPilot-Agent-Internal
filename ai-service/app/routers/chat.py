from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from starlette.exceptions import HTTPException
from starlette.status import HTTP_200_OK, HTTP_400_BAD_REQUEST, HTTP_502_BAD_GATEWAY

from app.core.logger import logger
from app.schemas.chat import GenerateRequest
from app.schemas.response import APIResponse
from app.services.llm.llm_service import LLMService

router = APIRouter(prefix="/chat", tags=["Chat"])


@router.post(
    "/generate",
    response_model=None,
    status_code=HTTP_200_OK,
    summary="Generate an answer using RAG",
    description=(
        "Accepts a user question and a list of retrieved context chunks. "
        "Builds a LangChain prompt, invokes ChatOllama, and returns "
        "a factual answer based ONLY on the provided context."
    ),
)
async def generate_answer(
    request: GenerateRequest,
    http_request: Request,
    llm_service: LLMService = Depends(),
) -> APIResponse:
    """RAG Generation endpoint.

    Takes a user question and retrieved context chunks, then uses
    LangChain + ChatOllama to produce a concise, fact-based answer.
    """
    trace_id = getattr(http_request.state, "request_id", "")

    # --- Input validation ---
    if not request.question or not request.question.strip():
        raise HTTPException(
            status_code=HTTP_400_BAD_REQUEST,
            detail="Question is required and cannot be empty",
        )

    if not request.context:
        logger.warning(
            "Generate called with empty context | traceId=%s",
            trace_id,
        )

    logger.info(
        "Generate request received | traceId=%s | questionChars=%d | contextChunks=%d",
        trace_id,
        len(request.question),
        len(request.context),
    )

    # --- Convert Pydantic models to plain dicts for the LLM service ---
    context_dicts = [chunk.model_dump() for chunk in request.context]

    # --- Invoke LLM service ---
    try:
        llm_response = await llm_service.generate(
            question=request.question,
            context=context_dicts,
            trace_id=trace_id,
        )
    except Exception as exc:
        logger.error(
            "LLM generation failed | traceId=%s | error=%s",
            trace_id,
            str(exc),
        )
        raise HTTPException(
            status_code=HTTP_502_BAD_GATEWAY,
            detail=f"Answer generation failed: {str(exc)}",
        )

    # --- Build response ---
    response_data = {
        "answer": llm_response.answer,
        "model": llm_response.model,
        "usage": {
            "inputChunks": llm_response.input_chunks,
        },
    }

    logger.info(
        "Generate response sent | traceId=%s | answerChars=%d | model=%s",
        trace_id,
        len(llm_response.answer),
        llm_response.model,
    )

    return APIResponse.success_response(
        message="Answer generated successfully",
        data=response_data,
        trace_id=trace_id,
    )