# ParcelPilot AI Support & Operations Agent

AI-powered support and operations copilot for ParcelPilot, designed to answer customer-support questions using authoritative documentation and structured operational data, perform multi-step reasoning, and safely execute support actions with explicit user confirmation.

---

## Overview

ParcelPilot AI Support & Operations Agent combines:

- Document-based retrieval (RAG)
- Structured operational-data lookup
- Customer/account context
- Multi-step agentic tool orchestration
- Source reliability and conflict handling
- Role-based access control
- Human-in-the-loop confirmation
- Auditable state-changing actions

The system is designed around the ParcelPilot assessment dataset and demonstrates how an AI agent can move beyond simple question answering into grounded operational workflows.

---

## Key Capabilities

### 1. Grounded Document Q&A

The agent can retrieve information from the supplied ParcelPilot documentation, including:

- Current support policy
- Deprecated support policy
- Cancellation and service-credit SOP
- Product operations guide
- Customer-specific enterprise agreements

The agent returns answers grounded in retrieved evidence rather than relying solely on model knowledge.

### 2. Structured Operational Data

The system imports:

```text
ParcelPilot_Assessment_Data.xlsx
```

The workbook contains:

```text
README
accounts
orders
tickets
```

The structured data is stored in PostgreSQL and exposed to the AI agent through controlled tools.

### 3. Agent Tools

Recommended tools include:

```text
search_documents
get_account
get_order
get_ticket
search_tickets
calculate_sla_status
calculate_service_credit
prepare_escalation
```

State-changing operations require explicit confirmation.

---

# Architecture

```text
                         ┌──────────────────────┐
                         │     React / Vite     │
                         │       Chat UI        │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │   Node.js / Express  │
                         │      API Layer       │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │   Python / FastAPI   │
                         │     AI Service       │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │      LangGraph       │
                         │    Agent Workflow    │
                         └──────────┬───────────┘
                                    │
                    ┌───────────────┼────────────────┐
                    ▼               ▼                ▼
              Document Tools   Data Tools       Action Tools
                    │               │                │
                    ▼               ▼                ▼
              PostgreSQL + pgvector             Audit Layer
                    │
          ┌─────────┴──────────┐
          ▼                    ▼
      Documents          Operational Data
                         accounts/orders/tickets

                         Redis + BullMQ
                              │
                              ▼
                    Async document processing
```

---

# Assessment Data

## Source Documents

The supplied documents include:

```text
01_Support_Policy_v3_CURRENT.pdf
02_Support_Policy_v2_DEPRECATED.pdf
03_Cancellation_and_Service_Credit_SOP_v4.pdf
04_Product_Operations_Guide_and_Known_Issues.pdf
05_Northstar_Logistics_Enterprise_Agreement.pdf
06_LumenWorks_Service_Agreement.pdf
```

## Structured Workbook

The workbook contains four sheets:

```text
README
accounts
orders
tickets
```

### README

Contains dataset metadata.

Known metadata:

```text
Dataset snapshot:
2026-08-16 11:00 Asia/Kolkata

Currency:
INR
```

The snapshot timestamp should be used as the reference time for time-dependent calculations.

### accounts

Exact source columns:

```text
account_id
account_name
plan
status
csm
contract_file
premium_support
notes
```

Relationship:

```text
accounts.account_id
        │
        ├── orders.account_id
        │
        └── tickets.account_id
```

`contract_file` links an account to its customer-specific agreement PDF.

### orders

Exact source columns:

```text
order_id
account_id
carrier
status
booked_at
pickup_window_start
pickup_window_end
pickup_actual_at
shipment_fee_inr
carrier_fault
customer_fault
cancellation_requested_at
notes
```

### tickets

Exact source columns:

```text
ticket_id
account_id
created_at
status
subject
description
channel
assigned_to
last_customer_message_at
historical_resolution
```

`historical_resolution` is historical context only and should not override current policies, SOPs, or customer agreements.

---

# Source Reliability

The system should distinguish between current, deprecated, customer-specific, and historical information.

A practical authority model is:

```text
1. Applicable customer-specific agreement
2. Current support policy
3. Current cancellation/service-credit SOP
4. Current product operations documentation
5. Historical tickets
6. Deprecated documents
```

