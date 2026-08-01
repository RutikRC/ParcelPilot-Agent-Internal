from __future__ import annotations

from dataclasses import dataclass, field

from langchain_core.prompts import ChatPromptTemplate

from app.core.logger import logger

SYSTEM_PROMPT_TEMPLATE = (
    "You are an enterprise AI assistant.\n"
    "Answer ONLY using the provided context.\n"
    "If the answer cannot be found in the context, "
    "clearly state that the information is not available.\n"
    "Do not fabricate information.\n"
    "Always provide concise and factual responses."
)

USER_PROMPT_TEMPLATE = (
    "Context:\n"
    "{retrieved_chunks}\n\n"
    "Question:\n"
    "{user_question}"
)


@dataclass
class PromptInput:
    """Structured input for building the RAG prompt."""

    user_question: str
    retrieved_chunks: str = field(default="")


class PromptBuilder:
    """Builds LangChain prompt templates for RAG generation.

    Encapsulates system and user prompt construction so that the prompt
    logic lives in one place and can be reused / versioned easily.
    """

    def __init__(self) -> None:
        self._system_message = SYSTEM_PROMPT_TEMPLATE
        self._chat_prompt = ChatPromptTemplate.from_messages(
            [
                ("system", self._system_message),
                ("human", USER_PROMPT_TEMPLATE),
            ]
        )
        logger.debug(
            "PromptBuilder initialized | systemTemplateChars=%d",
            len(self._system_message),
        )

    def build_prompt(self, prompt_input: PromptInput) -> ChatPromptTemplate:
        """Build a fully formatted ChatPromptTemplate from the given input.

        Args:
            prompt_input: The user question and context chunks.

        Returns:
            A LangChain ChatPromptTemplate ready to be passed to ChatOllama.
        """
        logger.info(
            "Building RAG prompt | questionChars=%d | contextChars=%d",
            len(prompt_input.user_question),
            len(prompt_input.retrieved_chunks),
        )
        return self._chat_prompt

    def format_messages(self, prompt_input: PromptInput) -> list:
        """Return the list of formatted message dictionaries.

        Useful for debugging / logging before invoking the LLM.
        """
        messages = self._chat_prompt.format_messages(
            retrieved_chunks=prompt_input.retrieved_chunks,
            user_question=prompt_input.user_question,
        )
        logger.debug(
            "Formatted prompt messages | messageCount=%d",
            len(messages),
        )
        for i, msg in enumerate(messages):
            logger.debug(
                "  Message[%d] | role=%s | contentChars=%d",
                i,
                msg.type,
                len(msg.content) if isinstance(msg.content, str) else 0,
            )
        return messages