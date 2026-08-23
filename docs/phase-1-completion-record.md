# ParcelPilot Phase 1 Completion Record

**Phase:** Phase 1 - Data Foundation  
**Implementation status:** Completed  
**Manual verification status:** Performed by the developer through WSL runtime checks  
**Date:** 2026-08-23

## 1. Scope Completed

Phase 1 established the ParcelPilot data foundation on top of the existing AI CRM foundation.

Completed areas:

- Assessment workbook inspection
- Workbook validation
- PostgreSQL structured-data tables
- Accounts, orders, and tickets relationships
- Dataset snapshot metadata
- Supplied PDF registration
- Deterministic document classification
- Account-to-contract document mapping
- Existing BullMQ document pipeline integration
- Text extraction
- Text chunking
- Embedding generation with Ollama
- pgvector document indexing
- Retrieval metadata support
- WSL setup and manual verification documentation

Phase 2 business behavior was not implemented.

## 2. Source Data

### Workbook

```text
data/assessment/workbook/ParcelPilot_Assessment_Data.xlsx
```

Required sheets:

- `README`
- `accounts`
- `orders`
- `tickets`

### Supplied documents

```text
data/assessment/documents/01_Support_Policy_v3_CURRENT.pdf
data/assessment/documents/02_Support_Policy_v2_DEPRECATED.pdf
data/assessment/documents/03_Cancellation_and_Service_Credit_SOP_v4.pdf
data/assessment/documents/04_Product_Operations_Guide_and_Known_Issues.pdf
data/assessment/documents/05_Northstar_Logistics_Enterprise_Agreement.pdf
data/assessment/documents/06_LumenWorks_Service_Agreement.pdf
```

The source workbook and PDFs remain external source files. The implementation does not modify them.

## 3. Files Implemented

### Assessment scripts

- `scripts/inspect_assessment_workbook.py`
  - Reports workbook path, sheets, row counts, columns, missing values, duplicate IDs, and basic types.
- `scripts/validate_assessment_data.py`
  - Validates sheets, columns, IDs, foreign keys, timestamps, booleans, numeric values, and contract files.
- `scripts/ingest_assessment_workbook.py`
  - Validates first, then upserts dataset metadata, accounts, orders, and tickets in a transaction.
- `scripts/assessment/config.py`
  - Centralizes paths, dataset metadata, workbook schema, document classification, and database configuration.
- `scripts/assessment/workbook.py`
  - Reads Excel sheets without changing source data.
- `scripts/assessment/db.py`
  - Provides environment-driven PostgreSQL access using psycopg2.
- `scripts/requirements.txt`
  - Declares `openpyxl`, `psycopg2-binary`, and `python-dotenv`.

### Backend assessment integration

- `backend/src/module/assessment/assessment.repository.js`
  - Creates structured tables and indexes.
- `backend/src/module/assessment/migrate.js`
  - Runs the assessment schema migration.
- `backend/src/module/assessment/ingest-documents.js`
  - Registers the six PDFs and sends them to the existing BullMQ pipeline.
  - Resolves agreement account IDs from `accounts.contract_file`.
  - Recovers interrupted extraction and embedding jobs on rerun.
- `backend/src/module/assessment/document-metadata.helper.js`
  - Provides deterministic PDF classification and optional effective-date metadata.
- `backend/src/module/document/document.repository.js`
  - Exposes the existing table migration helper and merges metadata safely.
- `backend/src/module/search/repositories/search.repository.js`
  - Returns filename, document type, document status, account ID, chunk ID, content, and similarity.
- `backend/.env.example`
  - Provides a non-secret environment template.

### Documentation

- `docs/phase-1-data-foundation.md`
  - Full Phase 1 technical specification and manual verification guide.
- `docs/phase-1-completion-record.md`
  - This implementation and runtime handoff record.

## 4. Database Foundation

The migration creates:

```text
accounts
orders
tickets
assessment_dataset_metadata
```

Relationships:

```text
orders.account_id  -> accounts.account_id
tickets.account_id -> accounts.account_id
accounts.contract_file -> documents.original_name
documents.metadata.account_id -> accounts.account_id
documents.id -> document_chunks.document_id
document_chunks.id -> document_embeddings.chunk_id
```

