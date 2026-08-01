from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from app.core.logger import logger


@dataclass
class LLMResponse:
    """Structured output from the LLM generation step."""

    answer: str = field(default="")
    model: str = field(default="")
    input_chunks: int = field(default=0)


class OutputParser:
    """Parses and validates the raw output from ChatOllama.

    Converts the LangChain AIMessage into a clean, structured LLMResponse
    that can be returned by the FastAPI endpoint.
    """

    @staticmethod
    def parse(raw_output: Any, model: str = "", input_chunks: int = 0) -> LLMResponse:
        """Parse the raw ChatOllama output into a structured LLMResponse.

        Args:
            raw_output: The result of chain.invoke(...) — typically an AIMessage.
            model: The model name used for generation (for logging / metadata).
            input_chunks: Number of chunks that were provided as context.

        Returns:
            An LLMResponse dataclass with the clean answer text.
        """
        answer_text = _extract_text(raw_output)

        logger.info(
            "Parsed LLM output | model=%s | answerChars=%d | inputChunks=%d",
            model,
            len(answer_text),
            input_chunks,
        )

        return LLMResponse(
            answer=answer_text,
            model=model,
            input_chunks=input_chunks,
        )


def _extract_text(raw_output: Any) -> str:
    """Extract the string answer from various possible output formats."""
    if raw_output is None:
        logger.warning("LLM returned None output")
        return ""

    # LangChain AIMessage
    if hasattr(raw_output, "content"):
        content = raw_output.content
        if isinstance(content, str):
            return content.strip()
        # Handle list-of-dict content (tool calls etc.)
        if isinstance(content, list):
            texts = []
            for item in content:
                if isinstance(item, dict) and "text" in item:
                    texts.append(item["text"])
            return " ".join(texts).strip()

    # Plain string
    if isinstance(raw_output, str):
        return raw_output.strip()

    # Dict with 'content' key (e.g. from streaming or custom chain)
    if isinstance(raw_output, dict):
        content = raw_output.get("content") or raw_output.get("text", "")
        if isinstance(content, str):
            return content.strip()

    logger.warning(
        "Unexpected LLM output type: %s",
        type(raw_output).__name__,
    )
    return str(raw_output).strip()