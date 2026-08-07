import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  FileText,
  Search,
  Scale,
  TrendingUp,
  Bot,
  User,
  ArrowLeft,
  Copy,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { HeroSection } from "./components/HeroSection";
import { PromptCard } from "./components/PromptCard";
import { ChatComposer } from "./components/ChatComposer";
import { UploadChip } from "./components/UploadChip";
import type { MockFile } from "./components/UploadChip";
import { DragOverlay } from "./components/DragOverlay";
import { LoadingIndicator } from "./components/LoadingIndicator";

const SUGGESTIONS = [
  {
    title: "Summarize uploaded PDF",
    subtitle: "Extract metrics, key takeaways, and action items",
    icon: FileText,
    prompt: "Please summarize the attached document. List the top 3 action items and any financial metrics.",
  },
  {
    title: "Generate CRM insights",
    subtitle: "Identify growth opportunities and sales trends",
    icon: TrendingUp,
    prompt: "Analyze the uploaded CRM logs and identify which accounts are at risk and where we have expansion opportunities.",
  },
  {
    title: "Search across documents",
    subtitle: "Find clauses, terms, or specifications instantly",
    icon: Search,
    prompt: "Search all indexed contracts for renewability clauses and list dates/penalties.",
  },
  {
    title: "Explain this contract",
    subtitle: "Locate liability thresholds and termination rules",
    icon: Scale,
    prompt: "Summarize the liability limits and standard termination periods in the uploaded contract agreement.",
  },
];

