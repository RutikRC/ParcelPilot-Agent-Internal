/**
 * ParcelPilot Assessment Document Ingestion
 *
 * Ingests the six supplied assessment PDFs through the EXISTING document
 * processing pipeline:
 *
 *   documents table (with metadata)
 *        ↓
 *   BullMQ DOCUMENT_RECEIVED
 *        ↓
 *   TEXT_EXTRACTION → TEXT_CHUNKING → EMBEDDING_GENERATION → VECTOR_INDEXING
 *
 * The account_id for customer agreements is resolved from the workbook's
 * accounts sheet via the contract_file column. No account IDs are hard-coded.
 *
 * Usage:
 *   node src/module/assessment/ingest-documents.js
 */

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const pool = require("../../config/db");
const documentRepository = require("../document/document.repository");
const { enqueueDocumentReceived } = require("../queues/producers/document.producer");
const { getClassification, buildDocumentMetadata } = require("./document-metadata.helper");
const logger = require("../../utils/logger");

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DOCUMENTS_DIR = process.env.ASSESSMENT_DOCUMENTS
  ? path.resolve(process.env.ASSESSMENT_DOCUMENTS)
  : path.resolve(__dirname, "../../../../data/assessment/documents");

const SUPPLIED_PDFS = [
  "01_Support_Policy_v3_CURRENT.pdf",
  "02_Support_Policy_v2_DEPRECATED.pdf",
  "03_Cancellation_and_Service_Credit_SOP_v4.pdf",
  "04_Product_Operations_Guide_and_Known_Issues.pdf",
  "05_Northstar_Logistics_Enterprise_Agreement.pdf",
  "06_LumenWorks_Service_Agreement.pdf",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const computeChecksum = (filePath) =>
  new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);

    stream.on("error", (error) => reject(error));
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });

/**
 * Resolve account_id -> contract_file from the accounts table.
 * Returns a map of contract filename -> account_id.
 */
const resolveAccountContractMap = async () => {
  const { rows } = await pool.query(`
    SELECT account_id, contract_file
    FROM accounts
    WHERE contract_file IS NOT NULL AND contract_file != '';
  `);

  const map = {};
  for (const row of rows) {
    const filename = path.basename(String(row.contract_file));
    if (filename) {
      map[filename] = row.account_id;
    }
  }
  return map;
};

/**
 * Check whether a document with the same original_name already exists.
 * Returns the existing document row, or null.
 */
const findExistingDocument = async (originalName) => {
  const { rows } = await pool.query(`
    SELECT *
    FROM documents
    WHERE original_name = $1
      AND is_deleted = false
    LIMIT 1;
  `, [originalName]);
  return rows[0] || null;
};

// ---------------------------------------------------------------------------
// Main ingestion
// ---------------------------------------------------------------------------

const ingestDocuments = async () => {
  logger.info("Starting ParcelPilot assessment document ingestion", {
    documentsDir: DOCUMENTS_DIR,
  });

  if (!fs.existsSync(DOCUMENTS_DIR)) {
    logger.error("Documents directory does not exist", { documentsDir: DOCUMENTS_DIR });
    process.exit(1);
  }

  // 1. Resolve account mapping from the workbook data (accounts table)
  const accountMap = await resolveAccountContractMap();
  logger.info("Resolved account contract mapping", { count: Object.keys(accountMap).length });

  // 2. Ensure the documents table exists
  await documentRepository.ensureTable();

  // 3. Ingest each supplied PDF
  for (const filename of SUPPLIED_PDFS) {
    const filePath = path.join(DOCUMENTS_DIR, filename);

    if (!fs.existsSync(filePath)) {
      logger.warn("Supplied PDF not found, skipping", { filename, filePath });
      continue;
    }

    const classification = getClassification(filename);
    if (!classification) {
      logger.warn("No classification for PDF, skipping", { filename });
      continue;
    }

    // Resolve account_id for customer agreements
    const accountId = accountMap[filename] || null;

    // Build metadata
    const metadata = buildDocumentMetadata(filename, accountId);

    // Check for existing document (idempotent)
    const existing = await findExistingDocument(filename);
    if (existing) {
      logger.info("Document already exists, updating metadata", {
        filename,
        documentId: existing.id,
      });
      await documentRepository.updateDocumentMetadata(existing.id, metadata);

      // Recover a document created before the enqueue step completed without
      // duplicating work for documents already being processed or completed.
      if (
        (existing.status === "uploaded" &&
          ["pending", "TEXT_EXTRACTION"].includes(existing.processing_stage)) ||
        (existing.status === "chunked" &&
          existing.processing_stage === "EMBEDDING_GENERATION")
      ) {
        await enqueueDocumentReceived({
          documentId: existing.id,
          userId: existing.user_id,
        });
      }
      continue;
    }

    // Create the document record
    const checksum = await computeChecksum(filePath);
    const document = await documentRepository.createDocument({
      id: crypto.randomUUID(),
      uuid: crypto.randomUUID(),
      user_id: null,
      title: filename,
      original_name: filename,
      stored_name: filename,
      mime_type: "application/pdf",
      extension: "pdf",
      size: fs.statSync(filePath).size,
      path: path.relative(path.resolve(__dirname, "../../../"), filePath).replace(/\\/g, "/"),
      version: 1,
      status: "uploaded",
      processing_stage: "pending",
      checksum,
      description: `ParcelPilot assessment document: ${filename}`,
      tags: [classification.document_type, classification.document_status],
      metadata,
    });

    logger.info("Document created, enqueueing for processing", {
      filename,
      documentId: document.id,
      documentType: classification.document_type,
      documentStatus: classification.document_status,
      accountId: accountId || null,
    });

    // Enqueue into the existing BullMQ pipeline
    await enqueueDocumentReceived({
      documentId: document.id,
      userId: null,
    });
  }

  logger.info("Assessment document ingestion completed.");
  process.exit(0);
};

ingestDocuments().catch((error) => {
  logger.error("Assessment document ingestion failed", error);
  process.exit(1);
});