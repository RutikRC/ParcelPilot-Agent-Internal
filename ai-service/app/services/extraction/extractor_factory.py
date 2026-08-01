from __future__ import annotations

import os

from app.core.exceptions import UnsupportedExtension
from app.services.extraction.base_extractor import BaseExtractor
from app.services.extraction.docx_extractor import DocxExtractor
from app.services.extraction.markdown_extractor import MarkdownExtractor
from app.services.extraction.pdf_extractor import PDFExtractor
from app.services.extraction.text_extractor import TextExtractor


class ExtractorFactory:
    """Factory responsible for returning the correct extractor for a given file extension."""

    _extractors: dict[str, type[BaseExtractor]] = {
        ".pdf": PDFExtractor,
        ".docx": DocxExtractor,
        ".txt": TextExtractor,
        ".md": MarkdownExtractor,
    }

    @classmethod
    def get_extractor(cls, file_path: str) -> BaseExtractor:
        """Return an extractor instance suitable for the given file path.

        Args:
            file_path: Absolute or relative path to the file.

        Returns:
            An instance of BaseExtractor matching the file extension.

        Raises:
            UnsupportedExtension: If the file extension is not supported.
        """
        _, ext = os.path.splitext(file_path)
        ext = ext.lower()

        extractor_cls = cls._extractors.get(ext)
        if extractor_cls is None:
            raise UnsupportedExtension(
                f"Unsupported file extension '{ext}'. "
                f"Supported extensions: {', '.join(cls._extractors.keys())}"
            )

        return extractor_cls()