Indexes were added for:

- `orders.account_id`
- `orders.status`
- `orders.pickup_window_end`
- `tickets.account_id`
- `tickets.status`
- `tickets.created_at`
- document metadata account IDs

The dataset metadata stores:

```text
Dataset:  ParcelPilot Assessment Data
Snapshot: 2026-08-16 11:00 Asia/Kolkata
Currency: INR
```

Ticket `created_at` remains the source timestamp. It is not overwritten with ingestion time.

## 5. Document Classification

| File | Type | Status | Account mapping |
|---|---|---|---|
| `01_Support_Policy_v3_CURRENT.pdf` | `support_policy` | `current` | None |
| `02_Support_Policy_v2_DEPRECATED.pdf` | `support_policy` | `deprecated` | None |
| `03_Cancellation_and_Service_Credit_SOP_v4.pdf` | `operational_sop` | `current` | None |
| `04_Product_Operations_Guide_and_Known_Issues.pdf` | `product_operations` | `current` | None |
| `05_Northstar_Logistics_Enterprise_Agreement.pdf` | `customer_agreement` | `current` | Resolved from workbook |
| `06_LumenWorks_Service_Agreement.pdf` | `customer_agreement` | `current` | Resolved from workbook |

The implementation does not hard-code customer IDs. It matches the basename of the workbook `contract_file` value to the document filename.

## 6. WSL Execution Sequence

All runtime commands were run manually from WSL.

Unless otherwise stated, start from the repository root:

```bash
cd /mnt/e/calquity-assessment/AI-Automation-Agent-Workflow-Chat-Orchestration
```

### Install Python dependencies

```bash
source .venv/bin/activate
pip install -r scripts/requirements.txt
```

### Create or update the assessment schema

```bash
node backend/src/module/assessment/migrate.js
```

### Validate and ingest workbook

```bash
python scripts/inspect_assessment_workbook.py
python scripts/validate_assessment_data.py
python scripts/ingest_assessment_workbook.py
```

The workbook ingestion output reported validation success and committed the dataset metadata, accounts, orders, and tickets.

### Register PDF documents

Run this after PostgreSQL, Redis, and the backend environment are available.

```bash
node backend/src/module/assessment/ingest-documents.js
```

The document ingestion registered all six supplied PDFs and enqueued them as `DOCUMENT_RECEIVED` jobs. Agreement account mappings were resolved from the workbook.

### Configure WSL PostgreSQL

Before starting Node, ensure `backend/.env` contains one consistent set of local PostgreSQL settings:

```dotenv
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=<your-password>
DB_SSLMODE=require
DATABASE_URL=postgresql://postgres:<your-password>@127.0.0.1:5432/postgres
```

Do not commit or share the real password.

### Start Ollama

Run these in a dedicated WSL terminal. Pull the model before starting the blocking server command:

```bash
ollama pull nomic-embed-text
ollama serve
```

### Start the AI service

Run from the repository root in a separate terminal:

```bash
source .venv/bin/activate
uvicorn app.main:app --reload --app-dir ai-service
```

Health endpoint:

```bash
curl http://localhost:8000/api/v1/health
```

### Start the backend API and worker

Run from the repository root in a separate terminal:

```bash
npm --prefix backend install
npm --prefix backend run dev
```

The combined backend command starts both the API and worker. The API listens on `0.0.0.0:5000`; the AI service uses Ollama at `http://localhost:11434`.

## 7. Runtime Issue Resolution

### Issue 1: Missing Python helper import

The workbook script initially raised:

```text
NameError: name 'get_documents_dir' is not defined
```

Resolution: imported `get_documents_dir` from `assessment.config`.

### Issue 2: PostgreSQL password was not loaded

The Python script initially defaulted to localhost without a password when run from WSL.

Resolution: `scripts/assessment/config.py` now loads the existing `backend/.env` using `python-dotenv`, while exported shell variables continue to take precedence.

### Issue 3: AI service was unavailable

The worker initially reported:

```text
AI service is unavailable (connection refused)
```

Resolution: started the FastAPI service on port `8000`.

### Issue 4: Ollama embedding model was unavailable

