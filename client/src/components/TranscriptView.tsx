import React from 'react';
import { ChatMessage } from '../../../shared/types';

interface TranscriptViewProps {
  lastUserMsg: string;
  lastAssistantMsg: string;
}

export const TranscriptView: React.FC<TranscriptViewProps> = ({
  lastUserMsg,
  lastAssistantMsg,
}) => {
  if (!lastUserMsg && !lastAssistantMsg) return null;

  return (
    <div className="absolute top-20 left-1/2 -translate-x-1/2 z-10 w-full max-w-xl pointer-events-none px-4 text-center">
      <div className="inline-block max-w-full bg-[#05050a]/80 border border-[#ffaa00]/25 rounded-lg px-5 py-3 backdrop-blur-md shadow-2xl space-y-1.5 animate-in fade-in slide-in-from-top-4 duration-300">
        {lastUserMsg && (
          <div className="text-xs font-mono-tech text-neutral-400">
            <span className="text-[#00d4ff] font-bold tracking-wider mr-1">YOU //</span>
            "{lastUserMsg}"
          </div>
        )}
        {lastAssistantMsg && (
          <div className="text-sm font-rajdhani font-semibold text-[#ffaa00] text-glow-orange leading-relaxed">
            <span className="text-xs font-orbitron font-bold tracking-wider text-white mr-1">ULTRON //</span>
            {lastAssistantMsg}
          </div>
        )}
      </div>
    </div>
  );
};