If evidence conflicts and the system cannot confidently resolve the conflict, it should explain the uncertainty instead of inventing an answer.

---

# Access Control

Authorization must be enforced by backend services and tools, not by the LLM.

Example roles:

```text
support_agent
support_manager
```

Tool calls should receive authenticated context such as:

```text
user_id
role
account_scope
```

The tool layer must enforce authorization before querying operational data.

State-changing actions should perform authorization checks again immediately before mutation.

---

# Human-in-the-Loop Actions

State-changing operations must not be executed directly from an LLM response.

Workflow:

```text
User Request
     │
     ▼
Agent Investigation
     │
     ▼
Retrieve Evidence
     │
     ▼
Prepare Action
     │
     ▼
User Confirmation
     │
     ▼
Authorization Re-check
     │
     ▼
Execute Action
     │
     ▼
Audit Log
     │
     ▼
Return Result
```

Example:

```text
User:
Escalate this SLA-risk ticket.

Agent:
I found ticket TICKET-XXX.
Reason: SLA risk.
Evidence: ...
Proposed action: Escalate to operations.

Confirm escalation?
```

Only after explicit confirmation should the state-changing operation execute.

---

# Agent Workflow

```text
START
  │
  ▼
classify_request
  │
  ▼
identify_entities
  │
  ▼
check_access
  │
  ▼
plan_tools
  │
  ├───────────────┐
  ▼               ▼
document_search   structured_data
  │               │
  └───────┬───────┘
          ▼
evaluate_sources_and_conflicts
          │
          ▼
reason_and_decide
          │
      ┌───┴────┐
      │        │
      ▼        ▼
    Answer   prepare_action
                 │
                 ▼
          await_confirmation
                 │
                 ▼
           execute_action
                 │
                 ▼
               audit
                 │
                 ▼
             response
```

---

# Example Workflows

## Customer-specific Cancellation

```text
Can Northstar cancel ORD-1001 without a cancellation fee?
```

Expected workflow:

```text
Order lookup
    ↓
Account lookup
    ↓
Customer agreement
    ↓
Current policy / SOP
    ↓
Conflict check
    ↓
Decision
    ↓
Evidence-backed response
```

## Service Credit

```text
A pickup was delayed because of carrier fault.
Is the customer eligible for a service credit?
```

The agent should:

1. Identify the order.
2. Retrieve pickup timestamps.
3. Check `carrier_fault`.
4. Check `customer_fault`.
5. Retrieve applicable service-credit rules.
6. Check the customer agreement when applicable.
7. Perform deterministic eligibility/calculation logic.
8. Explain the result with evidence.

## SLA Investigation

```text
Which high-severity tickets are at risk of SLA breach?
```

The agent should:

1. Search relevant tickets.
2. Inspect ticket status and timestamps.
3. Use the workbook snapshot time.
4. Retrieve applicable SLA guidance.
5. Calculate risk.
6. Return affected tickets and evidence.

## Escalation

```text
Escalate this ticket to the operations team.
```

Expected flow:

```text
Investigate
   ↓
Prepare escalation
   ↓
Show evidence
   ↓
Ask confirmation
   ↓
User confirms
   ↓
Execute
   ↓
Audit
```

---

# Technology Stack

## Frontend

- React
- Vite
- Tailwind CSS

## Backend

- Node.js
- Express.js
- TypeScript/JavaScript
- JWT authentication
- REST APIs

## AI Service

- Python
- FastAPI
- LangGraph
- LangChain where appropriate

## AI / Retrieval

- LLM provider
- Embeddings
- PostgreSQL
- pgvector
- RAG

## Infrastructure

- PostgreSQL
- Redis
- BullMQ
- Docker
- Nginx where required

---

# Project Structure

