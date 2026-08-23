# ParcelPilot AI Automation Agent — Workflow & Chat Orchestration

A production-oriented conversational AI support agent for ParcelPilot that converts natural-language customer requests into grounded answers and safe, auditable business actions.

The completed system combines:

- Conversational intent detection
- Retrieval-Augmented Generation (RAG)
- PostgreSQL + pgvector retrieval
- Ollama local LLM inference
- Ollama `nomic-embed-text` embeddings
- Qwen 2.5 / Llama 3.2 local models
- Deterministic business-rule services
- Action planning and execution
- Explicit confirmation for state-changing actions
- Manager-approval enforcement for sensitive service credits
- Idempotent database mutations
- Pending-action expiration
- Audit logging
- React/Vite/Tailwind frontend integration

## 1. Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                     React Frontend                          │
│                  Vite + Tailwind CSS                        │
│                                                             │
│  Chat UI → conversationId → confirmation controls           │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               │ HTTP POST /chat
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    ParcelPilot API                           │
│                 Node.js / Express                           │
│                                                             │
│  POST /api/v1/parcelpilot/chat                              │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                     Agent Layer                              │
│                                                             │
│  Conversation State • Intent Detection • Orchestration       │
│  Response Builder • Confirmation / Rejection Handling        │
└──────────────┬───────────────────────────┬────────────────────┘
               │                           │
               ▼                           ▼
┌────────────────────────┐      ┌──────────────────────────────┐
│     Retrieval Layer    │      │       Action Executor        │
│                        │      │                              │
│ Query embedding        │      │ Pending-action validation     │
│ Vector similarity      │      │ TTL / expiry                 │
│ Source filtering       │      │ Deterministic revalidation   │
└────────────┬───────────┘      │ Registered handlers          │
             │                  │ Idempotency                  │
             ▼                  └──────────────┬───────────────┘
┌────────────────────────┐                     ▼
│ PostgreSQL + pgvector  │      ┌──────────────────────────────┐
│                        │      │ Deterministic Business       │
│ Documents              │      │ Services                     │
│ Chunks                 │      │                              │
│ Embeddings             │      │ Cancellation                 │
│ Orders                 │      │ Service Credit               │
│ Tickets                │      │ Escalation                   │
└────────────────────────┘      └──────────────┬───────────────┘
                                    PostgreSQL mutation
                                               │
                                               ▼
                                      action_audit_logs
```

### Core execution principle

The LLM can interpret requests and produce grounded responses, but it **cannot directly mutate the database**.

State-changing requests follow:

```text
Natural language
      ↓
Intent detection
      ↓
Deterministic business evaluation
      ↓
Pending action
      ↓
Explicit user confirmation
      ↓
Action executor
      ↓
Deterministic revalidation
      ↓
Database mutation
      ↓
Audit log
```

## 2. Supported Actions

| Action | Purpose |
|---|---|
| `CANCEL_ORDER` | Cancel an eligible order |
| `ISSUE_SERVICE_CREDIT` | Issue a deterministic service credit |
| `ESCALATE_TICKET` | Escalate a support ticket to the deterministic target team |

## 3. Technology Stack

### Orchestration Backend (Node.js)

- Node.js
- Express
- JavaScript
- PostgreSQL (with pgvector extension)
- REST API

### AI Service (Python)

- Python
- FastAPI
- Uvicorn (ASGI server)
- LangChain / LangGraph
- PyMuPDF & python-docx (Document extraction)

### Frontend

- React (TypeScript)
- Vite
- Tailwind CSS

### AI Models (Ollama local inference)

- `qwen2.5:latest` (General LLM for orchestration / RAG)
- `llama3.2:latest` (Fallback LLM)
- `nomic-embed-text:latest` (Embeddings)

## 4. Required Local AI Dependencies

The verified environment used:

| Component | Model | Required |
|---|---|---|
| General LLM | `qwen2.5:latest` | Yes |
| Supported LLM | `llama3.2:latest` | Yes / supported fallback |
| Embeddings | `nomic-embed-text:latest` | Yes |
| Optional local model | `gemma4:26b` | No |

The verified local environment contained:

```text
qwen2.5:latest
llama3.2:latest
nomic-embed-text:latest
gemma4:26b
```

`gemma4:26b` is not required by the completed application.

### Install Ollama models

```bash
ollama pull qwen2.5:latest
ollama pull llama3.2:latest
ollama pull nomic-embed-text:latest
```

Verify:

```bash
ollama list
```

Verify the Ollama API:

```bash
curl http://127.0.0.1:11434/api/tags
```

Expected service URL:

```text
http://127.0.0.1:11434
```

## 5. Embedding / RAG Architecture

Documents are processed into chunks and embedded with `nomic-embed-text`.

```text
Documents
   ↓
