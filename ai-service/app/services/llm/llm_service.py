from __future__ import annotations

import time
from typing import Any

from langchain_ollama import ChatOllama

from app.config.settings import get_settings
from app.core.logger import logger
from app.services.llm.output_parser import LLMResponse, OutputParser
from app.services.llm.prompt_builder import PromptBuilder, PromptInput


class LLMService:
    """Orchestrates the RAG generation step.

    Responsibilities:
      1. Receive a user question and a list of retrieved chunks.
      2. Build a LangChain prompt using PromptBuilder.
      3. Invoke ChatOllama with the constructed prompt.
      4. Parse the model output into a structured response.
      5. Return a clean LLMResponse with answer text and metadata.
    """

    def __init__(self) -> None:
        settings = get_settings()

        self._prompt_builder = PromptBuilder()
        self._output_parser = OutputParser()

        # Build the LLM from environment configuration
        self._llm = ChatOllama(
            model=settings.LLM_MODEL,
            base_url=settings.OLLAMA_URL,
            temperature=settings.LLM_TEMPERATURE,
            num_predict=settings.LLM_MAX_TOKENS,
        )

        logger.info(
            "LLMService initialized | model=%s | ollamaUrl=%s | temperature=%.2f | maxTokens=%d",
            settings.LLM_MODEL,
            settings.OLLAMA_URL,
            settings.LLM_TEMPERATURE,
            settings.LLM_MAX_TOKENS,
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def generate(
        self,
        question: str,
        context: list[dict[str, Any]] | None = None,
        trace_id: str = "",
    ) -> LLMResponse:
        """Generate a natural-language answer from retrieved chunks.

        Args:
            question: The user's question.
            context: A list of chunk dicts, each with at least a 'chunkText' key.
            trace_id: Optional correlation ID for logging.

        Returns:
            An LLMResponse containing the answer, model name, and chunk count.
        """
        sanitised_question = question.strip()
        safe_context = context or []

        logger.info(
            "LLM generation started | traceId=%s | questionChars=%d | contextChunks=%d",
            trace_id,
            len(sanitised_question),
            len(safe_context),
        )

        # 1. Flatten context chunks into a single prompt-friendly text block
        retrieved_chunks_text = self._format_context(safe_context)

        # 2. Build the prompt
        prompt_input = PromptInput(
            user_question=sanitised_question,
            retrieved_chunks=retrieved_chunks_text,
        )

        # 3. Invoke the LLM
        start_time = time.perf_counter()
        try:
            raw_output = await self._llm.ainvoke(
                self._prompt_builder.format_messages(prompt_input)
            )
        except Exception as exc:
            logger.error(
                "LLM invocation failed | traceId=%s | error=%s",
                trace_id,
                str(exc),
            )
            raise

        generation_time = time.perf_counter() - start_time

        # 4. Parse the output
        settings = get_settings()
        response = self._output_parser.parse(
            raw_output=raw_output,
            model=settings.LLM_MODEL,
            input_chunks=len(safe_context),
        )

        logger.info(
            "LLM generation completed | traceId=%s | model=%s | "
            "answerChars=%d | inputChunks=%d | generationTimeMs=%.1f",
            trace_id,
            response.model,
            len(response.answer),
            response.input_chunks,
            generation_time * 1000,
        )

        return response

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _format_context(context: list[dict[str, Any]]) -> str:
        """Flatten a list of chunk dicts into a single text block.

        Each chunk is prefixed with a 'Chunk N:' label so the LLM can
        differentiate between pieces of context.
        """
        if not context:
            return "[No context provided]"

        parts: list[str] = []
        for idx, chunk in enumerate(context, start=1):
            text = chunk.get("chunkText", "") or chunk.get("text", "") or ""
            parts.append(f"Chunk {idx}:\n{text.strip()}")

        return "\n\n".join(parts)