```text
parcelpilot-ai-agent/
│
├── frontend/
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── services/
│       ├── hooks/
│       └── ...
│
├── backend/
│   └── src/
│       ├── modules/
│       │   ├── auth/
│       │   ├── documents/
│       │   ├── agent/
│       │   ├── actions/
│       │   └── audit/
│       │
│       ├── workers/
│       └── ...
│
├── ai-service/
│   └── app/
│       ├── agent/
│       │   ├── graph.py
│       │   ├── state.py
│       │   └── nodes/
│       │
│       ├── tools/
│       │   ├── document_search.py
│       │   ├── structured_data.py
│       │   └── actions.py
│       │
│       ├── retrieval/
│       ├── services/
│       └── api/
│
├── database/
│   ├── migrations/
│   └── seeds/
│
├── data/
│   └── assessment/
│
├── docs/
│   ├── architecture.md
│   ├── phase-0-baseline.md
│   ├── product.md
│   └── demo-script.md
│
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

---

# Development Phases

## Phase 0 — Baseline & Freeze

Verify the existing AI CRM Copilot foundation.

```text
[ ] Git baseline created
[ ] PostgreSQL verified
[ ] pgvector verified
[ ] Redis verified
[ ] Backend verified
[ ] AI service verified
[ ] Document ingestion verified
[ ] Embeddings verified
[ ] Semantic retrieval verified
[ ] Existing RAG chat verified
[ ] Known issues documented
[ ] Baseline tagged
```

No ParcelPilot-specific features should be implemented during Phase 0.

## Phase 1 — ParcelPilot Data Foundation

Import and validate:

```text
README
accounts
orders
tickets
```

Create the PostgreSQL representation while preserving the source-field mapping.

Connect:

```text
accounts.contract_file
        ↓
Customer Agreement PDF
        ↓
Document Retrieval
```

## Phase 2 — Structured Tools

Implement:

```text
get_account
get_order
get_ticket
search_tickets
calculate_sla_status
calculate_service_credit
```

Tools must enforce account-level access control.

## Phase 3 — Agent Orchestration

Implement the LangGraph workflow.

The agent should dynamically determine whether a request requires:

```text
Document search
Structured lookup
Calculation
Multiple tools
```

## Phase 4 — State-Changing Actions

Implement the action workflow:

```text
prepare_escalation
confirm_escalation
execute_escalation
```

Explicit confirmation is mandatory.

## Phase 5 — Security & Reliability

Implement:

- RBAC
- Account scoping
- Source authority
- Current/deprecated handling
- Customer-specific overrides
- Conflict detection
- Audit logging

## Phase 6 — Frontend

Build the React chat interface.

The UI should expose:

- Conversation
- Tool activity
- Sources
- Retrieved evidence
- Action proposals
- Confirmation controls
- Errors/loading states

## Phase 7 — Testing

Test:

- Document retrieval
- Structured data lookup
- Multi-tool workflows
- Customer-specific agreements
- Deprecated policies
- Historical tickets
- Cross-account access
- Confirmation bypass attempts
- State-changing actions

## Phase 8 — Deployment

Containerize and deploy:

```text
Frontend
Backend
AI Service
PostgreSQL
Redis
```

Add health checks and production configuration.

---

# Definition of Done

The project is complete when:

- [ ] User can authenticate.
- [ ] Agent can answer document-based questions.
- [ ] Agent can retrieve account data.
- [ ] Agent can retrieve order data.
- [ ] Agent can retrieve ticket data.
- [ ] Agent can combine structured data and documents.
- [ ] Agent supports multiple distinct tools.
- [ ] Customer-specific agreements are correctly considered.
- [ ] Deprecated sources are handled correctly.
- [ ] Historical ticket resolutions are treated as context.
- [ ] Access control is enforced at backend/tool level.
- [ ] State-changing actions require explicit confirmation.
- [ ] Actions are audited.
- [ ] UI displays sources/tool activity.
- [ ] Representative assessment workflows work end-to-end.
- [ ] Application runs from documented setup instructions.
- [ ] Architecture and product decisions are documented.
- [ ] Demo can be completed in approximately five minutes.

---

# Assessment Guardrails

1. Do not hard-code answers for specific order IDs or ticket IDs.
2. Do not invent source workbook columns.
3. Do not treat `historical_resolution` as authoritative current policy.
4. Do not allow the LLM to bypass authorization.
5. Do not execute state-changing actions without confirmation.
6. Do not let a generic policy silently override an applicable customer agreement.
7. Do not ignore the workbook snapshot time.
8. Do not rely exclusively on an LLM prompt for security controls.
9. Do not expose customer data outside the authenticated user's scope.
10. Prefer deterministic application code for calculations.

---

# Environment Variables

Create:

```text
.env
```

from:

```text
.env.example
```

Example:

```env
NODE_ENV=development

