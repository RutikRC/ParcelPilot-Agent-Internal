const crypto = require("crypto");
const searchService = require("../services/search.service");

/**
 * POST /api/v1/search
 *
 * Accepts a search query and limit, generates a query embedding via FastAPI,
 * and returns the most semantically relevant chunks from PostgreSQL using pgvector.
 */
const searchChunks = async (req, res, next) => {
  try {
    const traceId = crypto.randomUUID();
    const { query, limit = 5 } = req.body;

    const { results } = await searchService.search({ query, limit });

    return res.status(200).json({
      success: true,
      message: "Relevant chunks retrieved successfully",
      data: results,
      traceId,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  searchChunks,
};