Text extraction
   ↓
Chunking
   ↓
nomic-embed-text
   ↓
Vector embeddings
   ↓
PostgreSQL + pgvector
```

At query time:

```text
User question
   ↓
nomic-embed-text
   ↓
Query vector
   ↓
pgvector similarity search
   ↓
Relevant chunks
   ↓
Grounded agent response
```

The local embedding workflow does not require an external embedding API.

## 6. Prerequisites

Install:

1. Node.js / npm
2. PostgreSQL
3. PostgreSQL `pgvector`
4. Ollama
5. Git

The verified development environment used WSL2 on Windows.

## 7. Repository Structure

The main application structure is:

```text
AI-Automation-Agent-Workflow-Chat-Orchestration/
│
├── backend/                  # Node.js/Express orchestration backend
│   ├── src/
│   │   └── module/
│   │       └── parcelpilot/
│   │           ├── agent/
│   │           ├── actions/
│   │           ├── audit/
│   │           └── ...
│   ├── tests/
│   └── package.json
│
├── ai-service/               # FastAPI Python AI micro-service (chunking, embedding, RAG)
│   ├── app/
│   │   ├── api/
│   │   ├── routers/
│   │   └── main.py
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/                 # React/Vite/Tailwind frontend chat client
│   ├── src/
│   └── package.json
│
└── README.md
```

## 8. Backend Setup

### Step 1 — Enter the project

```bash
cd AI-Automation-Agent-Workflow-Chat-Orchestration
```

### Step 2 — Install dependencies

```bash
cd backend
npm install
```

### Step 3 — Configure environment

If the repository provides `.env.example`:

```bash
cp .env.example .env
```

Configure the existing project's database, Ollama and application settings.

Typical values are:

```env
APP_ENV=development
PORT=5000
DATABASE_URL=postgresql://postgres:<password>@localhost:5432/<database>
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_LLM_MODEL=qwen2.5:latest
OLLAMA_EMBEDDING_MODEL=nomic-embed-text:latest
```

Use the **exact variable names already defined by the repository**.

Never commit `.env` or secrets.

## 9. PostgreSQL Setup

Start PostgreSQL:

```bash
sudo service postgresql status
```

If necessary:

```bash
sudo service postgresql start
```

Connect:

```bash
psql -U postgres
```

Create/use the database configured by the project.

Then connect to it:

```bash
psql -U postgres -d <database>
```

Enable pgvector:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Verify:

```sql
SELECT extname
FROM pg_extension
WHERE extname = 'vector';
```

Important application tables include:

```text
documents
document_contents
document_chunks
document_embeddings
orders
tickets
service_credits
action_audit_logs
```

Run the repository's database migration/initialization/seed process before starting the backend. Use the exact command exposed by the current `backend/package.json`.

## 10. Start Ollama

Ensure Ollama is running:

```bash
curl http://127.0.0.1:11434/api/tags
```

If required, install the models:

```bash
ollama pull qwen2.5:latest
ollama pull llama3.2:latest
ollama pull nomic-embed-text:latest
```

Then:

```bash
ollama list
```

## 11. Start Backend

From:

```bash
cd backend
```

Run the project's development script:

```bash
npm run dev
```

If the repository uses a different script, inspect:

```bash
npm run
```

The verified backend API is available at:

```text
http://127.0.0.1:5000
```

Primary endpoint:

```text
POST http://127.0.0.1:5000/api/v1/parcelpilot/chat
```

## 12. Start AI Service (Python FastAPI)

The Node.js Express backend delegates document extraction, chunking, embedding, and RAG generation to the FastAPI Python micro-service running on port `8000`.

### Step 1 — Enter the ai-service directory

```bash
cd ai-service
```

### Step 2 — Create and activate virtual environment (Recommended)

On Windows (Command Prompt):
```cmd
python -m venv .venv
.venv\Scripts\activate
```

On Windows (PowerShell):
```powershell
python -m venv .venv
.\.venv\Scripts\activate
```

On macOS/Linux:
```bash
python -m venv .venv
source .venv/bin/activate
```

### Step 3 — Install Python dependencies

```bash
pip install -r requirements.txt
```

### Step 4 — Configure environment variables

Create a `.env` file from the provided example template:

```bash
cp .env.example .env
```

Ensure `APP_PORT=8000` is configured, and modify the database settings (`POSTGRES_*`) and Ollama base URL if necessary.

### Step 5 — Run the AI Service using Uvicorn

Start the server using `uvicorn` with hot-reloading:

```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

