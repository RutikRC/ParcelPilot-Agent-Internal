# Phase 1 Data Foundation

Status: NOT VERIFIED

## 1. Objective

Phase 1 provides the ParcelPilot structured assessment dataset, source-document metadata, and integration with the existing extraction, chunking, embedding, BullMQ, and pgvector pipeline. It does not implement ParcelPilot agent behavior.

## 2. Source files

Place the original files in:

- `data/assessment/workbook/ParcelPilot_Assessment_Data.xlsx`
- `data/assessment/documents/01_Support_Policy_v3_CURRENT.pdf`
- `data/assessment/documents/02_Support_Policy_v2_DEPRECATED.pdf`
- `data/assessment/documents/03_Cancellation_and_Service_Credit_SOP_v4.pdf`
- `data/assessment/documents/04_Product_Operations_Guide_and_Known_Issues.pdf`
- `data/assessment/documents/05_Northstar_Logistics_Enterprise_Agreement.pdf`
- `data/assessment/documents/06_LumenWorks_Service_Agreement.pdf`

The scripts do not modify these source files.

## 3. Workbook sheets and exact columns

Required sheets are `README`, `accounts`, `orders`, and `tickets`.

`accounts`: `account_id`, `account_name`, `plan`, `status`, `csm`, `contract_file`, `premium_support`, `notes`

`orders`: `order_id`, `account_id`, `carrier`, `status`, `booked_at`, `pickup_window_start`, `pickup_window_end`, `pickup_actual_at`, `shipment_fee_inr`, `carrier_fault`, `customer_fault`, `cancellation_requested_at`, `notes`

`tickets`: `ticket_id`, `account_id`, `created_at`, `status`, `subject`, `description`, `channel`, `assigned_to`, `last_customer_message_at`, `historical_resolution`

## 4. Database schema

`backend/src/module/assessment/migrate.js` applies the repository migration convention. It creates `accounts`, `orders`, `tickets`, and `assessment_dataset_metadata`. Orders and tickets reference `accounts.account_id`; account deletion cascades to both child tables.

Indexes cover `orders.account_id`, `orders.status`, `orders.pickup_window_end`, `tickets.account_id`, `tickets.status`, and `tickets.created_at`. An expression index supports document lookup by metadata account ID.

`created_at` on tickets is the workbook value. `ingested_at` and `updated_at` are separate ingestion metadata.

## 5. Relationships

- `orders.account_id -> accounts.account_id`
- `tickets.account_id -> accounts.account_id`
- `accounts.contract_file -> documents.original_name`
- customer agreement `documents.metadata.account_id -> accounts.account_id`
- `documents.id -> document_chunks.document_id -> document_embeddings.document_id`

## 6. Dataset snapshot

The ingestion script stores dataset name `ParcelPilot Assessment Data`, snapshot `2026-08-16 11:00 Asia/Kolkata`, currency `INR`, and the source workbook path in `assessment_dataset_metadata`.

## 7. Document metadata

The six PDFs are classified deterministically:

| File | `document_type` | `document_status` |
|---|---|---|
| `01_Support_Policy_v3_CURRENT.pdf` | `support_policy` | `current` |
| `02_Support_Policy_v2_DEPRECATED.pdf` | `support_policy` | `deprecated` |
| `03_Cancellation_and_Service_Credit_SOP_v4.pdf` | `operational_sop` | `current` |
| `04_Product_Operations_Guide_and_Known_Issues.pdf` | `product_operations` | `current` |
| `05_Northstar_Logistics_Enterprise_Agreement.pdf` | `customer_agreement` | `current` |
| `06_LumenWorks_Service_Agreement.pdf` | `customer_agreement` | `current` |

Metadata is stored in the existing `documents.metadata` JSONB column. `account_id` is added only after resolving the agreement filename against the ingested workbook account `contract_file`; no customer ID is hard-coded. `effective_date` remains an optional metadata field for source records that provide it. `historical_resolution` remains historical context and is never promoted to policy metadata.

## 8. Contract mapping approach

`ingest-documents.js` reads `accounts.account_id` and the basename of `accounts.contract_file`, then maps matching agreement filenames. Missing or unmatched files are logged and not assigned an invented account.

## 9. Ingestion process

`ingest_assessment_workbook.py` validates first, reads `README`, then accounts, orders, and tickets, and performs all writes in one transaction. Each table uses primary-key upserts, so reruns update source values instead of creating duplicates.

`ingest-documents.js` creates or updates document records by filename and enqueues new records as `DOCUMENT_RECEIVED` in the existing BullMQ pipeline. The existing workers continue through extraction, chunking, embeddings, and vector indexing.

