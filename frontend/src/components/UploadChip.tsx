import React from "react";
import { motion } from "framer-motion";
import { FileText, X, Check, Loader2 } from "lucide-react";

export interface MockFile {
  id: string;
  name: string;
  size: string;
  progress: number; // 0 to 100
}

interface UploadChipProps {
  file: MockFile;
  onRemove: (id: string) => void;
}

export const UploadChip: React.FC<UploadChipProps> = ({ file, onRemove }) => {
  const isUploading = file.progress < 100;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -10 }}
      layout
      className="relative flex items-center gap-3 p-3 pl-4 pr-10 rounded-xl border border-neutral-800 bg-neutral-900/80 backdrop-blur-md shadow-lg max-w-xs group overflow-hidden select-none hover:border-neutral-700 transition-colors duration-200"
    >
      {/* Upload Progress Bar Backdrop */}
      {isUploading && (
        <div
          className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-purple-600 to-indigo-600 transition-all duration-300"
          style={{ width: `${file.progress}%` }}
        />
      )}

      {/* File Icon */}
      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-neutral-800 text-neutral-400 group-hover:text-purple-400 group-hover:bg-purple-950/20 transition-all duration-300 shrink-0">
        <FileText className="w-4 h-4" />
      </div>

      {/* File Info */}
      <div className="flex flex-col min-w-0 pr-2">
        <span className="text-xs font-semibold text-neutral-200 truncate leading-snug">
          {file.name}
        </span>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[10px] text-neutral-500 font-medium shrink-0">
            {file.size}
          </span>
          <span className="text-[10px] text-neutral-600 font-medium">•</span>
          {isUploading ? (
            <span className="flex items-center gap-1 text-[10px] text-purple-400 font-semibold">
              <Loader2 className="w-2.5 h-2.5 animate-spin" />
              {file.progress}%
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold">
              <Check className="w-2.5 h-2.5" />
              Uploaded
            </span>
          )}
        </div>
      </div>

      {/* Remove Button */}
      <button
        onClick={() => onRemove(file.id)}
        className="absolute top-1/2 -translate-y-1/2 right-3 flex items-center justify-center w-5 h-5 rounded-md hover:bg-neutral-800 text-neutral-500 hover:text-neutral-200 transition-colors duration-200 cursor-pointer"
        aria-label="Remove file"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
};
