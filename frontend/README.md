# ParcelPilot AI Support Frontend UI

This is the front-end chat interface for the **ParcelPilot AI Support Assistant**. It provides a sleek, light-theme, customer-support dashboard designed to help agents and users query policies, lookup shipment/ticket details, and execute actions with interactive confirmation steps.

---

## 🚀 Technology Stack

- **Framework**: [React 19](https://react.dev/) + [TypeScript 5](https://www.typescriptlang.org/)
- **Build Tool**: [Vite 8](https://vite.dev/)
- **Styling**: [Tailwind CSS v4.0](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)

---

## ✨ Features Implemented

1. **ParcelPilot Chat Dashboard**: Slate light-theme sidebar and main conversation feed focused on shipment support operations.
2. **Session Persistence**: Maintains `conversationId` across requests in the React state.
3. **New Conversation**: Clear existing states and start a fresh session at any time.
4. **Interactive Action Confirmation**: 
   - Prominently displays inline `[✓ Confirm]` and `[✕ Cancel]` buttons when a status of `NEEDS_CONFIRMATION` is returned.
   - Confirm posts `"Yes, proceed."` and Cancel posts `"No, cancel."` using the active session ID.
5. **Action Status Alerts**:
   - `ACTION_COMPLETED`: Rendered as a green success alert.
   - `ACTION_REJECTED`: Rendered as a neutral status alert.
   - `ACTION_FAILED`: Rendered as a danger/error alert.
   - `REQUIRES_MANAGER_APPROVAL`: Rendered as a blue information card summarizing the approval details (reason, creditAmount, nextStep).
6. **Citation References**: Rendered with page/document icons under the assistant bubbles.
7. **Traceability**: An expandable Debug Panel displays the raw JSON output and `traceId` for developers.

---

## 📁 Component Architecture

```text
frontend/
  ├── src/
  │   ├── api/
  │   │   └── parcelpilot.ts    # Centralized API client wrapper for /chat endpoint
  │   ├── App.tsx               # Main UI view, state handlers, confirmation UX
  │   ├── index.css             # Light theme layout overrides and Google Fonts imports
  │   └── main.tsx              # StrictMode entry loader
  ├── .env                      # Local environment variable configuration
  └── .env.example              # Environment variables template
```

---

## 🛠️ Environment Variables

Create a `.env` file in the `frontend` folder with the following contents:
```env
VITE_API_BASE_URL=http://127.0.0.1:5000
```

---

## 💻 How to Run

### Step 1: Start the Backend Server
Make sure the PostgreSQL database is online and the backend is running.
```bash
cd backend
npm run dev
```
*(By default, this hosts the API at `http://127.0.0.1:5000`)*

### Step 2: Start the Frontend Client
In a new terminal window:
```bash
cd frontend
npm install
npm run dev
```
*(Open the dev server url: `http://localhost:5173`)*

---

## 🧪 Testing Instructions

Verify the end-to-end flow with these test cases in the UI:

### TEST 1: Policy Grounding
- **Message**: `"What is the cancellation policy?"`
- **Expected Status**: `ANSWERED`
- **Result**: Grounded policy answer with a citation like `📄 03 Cancellation and Service Credit SOP`.

### TEST 2: Intent Evaluation
- **Message**: `"Can I cancel ORD-1001?"`
- **Expected Status**: `ANSWERED`
- **Result**: Confirms cancellation eligibility details.

### TEST 3: Action Execution Confirmation
- **Message**: `"Cancel ORD-1001."`
- **Expected Status**: `NEEDS_CONFIRMATION`
- **Result**: Prominently shows `Confirm` / `Cancel` buttons, status displays "Awaiting confirmation".

### TEST 4: Action Execution Completion
- **Click**: `Confirm`
- **Expected Message Sent**: `"Yes, proceed."`
- **Expected Status**: `ACTION_COMPLETED`
- **Result**: Renders green check banner. The order `ORD-1001` status inside the Postgres database updates to `CANCELLED`.

### TEST 5: Resetting Conversation
- **Click**: `New Conversation` (in sidebar)
- **Result**: Clears messages and session `conversationId`. Next message starts a fresh interaction.

### TEST 6: Action Execution Rejection
- **Message**: `"Cancel ORD-1001."` -> Click **Cancel**
- **Expected Status**: `ACTION_REJECTED`
- **Result**: Displays neutral warning card; order status is untouched.
