import React from 'react';
import { Keyboard, X } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'g then o', description: 'Navigate to Overview Dashboard' },
    { key: 'g then s', description: 'Navigate to Split-Screen Comparison' },
    { key: 'g then d', description: 'Start Guided 3-Minute Demo' },
    { key: 'g then r', description: 'Navigate to Red-Team Suite & Adaptive Runner' },
    { key: 'g then p', description: 'Navigate to Hackathon Pitch & Architecture' },
    { key: 'g then l', description: 'Navigate to Live Incident Feed' },
    { key: 'g then a', description: 'Navigate to AI Agents & Tool Inventory' },
    { key: 'g then q', description: 'Navigate to Approval Queue' },
    { key: 'g then c', description: 'Navigate to OWASP Compliance Matrix' },
    { key: 'g then m', description: 'Navigate to "What is Real vs Simulated"' },
    { key: '?', description: 'Open this Keyboard Shortcuts cheat-sheet' },
    { key: 'Esc', description: 'Close any active modal or overlay' },
    { key: '← / →', description: 'Previous / Next step in Guided Demo Mode' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-[#0f172a] border border-slate-700 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-800 flex items-center justify-center text-cyan-400">
              <Keyboard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Keyboard Navigation</h3>
              <p className="text-xs text-slate-400">Two-stroke vim-style jumps and controls</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors duration-150"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2 max-h-80 overflow-y-auto pr-1">
          {shortcuts.map((sc, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2 rounded-lg bg-[#070b14] border border-slate-800 text-xs"
            >
              <span className="text-slate-300">{sc.description}</span>
              <kbd className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-2xs text-cyan-300 font-bold">
                {sc.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="text-center pt-2 border-t border-slate-800 text-2xs text-slate-500">
          Press <kbd className="px-1.5 py-0.5 bg-slate-800 rounded font-mono text-slate-300">Esc</kbd> anytime to dismiss
        </div>
      </div>
    </div>
  );
};
