from __future__ import annotations

import math
import re

from app.core.logger import logger
from app.schemas.chunking import ChunkData, ChunkingRequest, ChunkingResponse


class ChunkingService:
    """
    Simple text chunking service.

    Splits text into semantically meaningful chunks based on paragraph breaks,
    then further splits by sentence boundaries to keep each chunk within a
    target size range.  This is a placeholder implementation that can be
    swapped for a more sophisticated strategy (e.g. recursive character
    splitting, token-aware splitting) later.
    """

    # Target chunk size in characters (roughly 200-250 tokens)
    TARGET_CHUNK_SIZE = 1000
    # Allow chunks to be up to 50 % larger before forcing a split
    MAX_CHUNK_SIZE = 1500

    # Rough token estimation: ~4 characters per token for English text
    CHARS_PER_TOKEN = 4

    async def chunk(self, request: ChunkingRequest, trace_id: str = "") -> ChunkingResponse:
        text = request.text.strip()

        if not text:
            logger.warning("Chunking received empty text [%s]", trace_id)
            return ChunkingResponse(chunks=[])

        # Split into paragraphs first (respecting common line-break patterns)
        paragraphs = re.split(r"\n\s*\n", text)
        paragraphs = [p.strip() for p in paragraphs if p.strip()]

        chunks: list[str] = []
        current_chunk: list[str] = []
        current_length = 0

        for para in paragraphs:
            para_len = len(para)

            # If a single paragraph exceeds MAX_CHUNK_SIZE, split it by sentences
            if para_len > self.MAX_CHUNK_SIZE:
                # Flush current buffer first
                if current_chunk:
                    chunks.append("\n\n".join(current_chunk))
                    current_chunk = []
                    current_length = 0

                # Split the long paragraph by sentence boundaries
                sentences = re.split(r"(?<=[.!?])\s+", para)
                for sentence in sentences:
                    sentence = sentence.strip()
                    if not sentence:
                        continue
                    sentence_len = len(sentence)

                    if current_length + sentence_len > self.MAX_CHUNK_SIZE and current_chunk:
                        chunks.append("\n\n".join(current_chunk))
                        current_chunk = []
                        current_length = 0

                    current_chunk.append(sentence)
                    current_length += sentence_len
            else:
                # Normal paragraph – add to current chunk if it fits
                if current_length + para_len > self.MAX_CHUNK_SIZE and current_chunk:
                    chunks.append("\n\n".join(current_chunk))
                    current_chunk = []
                    current_length = 0

                current_chunk.append(para)
                current_length += para_len

        # Flush remaining buffer
        if current_chunk:
            chunks.append("\n\n".join(current_chunk))

        # Build response
        chunk_data_list: list[ChunkData] = []
        for idx, chunk_text in enumerate(chunks):
            char_count = len(chunk_text)
            token_count = math.ceil(char_count / self.CHARS_PER_TOKEN)
            chunk_data_list.append(
                ChunkData(
                    chunk_index=idx,
                    text=chunk_text,
                    character_count=char_count,
                    token_count=token_count,
                )
            )

        logger.info(
            "Chunking completed [%s] | chunks=%d | totalChars=%d",
            trace_id,
            len(chunk_data_list),
            sum(c.character_count for c in chunk_data_list),
        )

        return ChunkingResponse(chunks=chunk_data_list)