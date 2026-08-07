import React from "react";
import { motion } from "framer-motion";
import { UploadCloud, Shield } from "lucide-react";

interface DragOverlayProps {
  isVisible: boolean;
}

export const DragOverlay: React.FC<DragOverlayProps> = ({ isVisible }) => {
  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/75 backdrop-blur-md select-none pointer-events-none"
    >
      <motion.div
        initial={{ scale: 0.9, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="flex flex-col items-center max-w-sm text-center px-6"
      >
        {/* Pulsing Upload Icon Container */}
        <div className="relative flex items-center justify-center w-24 h-24 rounded-full bg-purple-500/10 border-2 border-dashed border-purple-500 text-purple-400 mb-6 shadow-[0_0_50px_rgba(168,85,247,0.15)] animate-pulse">
          <UploadCloud className="w-10 h-10" />
        </div>

        {/* Text Details */}
        <h2 className="text-2xl font-bold text-white mb-2">
          Drop files here
        </h2>
        <p className="text-sm text-neutral-400 leading-relaxed mb-6">
          Your documents will be uploaded securely and processed using end-to-end encryption.
        </p>

        {/* Security badge indicator */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-500 text-xs font-semibold">
          <Shield className="w-3.5 h-3.5 text-purple-500/80" />
          End-to-End Secure Processing
        </div>
      </motion.div>
    </motion.div>
  );
};