The AI service initially returned embedding failures because Ollama was unavailable or did not have `nomic-embed-text` installed.

Resolution: started Ollama and made the `nomic-embed-text` model available.

### Issue 5: Previously failed jobs were exhausted

Jobs that failed while the AI service was unavailable had reached zero remaining attempts.

Resolution: the document ingestion script now requeues existing documents stalled at:

- `uploaded` + `pending`
- `uploaded` + `TEXT_EXTRACTION`
- `chunked` + `EMBEDDING_GENERATION`

Completed documents are not duplicated during normal reruns.

## 8. Manual Runtime Evidence

The developer supplied worker logs showing the following progression for the six documents:

```text
DOCUMENT_RECEIVED
TEXT_EXTRACTION
TEXT_EXTRACTED
TEXT_CHUNKING
TEXT_CHUNKED
EMBEDDING_GENERATION
EMBEDDINGS_GENERATED
VECTOR_INDEXING
READY
```

The logs also showed:

- AI extraction responses with HTTP 200
- AI chunking responses with HTTP 200
- Ollama embedding responses with HTTP 200
- Embedding model `nomic-embed-text`
- Embedding dimension `768`
- Vector indexing jobs completing with status `READY`

This section records developer-supplied runtime output. It does not replace the SQL and API checks in the manual verification guide.

## 9. Manual Database Checks

Run these manually using the PostgreSQL client:

```sql
SELECT * FROM accounts ORDER BY account_id;
SELECT * FROM orders ORDER BY order_id;
SELECT * FROM tickets ORDER BY ticket_id;
SELECT * FROM assessment_dataset_metadata ORDER BY id;

SELECT o.order_id, o.account_id, a.account_name
FROM orders o
JOIN accounts a ON a.account_id = o.account_id;

SELECT t.ticket_id, t.account_id, a.account_name
FROM tickets t
JOIN accounts a ON a.account_id = t.account_id;

SELECT a.account_id, a.contract_file, d.id AS document_id,
       d.original_name,
       d.metadata->>'document_type' AS document_type,
       d.metadata->>'document_status' AS document_status
FROM accounts a
LEFT JOIN documents d
  ON d.original_name = a.contract_file
 AND d.is_deleted = false;

SELECT id, original_name, metadata, status, processing_stage
FROM documents
WHERE original_name LIKE '0%_%.pdf'
ORDER BY original_name;

SELECT de.document_id, de.chunk_id, vector_dims(de.embedding) AS dimensions
FROM document_embeddings de
ORDER BY de.document_id, de.chunk_id;
```

## 10. Manual Retrieval Check

Start the backend API, then send:

```bash
curl -X POST http://localhost:5000/api/v1/search/ \
  -H 'Content-Type: application/json' \
  -d '{"query":"What is the cancellation policy?","limit":5}'
```

Inspect a document:

```bash
curl http://localhost:5000/api/documents/<document-id>
```

Retrieval results should include:

```text
documentId
filename
documentType
documentStatus
accountId
chunkId
content
similarity
```

## 11. Reprocessing Behavior

A normal rerun of document ingestion is idempotent:

```bash
node backend/src/module/assessment/ingest-documents.js
```

It does not reprocess documents already complete as `READY`.

It does recover documents stalled during initial ingestion, extraction, or embedding. To intentionally reprocess a completed document, the current implementation requires an explicit reset/reprocessing operation; there is no `--force-reprocess` option.

## 12. Phase 2 Boundary

The following items were intentionally not implemented:

- LangGraph ParcelPilot agent
- Agent planner
- `get_account` tool
- `get_order` tool
- `get_ticket` tool
- `search_tickets` tool
- SLA calculation tool
- Service-credit calculation tool
- Escalation tool
- Action confirmation workflow
- Autonomous actions
- ParcelPilot frontend
- Phase 2 business logic

## 13. Final Handoff

Phase 1 implementation is recorded as completed. The supplied runtime logs show the data and document pipeline progressing through extraction, chunking, embedding generation, and vector indexing. Database, queue, embedding, and retrieval checks remain available for independent manual inspection in [phase-1-data-foundation.md](phase-1-data-foundation.md).
