from __future__ import annotations

import os
import time

from app.core.exceptions import ExtractionFailure
from app.core.logger import logger
from app.schemas.extraction import ExtractionData, ExtractionRequest
from app.services.extraction.extractor_factory import ExtractorFactory


class ExtractionService:
    """Orchestrates text extraction by delegating to the appropriate extractor."""

    async def extract(self, request: ExtractionRequest, trace_id: str = "") -> ExtractionData:
        """Extract text from the file specified in the request.

        Args:
            request: Validated extraction request containing documentId and filePath.
            trace_id: Request ID for logging correlation.

        Returns:
            ExtractionData with extracted text and metadata.

        Raises:
            UnsupportedExtension: If the file type is not supported.
            ExtractionFailure: If extraction fails or the file is inaccessible.
        """
        file_path = request.filePath
        document_id = request.documentId

        # Validate file existence
        if not os.path.exists(file_path):
            raise ExtractionFailure(detail=f"File not found: {file_path}")

        # Validate file is readable
        if not os.access(file_path, os.R_OK):
            raise ExtractionFailure(detail=f"Permission denied: {file_path}")

        # Get the correct extractor
        extractor = ExtractorFactory.get_extractor(file_path)

        # Perform extraction with timing
        start_time = time.perf_counter()
        try:
            result = await extractor.extract(file_path)
        except Exception as exc:
            logger.exception(
                "Extraction failed [%s] for document [%s]",
                trace_id,
                document_id,
                exc_info=exc,
            )
            raise ExtractionFailure(
                detail=f"Failed to extract text from {file_path}: {str(exc)}"
            ) from exc

        elapsed = time.perf_counter() - start_time

        # Populate documentId in result
        result.documentId = document_id

        # Log extraction summary
        logger.info(
            "Extraction completed [%s] | documentId=%s | fileType=%s | "
            "characters=%d | duration=%.3fs",
            trace_id,
            document_id,
            result.fileType,
            result.characters,
            elapsed,
        )

        return result