const crypto = require("crypto");
const chatService = require("./chat.service");

/**
 * POST /api/v1/chat
 *
 * Full RAG pipeline: receives a user question, retrieves relevant chunks
 * via semantic search, generates an answer using FastAPI + LangChain + ChatOllama,
 * and returns the answer with source references.
 */
const answerQuestion = async (req, res, next) => {
  try {
    const traceId = crypto.randomUUID();
    const { question } = req.body;

    const result = await chatService.answer({ question });

    return res.status(200).json({
      success: true,
      message: "Answer generated successfully",
      data: {
        answer: result.answer,
        sources: result.sources,
      },
      traceId,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  answerQuestion,
};