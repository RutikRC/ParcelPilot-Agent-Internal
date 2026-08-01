from __future__ import annotations

import fitz  # PyMuPDF

from app.schemas.extraction import ExtractionData
from app.services.extraction.base_extractor import BaseExtractor


class PDFExtractor(BaseExtractor):
    """Extractor for PDF files using PyMuPDF (fitz)."""

    async def extract(self, file_path: str) -> ExtractionData:
        doc = fitz.open(file_path)
        pages = len(doc)
        all_text: list[str] = []

        for page_num in range(pages):
            page = doc.load_page(page_num)
            text = str(page.get_text())
            all_text.append(text)

        doc.close()

        full_text = "\n".join(all_text)
        char_count = len(full_text)

        return ExtractionData(
            documentId="",
            fileType="pdf",
            pages=pages,
            characters=char_count,
            text=full_text,
        )