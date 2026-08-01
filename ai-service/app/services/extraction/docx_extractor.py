from __future__ import annotations

from docx import Document

from app.schemas.extraction import ExtractionData
from app.services.extraction.base_extractor import BaseExtractor


class DocxExtractor(BaseExtractor):
    """Extractor for Microsoft Word (.docx) files using python-docx."""

    async def extract(self, file_path: str) -> ExtractionData:
        doc = Document(file_path)
        paragraphs: list[str] = []

        for para in doc.paragraphs:
            text = para.text.strip()
            if text:
                paragraphs.append(text)

        full_text = "\n".join(paragraphs)
        char_count = len(full_text)

        return ExtractionData(
            documentId="",
            fileType="docx",
            pages=1,
            characters=char_count,
            text=full_text,
        )