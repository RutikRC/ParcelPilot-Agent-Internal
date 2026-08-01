from __future__ import annotations

from pydantic import BaseModel, Field


class EmbeddingRequest(BaseModel):
    text: str = Field(..., min_length=1, description="The text to generate an embedding for")


class EmbeddingResponse(BaseModel):
    success: bool = True
    model: str = Field(default="nomic-embed-text", description="Embedding model used")
    dimension: int = Field(default=768, description="Embedding vector dimension")
    embedding: list[float] = Field(default_factory=list, description="The embedding vector")