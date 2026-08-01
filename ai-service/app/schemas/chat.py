from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class ChunkContext(BaseModel):
    """A single retrieved chunk passed as context to the LLM."""

    chunkText: str = Field(
        ..., description="The text content of the retrieved chunk"
    )
    documentId: str = Field(
        default="", description="UUID of the source document"
    )
    documentTitle: str = Field(
        default="", description="Title of the source document"
    )
    chunkIndex: int = Field(
        default=0, description="Index of the chunk within the document"
    )


class GenerateRequest(BaseModel):
    """Request body for POST /api/v1/chat/generate."""

    question: str = Field(
        ..., min_length=1, description="The user's question"
    )
    context: list[ChunkContext] = Field(
        default_factory=list,
        description="List of retrieved chunks to use as context",
    )


class UsageInfo(BaseModel):
    """Generation usage metadata."""

    inputChunks: int = Field(
        default=0, description="Number of chunks provided as input context"
    )


class GenerateData(BaseModel):
    """Response data for the generation endpoint."""

    answer: str = Field(
        default="", description="The generated answer text"
    )
    model: str = Field(
        default="", description="The LLM model used for generation"
    )
    usage: UsageInfo = Field(
        default_factory=UsageInfo,
        description="Generation metadata",
    )