The service will run locally at `http://127.0.0.1:8000`. You can inspect and test the interactive API documentation by opening `http://127.0.0.1:8000/docs` in your browser.

---

## 13. Backend API Usage

### Policy question

```bash
curl -X POST http://127.0.0.1:5000/api/v1/parcelpilot/chat   -H "Content-Type: application/json"   -d '{"message":"What is the cancellation policy?"}'
```

Expected behavior:

```text
status: ANSWERED
intent: POLICY_QUESTION
```

The response includes grounded citations.

### Cancellation question

```bash
curl -X POST http://127.0.0.1:5000/api/v1/parcelpilot/chat   -H "Content-Type: application/json"   -d '{"message":"Can I cancel ORD-1001?"}'
```

Eligibility is determined from the order state, pickup window, customer agreement, support policy and deterministic business rules.

## 14. End-to-End Confirmation Flow

Request an action:

```bash
curl -X POST http://127.0.0.1:5000/api/v1/parcelpilot/chat   -H "Content-Type: application/json"   -d '{"message":"Cancel ORD-1001."}'
```

For an eligible order, the API returns:

```text
status: NEEDS_CONFIRMATION
intent: CANCELLATION_ACTION
requiresConfirmation: true
```

It also returns a `pendingAction`, for example:

```json
{
  "type": "CANCEL_ORDER",
  "targetId": "ORD-1001",
  "createdAt": "...",
  "details": {
    "orderId": "ORD-1001",
    "eligible": true,
    "requiresConfirmation": true
  }
}
```

### Confirm

Use the **same `conversationId`** returned by the first request:

```bash
curl -X POST http://127.0.0.1:5000/api/v1/parcelpilot/chat   -H "Content-Type: application/json"   -d '{
    "conversationId":"<conversation-id>",
    "message":"Yes, proceed."
  }'
```

Expected:

```text
status: ACTION_COMPLETED
intent: CANCELLATION_ACTION
pendingAction: null
```

## 15. Verify Database Mutation

```sql
SELECT
    order_id,
    status,
    cancellation_requested_at,
    updated_at
FROM orders
WHERE order_id = 'ORD-1001';
```

Expected after successful cancellation:

```text
ORD-1001 | CANCELLED
```

## 16. Verify Audit Log

```sql
SELECT
    conversation_id,
    action_type,
    target_id,
    status,
    reason,
    trace_id,
    created_at
FROM action_audit_logs
WHERE target_id = 'ORD-1001'
ORDER BY created_at DESC;
```

Expected:

```text
CANCEL_ORDER | ORD-1001 | COMPLETED
```

## 17. Frontend Setup

The frontend provides the user-facing ParcelPilot chat interface.

It must communicate through the backend API and must never connect directly to PostgreSQL.

### Step 1

From repository root:

```bash
cd frontend
```

### Step 2

Install dependencies:

```bash
npm install
```

### Step 3

Create environment configuration if the repository provides an example:

```bash
cp .env.example .env
```

The API base URL should point to the backend:

```env
VITE_API_BASE_URL=http://127.0.0.1:5000
```

Use the exact variable name implemented by the frontend.

### Step 4

Start the frontend:

```bash
npm run dev
```

Vite will print the local URL, typically:

```text
http://localhost:5173
```

Open that URL in the browser.

## 18. Frontend Conversation Handling

The frontend stores the backend-generated `conversationId`.

First request:

```json
{
  "message": "Cancel ORD-1001."
}
```

Backend returns:

```json
{
  "conversationId": "abc-123"
}
```

Confirmation request:

```json
{
  "conversationId": "abc-123",
  "message": "Yes, proceed."
}
```

The same conversation ID is required so the pending action remains associated with the conversation.

