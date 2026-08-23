# PHASE 3 FINAL VERIFICATION

## Changes made

### 1. Grounded answer generation (`backend/src/module/parcelpilot/agent/response-builder.js`)

**Why necessary:** The previous `buildGroundedAnswer` only returned a meaningful answer when there was a business decision with a `reason` or structured facts. For generic policy questions (e.g., "What is the cancellation policy?"), there were no business decisions or facts — only evidence chunks — so it fell through to the generic fallback: "I have retrieved the relevant information for your request."

**Fix:** Added a third step to `buildGroundedAnswer` that builds an answer from the retrieved authoritative/supporting evidence. It sorts evidence by `authorityRank` (lowest = highest authority) and returns the top evidence's text (truncated to 500 chars). This means policy questions now return the actual policy text (e.g., "BOOKED, not yet PICKED_UP: May be cancelled. No fee within 30 minutes of booking. After 30 minutes, charge INR 250...").

### 2. Customer agreement applicability (`backend/src/module/parcelpilot/tools/knowledge.tool.js`)

**Why necessary:** A generic query like "What is the cancellation policy?" was returning customer agreements for ACCT-001 (Northstar) and ACCT-002 (LumenWorks) as authoritative evidence. This is incorrect because the query does not identify a customer/account, so no customer-specific agreement is applicable.

**Fix:** When NO `accountId` is provided to `searchKnowledge`, the tool now filters out `customer_agreement` chunks before applying source precedence. This means:
- **Generic policy question** (no account): only global/current policy sources (support policy, SOP, product ops) are returned.
- **Customer-specific question** (account resolved via order/ticket/query): the customer agreement is included and outranks global policy per the existing `policy.service.js` precedence.

This distinguishes **source authority** (precedence ranking) from **source applicability** (whether a customer agreement applies to the current request).

## LLM model used

- **Generation:** `qwen2.5:latest` via Ollama (reused existing `aiClient.callRagGenerate()` → FastAPI `/api/v1/chat/generate` → ChatOllama)
- **Embedding:** `nomic-embed-text` (NOT modified)

## Generic policy retrieval behavior

For "What is the cancellation policy?" (no account context):
- Knowledge search excludes customer agreements
- Returns current support policy, current SOP, and product operations evidence
- The answer is generated from the authoritative SOP text (e.g., cancellation fee conditions)
- No customer agreement is cited

## Customer-specific policy behavior

For "Can Northstar cancel ORD-1001?" or when an order/ticket resolves to ACCT-001:
- The order resolves to its account
- The customer agreement (Northstar) becomes applicable
- Northstar agreement outranks current support policy and SOP per `policy.service.js`
- The deterministic cancellation service remains authoritative

## Cancellation behavior

- **"Can I cancel ORD-1001?"** → `CANCELLATION_QUESTION` → `ANSWERED` (informational)
- **"Cancel ORD-1001."** → `CANCELLATION_ACTION` → `NEEDS_CONFIRMATION` with `pendingAction: { type: "CANCEL_ORDER", targetId: "ORD-1001" }` (if eligible)
- **Already requested** → `ANSWERED` with deterministic reason ("Cancellation has already been requested for this order.")
- **Missing order** → `NEEDS_INFORMATION` with `order_id: UNKNOWN`
- **NOT_FOUND order** → `CANNOT_DETERMINE`

## Confirmation behavior

- Action requests produce a pending action and request confirmation
- User confirmation ("Yes") preserves the pending action and sets `confirmationReceived: true`
- NO state mutation occurs — Phase 4 will execute

## Fallback behavior

If Ollama generation fails, the agent falls back to the deterministic grounded answer from `buildGroundedAnswer` (which now includes policy text from evidence). The LLM failure is logged and the deterministic answer is returned. No crash, no hallucination.

## Test results

All 46 tests pass:

- **Phase 3 Final (3 tests):** Grounded answer generation, customer agreement exclusion, deterministic cancellation reason
- **Phase 3.1 (11 tests):** Action intent detection, action response builder
- **Phase 3 (14 tests):** Output schema, conversation manager, confirmation detection, follow-up detection, response builder
- **Phase 2B (18 tests):** Request context, tool planner, evidence aggregator, missing data, decision context, conflict resolver

## Remaining warnings

- The `dummy.pdf` document in the vector index is excluded from knowledge search via the `metadata->>'source' = 'parcelpilot_assessment'` filter
- Customer agreements are only surfaced when an account is resolved; generic queries use global policy sources
- Phase 4 (state-changing actions) is NOT implemented