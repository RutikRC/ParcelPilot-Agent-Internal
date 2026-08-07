import React from "react";
import { Bot } from "lucide-react";

export const LoadingIndicator: React.FC = () => {
  return (
    <div className="flex gap-4 w-full max-w-2xl px-4 py-6 border border-neutral-900 bg-neutral-950/40 rounded-2xl select-none">
      {/* Bot Icon */}
      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-950/40 text-purple-400 border border-purple-500/20 shrink-0">
        <Bot className="w-4 h-4" />
      </div>

      {/* Loading Skeleton */}
      <div className="flex-1 space-y-4 pt-1">
        {/* Row 1: Thinking dots */}
        <div className="flex items-center gap-1">
          <span className="text-xs font-semibold text-neutral-400 mr-2">Copilot is searching documents</span>
          <div className="flex gap-1.5 items-center">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce [animation-delay:-0.3s]"></span>
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce [animation-delay:-0.15s]"></span>
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce"></span>
          </div>
        </div>

        {/* Row 2 & 3: Shimmering Skeletons */}
        <div className="space-y-2.5">
          <div className="h-3 w-5/6 rounded-md bg-neutral-800 animate-shimmer" />
          <div className="h-3 w-full rounded-md bg-neutral-800 animate-shimmer" />
          <div className="h-3 w-2/3 rounded-md bg-neutral-800 animate-shimmer" />
        </div>
      </div>
    </div>
  );
};
