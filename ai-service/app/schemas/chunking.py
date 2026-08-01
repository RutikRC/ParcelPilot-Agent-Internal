from __future__ import annotations

from pydantic import BaseModel, Field


class ChunkingRequest(BaseModel):
    text: str = Field(..., min_length=1, description="The full text to be split into chunks")


class ChunkData(BaseModel):
    chunk_index: int = Field(default=0, description="Zero-based index of the chunk")
    text: str = Field(default="", description="Chunk text content")
    character_count: int = Field(default=0, description="Number of characters in this chunk")
    token_count: int = Field(default=0, description="Estimated token count for this chunk")


class ChunkingResponse(BaseModel):
    chunks: list[ChunkData] = Field(default_factory=list, description="List of text chunks")