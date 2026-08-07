import React from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

interface PromptCardProps {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  onClick: () => void;
  index: number;
}

export const PromptCard: React.FC<PromptCardProps> = ({
  title,
  subtitle,
  icon: Icon,
  onClick,
  index,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 + index * 0.08, ease: "easeOut" }}
      whileHover={{ y: -4, scale: 1.01, borderColor: "rgba(168, 85, 247, 0.4)", backgroundColor: "rgba(17, 18, 23, 0.9)" }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className="flex flex-col items-start p-5 rounded-2xl border border-neutral-800 bg-neutral-900/40 backdrop-blur-sm cursor-pointer shadow-sm hover:shadow-md hover:shadow-purple-500/5 transition-colors duration-300 text-left select-none group w-full"
    >
      <div className="flex items-center justify-center p-2.5 rounded-xl bg-neutral-800/80 text-purple-400 group-hover:text-purple-300 group-hover:bg-purple-500/10 transition-colors duration-300 mb-4">
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="text-sm font-semibold text-neutral-100 group-hover:text-white transition-colors duration-200 mb-1">
        {title}
      </h3>
      <p className="text-xs text-neutral-400 leading-normal">
        {subtitle}
      </p>
    </motion.div>
  );
};