function App() {
  const [inputText, setInputText] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<MockFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Conversation history simulation
  const [conversation, setConversation] = useState<
    Array<{ role: "user" | "assistant"; text: string; files?: MockFile[] }>
  >([]);

  // Track full-screen drag and drop
  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      // Only trigger if dragging actual files
      if (e.dataTransfer?.types.includes("Files")) {
        setIsDragging(true);
      }
    };
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };
    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      if (e.clientX === 0 && e.clientY === 0) {
        setIsDragging(false);
      }
    };
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        handleFileSelect(e.dataTransfer.files[0]);
      }
    };

    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("drop", handleDrop);
    };
  }, [uploadedFiles]);

  const handleFileSelect = (file: File) => {
    // Generate simple ID and formatted size
    const id = Math.random().toString(36).substring(7);
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    const formattedSize = parseFloat(sizeMB) > 0.1 ? `${sizeMB} MB` : `${(file.size / 1024).toFixed(0)} KB`;

    const newFile: MockFile = {
      id,
      name: file.name,
      size: formattedSize,
      progress: 0,
    };

    setUploadedFiles((prev) => [...prev, newFile]);

    // Simulate upload progress animation
    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += Math.floor(Math.random() * 20) + 10;
      if (currentProgress >= 100) {
        currentProgress = 100;
        clearInterval(interval);
      }

      setUploadedFiles((prev) =>
        prev.map((f) => (f.id === id ? { ...f, progress: currentProgress } : f))
      );
    }, 120);
  };

  const handleRemoveFile = (id: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleSend = () => {
    if (!inputText.trim() || isGenerating) return;

    const userMessageText = inputText;
    const currentFiles = [...uploadedFiles];

    // Add user message to conversation
    setConversation((prev) => [
      ...prev,
      { role: "user", text: userMessageText, files: currentFiles },
    ]);
    setInputText("");
    setUploadedFiles([]); // Reset composer uploads
    setIsGenerating(true);

    // Simulate RAG generation latency
    setTimeout(() => {
      setIsGenerating(false);

      // Simple mock answers depending on context
      let reply = "";
      if (currentFiles.length > 0) {
        reply = `I have successfully analyzed **${currentFiles[0].name}** (${currentFiles[0].size}). Here is the executive analysis:

1. **Overview & Scope**: The document outlines the strategic performance goals and operational benchmarks for the upcoming fiscal quarter.
2. **Key Metrics Identified**: 
   - Operations show a **14% increase** in efficiency metrics compared to historical averages.
   - Resource allocation is optimized at **92% utilization** across key teams.
3. **Action Items**:
   - Establish weekly syncs to monitor the new workflow integration.
   - Validate customer onboarding metrics within 30 days of standard deployment.

*Let me know if you would like me to draft a summary email or run additional compliance checks.*`;
      } else {
        reply = `I ran a search across your indexed documents for: *"${userMessageText}"*.

Here is a summary of the findings:
- **CRM Integration**: The BullMQ worker system is processing background jobs for document extraction and chunking.
- **RAG Capability**: Chunks are embedded using \`nomic-embed-text\` (768-dimension) and stored in PostgreSQL using pgvector.
- **Answer Generation**: The prompt is processed through ChatOllama using \`llama3.2\`.

Would you like me to show the vector search similarity scores or guide you on how to upload additional documents?`;
      }

      setConversation((prev) => [
        ...prev,
        { role: "assistant", text: reply },
      ]);
    }, 2500);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resetChat = () => {
    setConversation([]);
    setInputText("");
    setUploadedFiles([]);
    setIsGenerating(false);
  };

  const isChatStarted = conversation.length > 0;

  return (
    <div className="flex flex-col items-center justify-between min-h-screen bg-[#0b0c10] text-[#f3f4f6] relative py-6 px-4">
      {/* Background radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.03),transparent_65%)] pointer-events-none" />

      {/* Top minimal header */}
      <header className="w-full max-w-6xl flex justify-between items-center z-10 select-none px-4">
        {isChatStarted ? (
          <button
            onClick={resetChat}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:text-neutral-200 transition-all duration-200 text-xs font-semibold cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            New Chat
          </button>
        ) : (
          <div /> // spacer
        )}

        <div className="text-[10px] text-neutral-600 font-semibold tracking-wider uppercase">
          Copilot Platform v1.0
        </div>
      </header>

      {/* Main Section */}
      <main className="flex-1 flex flex-col items-center justify-center w-full max-w-4xl z-10 pt-8 pb-12">
        <AnimatePresence mode="wait">
          {!isChatStarted ? (
            // Home / Landing Page View
            <motion.div
              key="landing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="flex-1 flex flex-col items-center justify-center w-full gap-10"
            >
              {/* Centered Hero Greeting */}
              <HeroSection />

              {/* Suggestions Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-3xl px-4">
                {SUGGESTIONS.map((s, idx) => (
                  <PromptCard
                    key={idx}
                    index={idx}
                    title={s.title}
                    subtitle={s.subtitle}
                    icon={s.icon}
                    onClick={() => setInputText(s.prompt)}
                  />
                ))}
              </div>
            </motion.div>
          ) : (
            // Conversation History View
            <motion.div
              key="chat"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex-1 w-full max-w-2xl flex flex-col gap-6 px-4 py-4 overflow-y-auto"
            >
              {conversation.map((msg, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className={`flex gap-4 w-full p-5 rounded-2xl border ${
                    msg.role === "user"
                      ? "border-neutral-900 bg-neutral-900/10"
                      : "border-neutral-800 bg-neutral-900/40"
                  }`}
                >
                  {/* Avatar Icon */}
                  <div
                    className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${
                      msg.role === "user"
                        ? "bg-neutral-800 text-neutral-300"
                        : "bg-purple-950/40 text-purple-400 border border-purple-500/20"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <User className="w-4 h-4" />
                    ) : (
                      <Bot className="w-4 h-4" />
                    )}
                  </div>

                  {/* Message Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                        {msg.role === "user" ? "You" : "Copilot"}
                      </span>
                      {msg.role === "assistant" && (
                        <button
                          onClick={() => handleCopy(msg.text)}
                          className="flex items-center gap-1 text-[10px] text-neutral-500 hover:text-neutral-300 cursor-pointer transition-colors duration-150"
                        >
                          {copied ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              Copy
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {/* Files attached if user message */}
                    {msg.files && msg.files.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {msg.files.map((file) => (
                          <div
                            key={file.id}
                            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-neutral-800 bg-neutral-950/60 text-neutral-300 text-xs"
                          >
                            <FileText className="w-3.5 h-3.5 text-purple-400" />
                            <span className="font-semibold">{file.name}</span>
                            <span className="text-[10px] text-neutral-500">{file.size}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Message text with custom formatting */}
                    <div
                      className="text-sm text-neutral-200 leading-relaxed font-normal whitespace-pre-wrap select-text"
                      dangerouslySetInnerHTML={{
                        // Simple custom markdown parser simulator (bold & bullets)
                        __html: msg.text
                          .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                          .replace(/\*(.*?)\*/g, "<em>$1</em>")
                          .replace(
                            /^- (.*?)$/gm,
                            `<li class="list-disc list-inside ml-2 py-0.5 text-neutral-300">$1</li>`
                          ),
                      }}
                    />
                  </div>
                </motion.div>
              ))}

              {/* Generating loading state */}
              {isGenerating && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full"
                >
                  <LoadingIndicator />
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Composer Section at the bottom */}
      <footer className="w-full flex flex-col items-center gap-4 z-10">
        <ChatComposer
          value={inputText}
          onChange={setInputText}
          onSend={handleSend}
          onFileSelect={handleFileSelect}
          isGenerating={isGenerating}
        >
          {uploadedFiles.map((file) => (
            <UploadChip
              key={file.id}
              file={file}
              onRemove={handleRemoveFile}
            />
          ))}
        </ChatComposer>

        {/* Small bottom footer terms link */}
        <div className="flex items-center gap-1.5 text-[10px] text-neutral-600 font-semibold select-none leading-none mt-2">
          <Sparkles className="w-3 h-3 text-purple-500/80 animate-pulse" />
          AI Copilot answers can display summary findings. Always verify details.
        </div>
      </footer>

      {/* File Drag and Drop Fullscreen Overlay */}
      <AnimatePresence>
        {isDragging && <DragOverlay isVisible={isDragging} />}
      </AnimatePresence>
    </div>
  );
}

export default App;
