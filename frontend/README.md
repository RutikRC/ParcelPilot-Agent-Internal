# AI CRM Copilot Frontend UI

A premium, interactive AI landing page for the **AI CRM Copilot** document intelligence system. This interface is built with **React**, **TypeScript**, **Tailwind CSS v4.0**, and **Framer Motion** to deliver a sleek ChatGPT/Claude-like user experience.

---

## 🚀 Technology Stack

- **Framework**: [React 19](https://react.dev/) + [TypeScript 5](https://www.typescriptlang.org/)
- **Build Tool**: [Vite 8](https://vite.dev/)
- **Styling**: [Tailwind CSS v4.0](https://tailwindcss.com/) (using CSS-first configuration and `@tailwindcss/vite` compiler plugin)
- **Animations**: [Framer Motion](https://www.framer.com/motion/) for fluid page transitions, card hover effects, drag-and-drop animations, and chip appearances
- **Icons**: [Lucide React](https://lucide.dev/) for crisp, scalable line icons

---

## ✨ Features Implemented

1. **ChatGPT-style Layout**: Centered alignment of greetings, document shortcut cards, and chat composers. 
2. **Suggested Prompt Cards**: Four interactive shortcut templates that populate the text input when clicked.
3. **Full-Screen Drag & Drop**: Dragging files over the window activates a beautiful glassmorphic overlay. Dropping files queues a mockup upload indicator.
4. **Simulated File Upload Progress**: Uploaded files show interactive chips above the input with progress animations (`0%` to `100%`) and removal options.
5. **Interactive RAG Generation Loop**: Sending queries displays a shimmering text-block skeleton combined with dancing dots, followed by mock markdown-formatted summaries with source citation references.
6. **Ultra-Responsive Styling**: Stacks naturally on mobile and tablet form factors, converting button text to icon-only controls on tiny viewports.

---

## 📁 Component Architecture

The interface is structured modularly:

```text
frontend/src/
  ├── components/
  │   ├── HeroSection.tsx       # Logo, Beta badge, and main header greeting
  │   ├── PromptCard.tsx        # Dynamic suggestions templates with hover lifts
  │   ├── ChatComposer.tsx      # Main input, hidden file inputs, and actions
  │   ├── UploadChip.tsx        # File chip with upload status and removal trigger
  │   ├── DragOverlay.tsx       # Fullscreen blur screen for file drag events
  │   └── LoadingIndicator.tsx  # Shimmering skeleton loader for RAG latency
  ├── App.tsx                   # Main state orchestration (files, queries, loading)
  └── index.css                 # Tailwind v4 configuration and Google Fonts imports
```

---

## 🛠️ Installation & Development

### 1. Prerequisites
Ensure you have [Node.js](https://nodejs.org/) (v18+) installed.

### 2. Install Dependencies
Run the installation command inside the `frontend` folder:
```bash
# On Windows PowerShell (resolving Execution Policy constraints)
cmd /c npm install

# Or standard terminal:
npm install
```

### 3. Run Development Server
Start the local server:
```bash
cmd /c npm run dev
```
Open `http://localhost:5173` in your browser.

### 4. Build Production Bundle
Compile code and asset packages:
```bash
cmd /c npm run build
```

---

## 🔗 Integration Roadmap

To connect this UI to the existing Node.js backend:
1. Replace the simulated state inside `handleSend` ([App.tsx](file:///E:/AI%20CRM/frontend/src/App.tsx)) with a real API call to:
   - `POST http://localhost:5000/api/v1/chat` with `{ question: inputText, context: [...] }`.
2. Connect the `ChatComposer` file input triggers with the document upload backend endpoint:
   - `POST http://localhost:5000/api/documents/upload` to queue files into BullMQ.
3. Fetch vector embeddings and similarity scores to display realistic reference citations on generated text.
