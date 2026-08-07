import React, { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Paperclip, ArrowUp, Loader2 } from "lucide-react";

interface ChatComposerProps {
  value: string;
  onChange: (val: string) => void;
  onSend: () => void;
  onFileSelect: (file: File) => void;
  isGenerating: boolean;
  placeholder?: string;
  children?: React.ReactNode; // Upload chips
}

export const ChatComposer: React.FC<ChatComposerProps> = ({
  value,
  onChange,
  onSend,
  onFileSelect,
  isGenerating,
  placeholder = "Ask anything about your documents...",
  children,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-grow textarea height
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    const newHeight = Math.min(textarea.scrollHeight, 240); // cap at 240px
    textarea.style.height = `${newHeight}px`;
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !isGenerating) {
        onSend();
      }
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFileSelect(files[0]);
      // Reset input value so the same file can be uploaded again
      e.target.value = "";
    }
  };

  const isSendDisabled = !value.trim() || isGenerating;

  return (
    <div className="w-full max-w-4xl px-4">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept=".pdf,.doc,.docx,.txt,.csv,.xlsx"
      />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.4, ease: "easeOut" }}
        className="relative flex flex-col w-full rounded-3xl border border-neutral-800 bg-neutral-900/60 backdrop-blur-md shadow-2xl focus-within:border-purple-500/50 focus-within:ring-1 focus-within:ring-purple-500/20 transition-all duration-300 overflow-hidden"
      >
        {/* Render Upload Chips inside composer if any exist */}
        {children && (
          <div className="flex flex-wrap gap-2.5 px-4 pt-4 pb-2 border-b border-neutral-800/40 bg-neutral-950/10">
            {children}
          </div>
        )}

        {/* Text Input Area */}
        <div className="relative flex items-center min-h-[56px] px-4 pt-3.5 pb-2">
          <textarea
            ref={textareaRef}
            rows={1}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full bg-transparent text-neutral-100 placeholder-neutral-500 text-sm focus:outline-none resize-none overflow-y-auto leading-relaxed pr-10 py-1"
            style={{ maxHeight: "240px" }}
          />
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex items-center justify-between px-4 pb-3.5 pt-2 bg-neutral-900/40 border-t border-neutral-900/20">
          {/* Upload Button */}
          <motion.button
            whileHover={{ scale: 1.01, backgroundColor: "rgba(255, 255, 255, 0.05)" }}
            whileTap={{ scale: 0.99 }}
            onClick={triggerFileInput}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-neutral-800 bg-neutral-950/30 text-neutral-400 hover:text-neutral-200 transition-colors duration-200 text-xs font-semibold cursor-pointer"
          >
            <Paperclip className="w-3.5 h-3.5 text-purple-400" />
            Upload Files
          </motion.button>

          {/* Send Button */}
          <motion.button
            whileHover={isSendDisabled ? {} : { scale: 1.05, boxShadow: "0 0 15px rgba(168,85,247,0.4)" }}
            whileTap={isSendDisabled ? {} : { scale: 0.95 }}
            onClick={onSend}
            disabled={isSendDisabled}
            className={`flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300 cursor-pointer ${
              isSendDisabled
                ? "bg-neutral-800 text-neutral-500 cursor-not-allowed"
                : "bg-purple-600 hover:bg-purple-500 text-white"
            }`}
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowUp className="w-4 h-4" />
            )}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
};