## 19. Frontend Confirmation UX

When the API returns:

```text
NEEDS_CONFIRMATION
```

the UI displays the assistant message and confirmation controls:

```text
Customer agreement waives cancellation fees for booked
orders before pickup.

Would you like me to proceed?

[ Confirm ]   [ Cancel ]
```

Confirm sends:

```text
Yes, proceed.
```

Reject sends:

```text
No, cancel.
```

Both use the existing conversation ID.

## 20. Frontend Status Handling

The frontend handles:

| Status | UI behavior |
|---|---|
| `ANSWERED` | Normal assistant response |
| `NEEDS_CONFIRMATION` | Confirmation controls |
| `ACTION_COMPLETED` | Success state |
| `ACTION_REJECTED` | Action not completed |
| `ACTION_FAILED` | Safe failure message |
| `REQUIRES_MANAGER_APPROVAL` | Approval-required message; no mutation |

Citations returned by the API are displayed below grounded responses.

## 21. Complete System Flow

```text
┌──────────────┐
│     User     │
└──────┬───────┘
       ▼
┌──────────────┐
│ React UI     │
└──────┬───────┘
       ▼
POST /api/v1/parcelpilot/chat
       ▼
┌──────────────────┐
│ Agent Service    │
└──────┬───────────┘
       │
       ├──────────────► RAG / pgvector
       │                    │
       │                    ▼
       │              Grounded sources
       │
       └──────────────► Deterministic services
                            │
                            ▼
                     Pending action
                            │
                            ▼
                   NEEDS_CONFIRMATION
                            │
                            ▼
                       User confirms
                            │
                            ▼
                    Action Executor
                            │
                            ▼
                    Revalidation
                            │
                            ▼
                    Action Handler
                            │
                            ▼
                    PostgreSQL mutation
                            │
                            ▼
                     Audit Log
                            │
                            ▼
                    ACTION_COMPLETED
                            │
                            ▼
                        React UI
```

## 22. Safety and Security

### LLM cannot mutate the database

Only registered action handlers invoked by the action executor can perform state-changing database writes.

### Deterministic revalidation

Every action is evaluated again immediately before mutation.

### Confirmation required

No state-changing action is executed merely because the LLM classified a request as an action.

### Conversation binding

The pending action is stored in conversation state and must be confirmed within that conversation.

### Expiration

Pending actions expire after:

```text
15 minutes
```

### Idempotency

Repeated execution of already-completed operations does not create duplicate mutations.

### Safe errors

Internal stack traces are never returned to the user.

## 23. Manager Approval Flow

Service credits can be subject to a deterministic manager-approval rule.

When approval is required, the executor returns:

```text
REQUIRES_MANAGER_APPROVAL
```

with relevant information such as:

- reason
- eligible credit amount
- order ID
- currency
- next step
- `mutated: false`

No database mutation occurs in this branch.

## 24. Audit Lifecycle

State-changing operations are recorded in:

```text
action_audit_logs
```

Lifecycle statuses include:

```text
CONFIRMED
REJECTED
COMPLETED
FAILED
EXPIRED
```

Audit records contain:

- conversation ID
- action type
- target ID
- status
- reason
- trace ID
- timestamp

## 25. Testing

The completed backend suite was verified with:

```text
61 passing
```

Covered areas include:

- Confirmation flow
- Phase 4 actions
- Manager approval
- Agent grounded answers
- Agent action intent
- Agent behavior
- Orchestration

Confirmation-specific coverage includes:

- Positive confirmations
- Negative confirmations
- Ambiguous responses
- No-pending-action safety
- Pending-action persistence
- Rejection clearing

Run the project's full test command from `backend/package.json`. Typically:

```bash
npm test
```

## 26. Final QA Checklist

### Infrastructure

- [ ] PostgreSQL running
- [ ] pgvector enabled
- [ ] Ollama running
- [ ] `qwen2.5:latest` installed
- [ ] `llama3.2:latest` installed
- [ ] `nomic-embed-text:latest` installed

### Backend

- [ ] Dependencies installed
- [ ] Environment configured
- [ ] Database initialized
- [ ] Backend starts
- [ ] Chat API responds

### RAG

- [ ] Documents available
- [ ] Chunks available
- [ ] Embeddings available
- [ ] Policy questions return citations
- [ ] pgvector retrieval works

### Actions

