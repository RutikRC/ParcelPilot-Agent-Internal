from __future__ import annotations

from pydantic import BaseModel, Field


class EmbedQueryRequest(BaseModel):
    query: str = Field(..., min_length=1, description="The search query to generate an embedding for")


class EmbedQueryResponse(BaseModel):
    success: bool = True
    embedding: list[float] = Field(default_factory=list, description="The query embedding vector")
    dimension: int = Field(default=768, description="Embedding vector dimension")