import React, { useState, useEffect, useRef } from "react";
import {
  Bot,
  User,
  Send,
  Plus,
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  Terminal,
  ChevronDown,
  ChevronUp,
  Sparkles,
  RefreshCw,
  Loader
} from "lucide-react";
import { sendMessage, type AgentResponse, type Citation } from "./api/parcelpilot";

interface Message {
  role: "user" | "assistant" | "system";
  text: string;
  timestamp: Date;
  response?: AgentResponse;
}

const EXAMPLE_PROMPTS = [
  "What is the cancellation policy?",
  "Can I cancel ORD-1001?",
  "Cancel ORD-1001.",
  "Can I get a service credit for ORD-2002?"
];

function App() {
  const [inputText, setInputText] = useState("");
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<AgentResponse | null>(null);
  const [lastTraceId, setLastTraceId] = useState<string | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom of chat area
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Auto-grow input text area height
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
  }, [inputText]);

  // Reset the conversation state
  const handleNewConversation = () => {
    setMessages([]);
    setConversationId(undefined);
    setError(null);
    setLastResponse(null);
    setLastTraceId(null);
    setInputText("");
  };

  // Trigger api call to send a message
  const handleSendMessage = async (textToSend: string) => {
    const cleanText = textToSend.trim();
    if (!cleanText || isLoading) return;

    // Append user message
    const userMsg: Message = {
      role: "user",
      text: cleanText,
      timestamp: new Date()
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setIsLoading(true);
    setError(null);

    try {
      const result = await sendMessage(cleanText, conversationId);
      if (result.success && result.data) {
        const { conversationId: nextConvId, response: agentResp } = result.data;
        if (nextConvId) {
          setConversationId(nextConvId);
        }
        setLastResponse(agentResp);
        setLastTraceId(result.traceId);

        // Add assistant message
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: agentResp.answer || "",
            timestamp: new Date(),
            response: agentResp
          }
        ]);
      } else {
        throw new Error("Invalid API response format");
      }
    } catch (err: any) {
      console.error("API error:", err);
      const errMsg = "Unable to reach ParcelPilot. Please check that the backend is running.";
      setError(errMsg);

      // Append system/error message in the chat feed
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          text: errMsg,
          timestamp: new Date()
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(inputText);
    }
  };

  // Helper formatting for message timestamps
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Custom Markdown bullet/bold renderer
  const renderMessageText = (text: string) => {
    const boldRegex = /\*\*(.*?)\*\*/g;
    const bulletRegex = /^- (.*?)$/gm;

    const formatted = text
      .replace(boldRegex, "<strong>$1</strong>")
      .replace(bulletRegex, '<li class="list-disc list-inside ml-2 py-0.5">$1</li>');

    return <div dangerouslySetInnerHTML={{ __html: formatted }} />;
  };

  // Render a specific alert based on action status return values
  const renderStatusUI = (resp: AgentResponse) => {
    const status = resp.status;
    switch (status) {
      case "ACTION_COMPLETED":
        return (
          <div className="mt-3 flex items-start gap-2 p-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">✓ Action completed successfully</span>
              <p className="mt-0.5 text-emerald-700">The requested operation was completed and committed to the database.</p>
            </div>
          </div>
        );

      case "ACTION_REJECTED":
        return (
          <div className="mt-3 flex items-start gap-2 p-3 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-xs">
            <AlertTriangle className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Action was not completed</span>
              <p className="mt-0.5 text-slate-600">The action request was rejected or cancelled, and no changes were made.</p>
            </div>
          </div>
        );

      case "ACTION_FAILED":
        return (
          <div className="mt-3 flex items-start gap-2 p-3 rounded-lg border border-rose-200 bg-rose-50 text-rose-800 text-xs">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Action execution failed</span>
              <p className="mt-0.5 text-rose-700">An unexpected system error occurred during execution. Database mutations were reverted.</p>
            </div>
          </div>
        );

      case "REQUIRES_MANAGER_APPROVAL":
        // Extract manager approval metadata
        const details = resp.pendingAction?.details || {};
        const reason = details.reason || "High credit amount or policy deviation requires manager review.";
        const creditAmt = details.creditInr ?? "N/A";
        return (
          <div className="mt-3 flex items-start gap-2.5 p-4 rounded-xl border border-blue-200 bg-blue-50 text-blue-900 text-xs leading-relaxed shadow-sm">
            <Clock className="w-4 h-4 text-blue-600 shrink-0 mt-0.5 animate-pulse" />
            <div className="space-y-1.5">
              <span className="font-bold text-blue-950">Manager approval is required before this action can be executed.</span>
              <div className="text-blue-800 space-y-1">
                <p><span className="font-semibold text-blue-900">Reason:</span> {reason}</p>
                {creditAmt !== "N/A" && (
                  <p><span className="font-semibold text-blue-900">Estimated Credit Amount:</span> {creditAmt} INR</p>
                )}
                <p><span className="font-semibold text-blue-900">Next Step:</span> Escalated to customer support managers for approval. No mutations were performed.</p>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen w-screen bg-slate-50 text-slate-800 overflow-hidden font-sans">
      {/* 1. Sidebar */}
      <aside className="w-80 border-r border-slate-200 bg-white flex flex-col justify-between shrink-0 select-none">
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Brand header */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm shadow-indigo-500/20">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-slate-900 leading-tight">ParcelPilot</h1>
              <p className="text-[11px] text-slate-500 font-medium">AI Support Assistant</p>
            </div>
          </div>

          {/* New Conversation Trigger */}
          <button
            onClick={handleNewConversation}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold tracking-wide transition-all shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            New Conversation
          </button>

          {/* Active Session info card */}
          {conversationId && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-3">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Session</h3>
              <div className="space-y-1.5 text-xs text-slate-600 font-medium">
                <div>
                  <span className="text-slate-400 text-[10px] block">CONVERSATION ID</span>
                  <span className="font-mono text-slate-700 select-all block truncate">{conversationId}</span>
                </div>
                {lastResponse && (
                  <>
                    <div className="pt-1.5">
                      <span className="text-slate-400 text-[10px] block">LAST INTENT</span>
                      <span className="font-semibold text-slate-800">{lastResponse.intent}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">NEXT STEP</span>
                      <span className="text-indigo-600 font-semibold">{lastResponse.nextStep}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Collapsible Debug Panel */}
          {lastResponse && (
            <div className="pt-2">
              <button
                onClick={() => setDebugOpen(!debugOpen)}
                className="w-full flex items-center justify-between py-2 px-1 text-[11px] text-slate-500 hover:text-slate-800 font-bold border-t border-slate-100 transition-colors uppercase tracking-wider cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5" />
                  Debug / Trace info
                </span>
                {debugOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              {debugOpen && (
                <div className="mt-2 p-3 rounded-lg bg-slate-900 text-slate-300 font-mono text-[10px] space-y-2 max-h-60 overflow-y-auto border border-slate-950">
                  <div>
                    <span className="text-slate-500 block">TRACE ID:</span>
                    <span className="text-indigo-400 select-all break-all">{lastTraceId}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">RAW RESPONSE:</span>
                    <pre className="mt-1 whitespace-pre-wrap select-text">{JSON.stringify(lastResponse, null, 2)}</pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="p-6 border-t border-slate-100 flex items-center gap-2">
          {/* Status Dot indicator */}
          <div className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${error ? "bg-red-400" : "bg-emerald-400"}`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${error ? "bg-red-500" : "bg-emerald-500"}`}></span>
          </div>
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            {error ? "API Offline" : "API Connected"}
          </span>
        </div>
      </aside>

      {/* 2. Main Chat Area */}
      <main className="flex-1 flex flex-col justify-between bg-slate-50 relative overflow-hidden">
        {/* Top Header Banner */}
        <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-8 shrink-0 z-10 select-none">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-900">ParcelPilot AI Support</span>
          </div>
          {conversationId && (
            <button
              onClick={handleNewConversation}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-colors text-xs font-semibold cursor-pointer shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reset Session
            </button>
          )}
        </header>

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto px-8 py-8 space-y-6">
          {messages.length === 0 ? (
            /* Empty State Layout */
            <div className="h-full flex flex-col items-center justify-center max-w-xl mx-auto text-center space-y-8 select-none my-auto">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
                <Bot className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold tracking-tight text-slate-900">How can I help with your shipment?</h2>
                <p className="text-sm text-slate-500 leading-relaxed max-w-md mx-auto">
                  Ask policy queries, evaluate package routing, check SLA targets, or request order cancellations instantly.
                </p>
              </div>

              {/* Suggestions Prompts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg pt-4">
                {EXAMPLE_PROMPTS.map((promptText, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(promptText)}
                    className="p-3.5 text-left rounded-xl border border-slate-200 bg-white hover:bg-slate-50/50 hover:border-slate-300 transition-all text-xs font-semibold text-slate-700 hover:text-slate-900 shadow-sm cursor-pointer"
                  >
                    {promptText}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Active Message Flow */
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex gap-4 w-full ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {/* Assistant Bot Icon */}
                  {msg.role === "assistant" && (
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 shadow-sm">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  {/* Message Bubble container */}
                  <div className={`max-w-[85%] space-y-1.5 ${msg.role === "user" ? "text-right" : "text-left"}`}>
                    {/* Timestamp and label header */}
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block px-1">
                      {msg.role === "user" ? "You" : msg.role === "assistant" ? "Agent" : "System"}{" "}
                      <span className="font-normal text-slate-300 ml-1.5">{formatTime(msg.timestamp)}</span>
                    </span>

                    {/* Text container */}
                    <div
                      className={`p-4 rounded-2xl border text-sm leading-relaxed whitespace-pre-wrap select-text ${
                        msg.role === "user"
                          ? "border-indigo-600 bg-indigo-600 text-white shadow-sm"
                          : msg.role === "system"
                          ? "border-red-200 bg-red-50 text-red-800"
                          : "border-slate-200 bg-white text-slate-800 shadow-sm"
                      }`}
                    >
                      {msg.role === "user" || msg.role === "system"
                        ? msg.text
                        : renderMessageText(msg.text)}

                      {/* Render Citations / Sources */}
                      {msg.role === "assistant" && msg.response?.citations && msg.response.citations.length > 0 && (
                        <div className="mt-4 pt-3.5 border-t border-slate-100 space-y-2 select-none">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Sources</span>
                          <div className="flex flex-wrap gap-2 pt-1">
                            {msg.response.citations.map((cit, cIdx) => (
                              <div
                                key={cIdx}
                                className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded bg-slate-50 border border-slate-200 text-[11px] text-slate-600 font-semibold"
                                title={`Source: ${cit.sourceType}`}
                              >
                                <FileText className="w-3.5 h-3.5 text-slate-400" />
                                <span>{cit.document.replace(".pdf", "").replace(/_/g, " ")}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Render Pending Action UX Banner */}
                      {msg.role === "assistant" && msg.response?.pendingAction && (
                        <div className="mt-3 p-3 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between text-xs select-none">
                          <div className="space-y-0.5">
                            <span className="text-slate-400 text-[9px] font-bold block uppercase tracking-wider">Action Requested</span>
                            <span className="font-bold text-slate-800">
                              {msg.response.pendingAction.type === "CANCEL_ORDER" ? "Cancel Order" : msg.response.pendingAction.type}
                            </span>
                            <span className="text-slate-500 block">Order: {msg.response.pendingAction.targetId}</span>
                          </div>
                          <div className="text-right">
                            <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/10">
                              Awaiting confirmation
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Render Status Alert UI */}
                      {msg.role === "assistant" && msg.response && renderStatusUI(msg.response)}

                      {/* Render Confirmation Buttons */}
                      {msg.role === "assistant" && msg.response?.requiresConfirmation && msg.response?.status === "NEEDS_CONFIRMATION" && (
                        <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center gap-3 select-none">
                          <button
                            onClick={() => handleSendMessage("Yes, proceed.")}
                            className="inline-flex items-center justify-center gap-1.5 py-2 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors shadow-sm cursor-pointer"
                          >
                            ✓ Confirm
                          </button>
                          <button
                            onClick={() => handleSendMessage("No, cancel.")}
                            className="inline-flex items-center justify-center gap-1.5 py-2 px-4 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors shadow-sm cursor-pointer"
                          >
                            ✕ Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* User avatar */}
                  {msg.role === "user" && (
                    <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white shrink-0 shadow-sm">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              ))}

              {/* Chat typing/processing indicator */}
              {isLoading && (
                <div className="flex gap-4 justify-start items-start">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 shadow-sm animate-pulse">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="space-y-1 flex-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block px-1">
                      Agent <span className="font-normal text-slate-300 ml-1.5">Processing</span>
                    </span>
                    <div className="inline-flex items-center gap-2 p-4 rounded-2xl border border-slate-200 bg-white shadow-sm text-slate-500 text-xs">
                      <Loader className="w-4 h-4 animate-spin text-indigo-600" />
                      <span>ParcelPilot is composing an answer...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Composer toolbar */}
        <footer className="p-6 border-t border-slate-200 bg-white shrink-0 z-10">
          <div className="max-w-3xl mx-auto flex items-end gap-3 bg-slate-50 border border-slate-200 focus-within:border-indigo-500/50 focus-within:ring-2 focus-within:ring-indigo-500/10 p-2.5 rounded-2xl transition-all">
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              placeholder={isLoading ? "Please wait..." : "Message ParcelPilot..."}
              className="flex-1 bg-transparent border-0 outline-none text-sm text-slate-800 placeholder-slate-400 font-medium py-1.5 px-2.5 resize-none leading-relaxed focus:ring-0 max-h-[180px] overflow-y-auto"
            />
            <button
              onClick={() => handleSendMessage(inputText)}
              disabled={isLoading || !inputText.trim()}
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                isLoading || !inputText.trim()
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                  : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-500/20"
              }`}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <div className="max-w-3xl mx-auto flex items-center justify-center gap-1.5 mt-2.5 text-[10px] text-slate-400 font-bold select-none uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500/80 animate-pulse" />
            <span>ParcelPilot AI can assess shipment cancel eligibility and refund issues.</span>
          </div>
        </footer>
      </main>
    </div>
  );
}

export default App;