- [ ] Cancellation eligibility works
- [ ] Eligible action returns `NEEDS_CONFIRMATION`
- [ ] Confirmation uses same conversation ID
- [ ] Executor revalidates
- [ ] Successful action returns `ACTION_COMPLETED`
- [ ] Database mutation occurs
- [ ] Audit record is created
- [ ] Rejected actions do not mutate
- [ ] Expired actions do not mutate
- [ ] Manager approval does not mutate

### Frontend

- [ ] Frontend starts
- [ ] Frontend reaches backend
- [ ] Chat messages render
- [ ] Conversation ID persists
- [ ] Confirmation controls work
- [ ] Citations render
- [ ] Action results render
- [ ] Errors are handled safely

## 27. Recommended Assessment Demonstration

Use the following sequence for the final demo:

### 1. Grounded question

```text
What is the cancellation policy?
```

Expected:

```text
ANSWERED
```

with citations.

### 2. Eligibility question

```text
Can I cancel ORD-1001?
```

Expected cancellation eligibility response.

### 3. Action request

```text
Cancel ORD-1001.
```

Expected:

```text
NEEDS_CONFIRMATION
```

### 4. Confirmation

```text
Yes, proceed.
```

Expected:

```text
ACTION_COMPLETED
```

### 5. Database verification

```sql
SELECT order_id, status
FROM orders
WHERE order_id = 'ORD-1001';
```

Expected:

```text
ORD-1001 | CANCELLED
```

### 6. Audit verification

```sql
SELECT
    action_type,
    target_id,
    status,
    created_at
FROM action_audit_logs
WHERE target_id = 'ORD-1001'
ORDER BY created_at DESC;
```

Expected:

```text
CANCEL_ORDER | ORD-1001 | COMPLETED
```

This demonstrates:

```text
User
 ↓
Frontend
 ↓
API
 ↓
Agent
 ↓
RAG / deterministic services
 ↓
Confirmation
 ↓
Action executor
 ↓
Revalidation
 ↓
Database mutation
 ↓
Audit log
 ↓
Frontend result
```

## 28. Troubleshooting

### Ollama unavailable

```bash
curl http://127.0.0.1:11434/api/tags
```

Then ensure Ollama is running.

### Model not found

```bash
ollama list
```

Install missing models:

```bash
ollama pull qwen2.5:latest
ollama pull llama3.2:latest
ollama pull nomic-embed-text:latest
```

### PostgreSQL unavailable

```bash
sudo service postgresql status
```

Then verify `DATABASE_URL`.

### pgvector unavailable

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### Frontend cannot reach backend

Verify:

```bash
curl -X POST http://127.0.0.1:5000/api/v1/parcelpilot/chat   -H "Content-Type: application/json"   -d '{"message":"What is the cancellation policy?"}'
```

Then check the frontend API base URL.

### Confirmation fails

Make sure the confirmation request contains the exact `conversationId` returned by the action-request response:

```json
{
  "conversationId": "<existing-conversation-id>",
  "message": "Yes, proceed."
}
```

Do not start a new conversation for confirmation.

## 29. Development Security

Do not commit:

```text
.env
database passwords
API keys
private credentials
local secrets
```

The frontend must never contain database credentials.

All database mutations must remain behind the backend action executor.

## 30. Final Submission Status

The ParcelPilot assessment implementation has been completed and verified through the complete action lifecycle.

Verified capabilities:

- RAG / grounded policy answering
- Document citations
- Conversation state
- Intent detection
- Cancellation questions
- Cancellation actions
- Confirmation workflow
- Confirmation punctuation handling
- Deterministic action validation
- Action executor
- Action registry
- Cancellation mutation
- Service-credit mutation
- Ticket escalation mutation
- Manager-approval flow
- Idempotency
- Pending-action expiration
- Audit logging
- React frontend integration
- End-to-end API verification
- Database mutation verification
- Full regression testing

Verified backend result:

```text
61 passing
```

Final architecture:

```text
User
 ↓
React / Vite / Tailwind
 ↓
ParcelPilot API
 ↓
Agent
 ↓
RAG + Deterministic Services
 ↓
Confirmation
 ↓
Action Executor
 ↓
Revalidation
 ↓
PostgreSQL Mutation
 ↓
Audit Log
 ↓
Frontend Result
```

The implementation is ready for submission.