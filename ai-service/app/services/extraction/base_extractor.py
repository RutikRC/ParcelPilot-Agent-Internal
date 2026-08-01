from __future__ import annotations

from abc import ABC, abstractmethod

from app.schemas.extraction import ExtractionData


class BaseExtractor(ABC):
    """Abstract base extractor defining the interface for all file-type extractors."""

    @abstractmethod
    async def extract(self, file_path: str) -> ExtractionData:
        """Extract text content from the given file.

        Args:
            file_path: Absolute or relative path to the source file.

        Returns:
            ExtractionData containing the extracted text and metadata.
        """
        ...