import React from "react";
import { motion } from "framer-motion";
import { Bot } from "lucide-react";

export const HeroSection: React.FC = () => {
  return (
    <div className="flex flex-col items-center text-center select-none max-w-2xl px-4">
      {/* Logo Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="flex items-center gap-2.5 mb-8 group"
      >
        <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-transform duration-300 group-hover:scale-105">
          <Bot className="w-5 h-5" />
          <div className="absolute inset-0 rounded-xl bg-purple-500 blur-md opacity-0 group-hover:opacity-40 transition-opacity duration-300" />
        </div>
        <span className="text-xl font-bold tracking-tight text-white">
          AI CRM <span className="bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent font-medium">Copilot</span>
        </span>
        <span className="inline-flex items-center rounded-full bg-purple-500/10 px-2.5 py-0.5 text-xs font-semibold text-purple-400 ring-1 ring-inset ring-purple-500/20">
          Beta
        </span>
      </motion.div>

      {/* Main Greeting */}
      <motion.h1
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
        className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-4 bg-gradient-to-b from-white to-neutral-400 bg-clip-text text-transparent"
      >
        How can I help you today?
      </motion.h1>

      {/* Subtitle */}
      <motion.p
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
        className="text-base sm:text-lg text-neutral-400 font-normal leading-relaxed mb-10 max-w-lg"
      >
        Search, summarize, analyze and chat with your documents using AI.
      </motion.p>
    </div>
  );
};