PORT=5000

DATABASE_URL=

REDIS_HOST=localhost
REDIS_PORT=6379

JWT_SECRET=
JWT_REFRESH_SECRET=

AI_SERVICE_URL=http://localhost:8000

LLM_API_KEY=
LLM_MODEL=

EMBEDDING_MODEL=
```

Never commit real credentials.

---

# Local Development

## Backend

```bash
cd backend
npm install
npm run dev
```

## AI Service

```bash
cd ai-service

python -m venv .venv

# Windows
.venv\Scripts\activate

# Linux/macOS
source .venv/bin/activate

pip install -r requirements.txt

uvicorn app.main:app --reload --port 8000
```

## Frontend

```bash
cd frontend
npm install
npm run dev
```

## Infrastructure

Using Docker Compose:

```bash
docker compose up -d
```

---

# API Overview

## Authentication

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
GET  /api/auth/me
```

## Agent

```text
POST /api/v1/agent/chat
```

## Actions

```text
POST /api/v1/actions/escalations/prepare
POST /api/v1/actions/escalations/:id/confirm
GET  /api/v1/escalations/:id
```

## Audit

```text
GET /api/v1/audit
```

Exact routes may evolve during implementation.

---

# Security Principles

### Backend-enforced authorization

Permissions are checked in backend services and tools.

### Least privilege

Users receive access only to permitted accounts/data.

### Human confirmation

State-changing operations require explicit confirmation.

### Auditability

Important actions and tool operations are recorded.

### Grounded answers

The agent should prefer supplied evidence over unsupported model knowledge.

### Fail safely

When evidence is conflicting or insufficient, the agent should communicate uncertainty rather than fabricate an answer.

---

# Testing Strategy

## Unit Tests

Test:

- Tool validation
- Authorization
- Calculations
- Source ranking
- Confirmation state

## Integration Tests

Test:

- PostgreSQL
- pgvector
- Agent tools
- Document retrieval
- Action workflow

## End-to-End Tests

Representative scenarios:

```text
Northstar cancellation
Service-credit investigation
SLA-risk ticket investigation
Escalation with confirmation
```

## Security Tests

Attempt:

```text
Cross-account lookup
Unauthorized escalation
Confirmation bypass
Action replay
```

All unauthorized operations should be rejected appropriately.

---

# Demo Flow

Recommended five-minute demonstration:

### 1. Architecture

Explain:

```text
React
 ↓
Node API
 ↓
LangGraph Agent
 ↓
Tools
 ↓
PostgreSQL + pgvector
```

### 2. Document + Data Question

Demonstrate a question requiring:

```text
Order
+
Account
+
Customer Agreement
+
Current Policy
```

### 3. Multi-Step Investigation

Show the agent using multiple tools.

### 4. Reliability

Demonstrate handling of:

```text
Current policy
vs
Deprecated policy
vs
Customer agreement
```

### 5. Action

Ask the agent to escalate a ticket.

Show:

```text
Prepare
 ↓
Evidence
 ↓
Confirmation
 ↓
Execute
 ↓
Audit
```

---

# Product Direction

The initial product is an internal support and operations copilot.

Potential future enhancements:

- Proactive issue detection
- SLA-risk monitoring
- Customer health insights
- Ticket clustering
- Repeated-issue detection
- Suggested responses
- Automated follow-up tasks
- Operations dashboards
- Human approval workflows
- Additional CRM integrations

These are secondary to the assessment's core requirements.

---

# Design Principles

1. **Groundedness over hallucination**
2. **Security over convenience**
3. **Explicit confirmation over autonomous mutation**
4. **Deterministic calculations over LLM arithmetic**
5. **Current authoritative sources over historical context**
6. **Customer-specific rules where applicable**
7. **Transparent tool execution**
8. **Simple UI over unnecessary complexity**

---

# License

This repository is created for assessment and demonstration purposes.
