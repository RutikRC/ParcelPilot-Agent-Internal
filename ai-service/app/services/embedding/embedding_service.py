from __future__ import annotations

import httpx
from app.core.logger import logger
from app.schemas.embedding import EmbeddingRequest, EmbeddingResponse
from app.config.settings import get_settings


OLLAMA_TIMEOUT = 120  # seconds


class EmbeddingService:
    """
    Generates vector embeddings using Ollama's nomic-embed-text model.

    Uses the Ollama /api/embed endpoint (Ollama 0.3.0+).
    Old endpoint /api/embeddings was deprecated and returns 404.
    """

    MODEL = "nomic-embed-text"
    DIMENSION = 768

    async def generate(self, request: EmbeddingRequest, trace_id: str = "") -> EmbeddingResponse:
        settings = get_settings()
        ollama_base_url = getattr(settings, "OLLAMA_BASE_URL", "http://localhost:11434")
        url = f"{ollama_base_url.rstrip('/')}/api/embed"

        payload = {
            "model": self.MODEL,
            "input": request.text,
        }

        logger.info(
            "Embedding requested [%s] | model=%s | inputChars=%d",
            trace_id,
            self.MODEL,
            len(request.text),
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

        # /api/embed returns {"model":"...","embeddings":[[...]]} (note: "embeddings" plural, with "s")
        # The value is a list of embeddings (one per input), we sent one input so take the first.
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
            "Embedding generated [%s] | model=%s | dimension=%d",
            trace_id,
            self.MODEL,
            self.DIMENSION,
        )

        return EmbeddingResponse(
            success=True,
            model=self.MODEL,
            dimension=self.DIMENSION,
            embedding=embedding,
        )
