from __future__ import annotations

from app.schemas.extraction import ExtractionData
from app.services.extraction.base_extractor import BaseExtractor


class TextExtractor(BaseExtractor):
    """Extractor for plain text (.txt) files."""

    async def extract(self, file_path: str) -> ExtractionData:
        with open(file_path, "r", encoding="utf-8") as f:
            full_text = f.read()

        char_count = len(full_text)
        line_count = full_text.count("\n") + 1

        return ExtractionData(
            documentId="",
            fileType="txt",
            pages=1,
            characters=char_count,
            text=full_text,
        )