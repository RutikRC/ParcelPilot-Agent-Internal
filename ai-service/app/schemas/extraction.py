from __future__ import annotations

from pydantic import BaseModel, Field


class ExtractionRequest(BaseModel):
    documentId: str = Field(..., min_length=1, description="Unique document identifier")
    filePath: str = Field(..., min_length=1, description="Absolute or relative path to the file")


class ExtractionData(BaseModel):
    documentId: str = Field(default="", description="Unique document identifier")
    fileType: str = Field(default="", description="File extension (pdf, docx, txt, md)")
    pages: int = Field(default=0, description="Number of pages (1 for non-PDF files)")
    characters: int = Field(default=0, description="Total character count")
    text: str = Field(default="", description="Extracted text content")