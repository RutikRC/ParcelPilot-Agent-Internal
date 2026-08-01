from __future__ import annotations

from app.schemas.extraction import ExtractionData
from app.services.extraction.base_extractor import BaseExtractor


class MarkdownExtractor(BaseExtractor):
    """Extractor for Markdown (.md) files.

    Returns the raw markdown content without rendering to HTML.
    """

    async def extract(self, file_path: str) -> ExtractionData:
        with open(file_path, "r", encoding="utf-8") as f:
            full_text = f.read()

        char_count = len(full_text)

        return ExtractionData(
            documentId="",
            fileType="md",
            pages=1,
            characters=char_count,
            text=full_text,
        )