## 10. Validation implementation

`validate_assessment_data.py` checks required sheets and columns, IDs, duplicate IDs, required foreign keys, foreign-key references, timestamp values, booleans, numeric values, and contract files. It exits nonzero and reports every problem found; it does not drop invalid rows.

## 11. Manual verification procedure

Do not run these commands automatically. From the repository root:

```bash
cd /mnt/e/calquity-assessment/AI-Automation-Agent-Workflow-Chat-Orchestration
```

```bash
source .venv/bin/activate
python -m pip install -r scripts/requirements.txt
node backend/src/module/assessment/migrate.js
python scripts/inspect_assessment_workbook.py
python scripts/validate_assessment_data.py
python scripts/ingest_assessment_workbook.py
node backend/src/module/assessment/ingest-documents.js
```

Before starting Node, configure `backend/.env` for WSL PostgreSQL with one consistent set of values:

```dotenv
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=<your-password>
DB_SSLMODE=require
DATABASE_URL=postgresql://postgres:<your-password>@127.0.0.1:5432/postgres
```

Run each long-running service in its own WSL terminal and keep every terminal open. Run PDF registration after PostgreSQL, Redis, and the backend environment are available.

Terminal 1, Ollama:

```bash
ollama pull nomic-embed-text
ollama serve
```

Terminal 2, AI service, from the repository root:

```bash
source .venv/bin/activate
uvicorn app.main:app --reload --app-dir ai-service
```

Terminal 3, backend API and worker, from the repository root:

```bash
npm --prefix backend install
npm --prefix backend run dev
```

See the SQL and API checks below. Replace connection placeholders with local environment values; never put secrets in this document.

## 12. Manual SQL checks

```sql
SELECT * FROM accounts ORDER BY account_id;
SELECT * FROM orders ORDER BY order_id;
SELECT * FROM tickets ORDER BY ticket_id;
SELECT * FROM assessment_dataset_metadata ORDER BY id;

SELECT o.order_id, o.account_id, a.account_name
FROM orders o JOIN accounts a ON a.account_id = o.account_id;

SELECT t.ticket_id, t.account_id, a.account_name
FROM tickets t JOIN accounts a ON a.account_id = t.account_id;

SELECT a.account_id, a.contract_file, d.id AS document_id,
       d.original_name, d.metadata->>'document_type' AS document_type,
       d.metadata->>'document_status' AS document_status
FROM accounts a
LEFT JOIN documents d ON d.original_name = a.contract_file AND d.is_deleted = false;

SELECT id, original_name, metadata, status, processing_stage
FROM documents WHERE original_name LIKE '0%_%.pdf' ORDER BY original_name;

SELECT de.document_id, de.chunk_id, vector_dims(de.embedding) AS dimensions
FROM document_embeddings de ORDER BY de.document_id, de.chunk_id;
```

## 13. Manual API checks

The search endpoint is `POST http://localhost:5000/api/v1/search/` and expects JSON:

```powershell
curl.exe -X POST http://localhost:5000/api/v1/search/ -H "Content-Type: application/json" -d "{\"query\":\"What is the cancellation policy?\",\"limit\":5}"
```

Inspect a document with `GET http://localhost:5000/api/documents/<document-id>` and list documents with `GET http://localhost:5000/api/documents/`.

Expected behavior: valid workbook data is upserted without duplicate primary keys; agreement metadata contains the account resolved from the workbook; current and deprecated policy metadata remain distinguishable; queued documents progress through the existing pipeline; search results expose document filename, type, status, account ID, chunk ID, content, and similarity. These behaviors are intentionally NOT VERIFIED here.

## 14. Queue and PostgreSQL inspection

Use the configured Redis database without printing credentials:

```bash
redis-cli -h 127.0.0.1 -p 6379 -n 0 LLEN bull:document-processing:wait
redis-cli -h 127.0.0.1 -p 6379 -n 0 KEYS 'bull:document-processing:*'
```

Inspect processing state with the `documents` query above, and inspect embeddings with the `document_embeddings` query above. Do not infer successful processing solely from a queued job; check each stored stage manually.

## 15. Known limitations

The supplied binary workbook and PDFs are not generated by the implementation. The document pipeline still depends on the configured AI service, Redis, PostgreSQL, pgvector, and running workers. The existing embedding dimension remains 768. Effective dates are optional because they are not invented when absent from source data.

## 16. Phase 2 handoff

Not implemented: LangGraph ParcelPilot agent, planner, business tools, SLA or service-credit calculations, escalation or confirmation workflows, autonomous actions, ParcelPilot frontend, and Phase 2 business logic.