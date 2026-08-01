from __future__ import annotations

import httpx

from app.core.logger import logger
from app.config.settings import get_settings
from app.schemas.retrieval import EmbedQueryResponse

OLLAMA_TIMEOUT = 120  # seconds


class RetrievalService:
    """
    Generates query embeddings for semantic search using Ollama's nomic-embed-text model.

    This service is used by the Node.js backend during the retrieval pipeline.
    It only generates embeddings — it does NOT access PostgreSQL or perform search.
    """

    MODEL = "nomic-embed-text"
    DIMENSION = 768

    async def embed_query(self, query: str, trace_id: str = "") -> EmbedQueryResponse:
        settings = get_settings()
        ollama_base_url = getattr(settings, "OLLAMA_BASE_URL", "http://localhost:11434")
        url = f"{ollama_base_url.rstrip('/')}/api/embed"

        payload = {
            "model": self.MODEL,
            "input": query,
        }

        logger.info(
            "Query embedding requested [%s] | model=%s | queryChars=%d",
            trace_id,
            self.MODEL,
            len(query),
        )

        try:
            async with httpx.AsyncClient(timeout=OLLAMA_TIMEOUT) as client:
                response = await client.post(url, json=payload)
                response.raise_for_status()
                result = response.json()
        except httpx.TimeoutException:
            logger.error("Ollama request timed out [%s]", trace_id)
            raise RuntimeError("Ollama request timed out")
        except httpx.HTTPStatusError as e:
            logger.error(
                "Ollama HTTP error [%s] | status=%d | detail=%s",
                trace_id,
                e.response.status_code,
                e.response.text[:500],
            )
            raise RuntimeError(f"Ollama returned status {e.response.status_code}")
        except httpx.RequestError as e:
            logger.error("Ollama connection error [%s] | %s", trace_id, str(e))
            raise RuntimeError(f"Ollama unavailable: {e}")

        embeddings = result.get("embeddings", [])

        if not embeddings or len(embeddings) == 0:
            logger.error(
                "No embeddings returned from Ollama [%s] | result=%s",
                trace_id,
                str(result)[:500],
            )
            raise RuntimeError("Ollama returned empty embeddings")

        embedding = embeddings[0]

        if not embedding or len(embedding) != self.DIMENSION:
            logger.error(
                "Invalid embedding from Ollama [%s] | expectedDim=%d | gotDim=%d",
                trace_id,
                self.DIMENSION,
                len(embedding),
            )
            raise RuntimeError(
                f"Invalid embedding dimension: expected {self.DIMENSION}, got {len(embedding)}"
            )

        logger.info(
            "Query embedding generated [%s] | model=%s | dimension=%d",
            trace_id,
            self.MODEL,
            self.DIMENSION,
        )

        return EmbedQueryResponse(
            success=True,
            embedding=embedding,
            dimension=self.DIMENSION,
        )