import React from 'react';
import { ShieldAlert, Check, X, Hand, Mic } from 'lucide-react';
import { ConfirmationRequest } from '../../../shared/types';

interface ConfirmationModalProps {
  request: ConfirmationRequest | null;
  onConfirm: (approvalId: string) => void;
  onReject: (approvalId: string) => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  request,
  onConfirm,
  onReject,
}) => {
  if (!request) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#090910] border-2 border-[#ff3344] rounded-lg p-5 hud-glow-danger relative shadow-[0_0_50px_rgba(255,50,70,0.3)]">
        {/* Top Warning Banner */}
        <div className="flex items-center space-x-3 pb-3 border-b border-[#ff3344]/30">
          <div className="p-2 rounded bg-[#ff3344]/20 border border-[#ff3344]/50">
            <ShieldAlert className="w-6 h-6 text-[#ff3344] animate-pulse" />
          </div>
          <div>
            <span className="text-[10px] font-mono-tech px-2 py-0.5 rounded bg-[#ff3344]/30 text-[#ff3344] border border-[#ff3344]/40">
              LEVEL {request.permissionLevel} — HIGH IMPACT ACTION
            </span>
            <h2 className="text-base font-orbitron font-bold text-white tracking-wider mt-1">
              AUTHORIZATION REQUIRED
            </h2>
          </div>
        </div>

        {/* Action Details */}
        <div className="py-4 space-y-3">
          <div className="bg-black/60 p-3 rounded border border-neutral-800">
            <div className="text-xs font-mono-tech text-neutral-400">ACTION REQUESTED:</div>
            <div className="text-sm font-rajdhani font-semibold text-[#ffaa00] mt-0.5">
              {request.description}
            </div>
            {request.itemsCount !== undefined && (
              <div className="text-xs font-mono-tech text-neutral-300 mt-2">
                AFFECTED ITEMS: <span className="text-[#ff3344] font-bold">{request.itemsCount} targets</span>
              </div>
            )}
          </div>

          {/* Multimodal Authorization Instructions */}
          <div className="text-[11px] font-mono-tech text-neutral-400 bg-neutral-900/60 p-2.5 rounded border border-neutral-800 space-y-1">
            <div className="text-[#ffaa00] font-semibold mb-1">AUTHORIZATION MODES:</div>
            <div className="flex items-center space-x-2">
              <Hand className="w-3.5 h-3.5 text-[#00ffaa]" />
              <span>Gesture: <strong className="text-neutral-200">Thumbs Up</strong> to approve, <strong className="text-neutral-200">Thumbs Down</strong> to cancel</span>
            </div>
            <div className="flex items-center space-x-2">
              <Mic className="w-3.5 h-3.5 text-[#00d4ff]" />
              <span>Voice: Say <strong className="text-neutral-200">"Confirm"</strong> or <strong className="text-neutral-200">"Cancel"</strong></span>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={() => onReject(request.id)}
            className="flex items-center justify-center space-x-2 py-2.5 px-4 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 hover:text-white font-rajdhani font-bold text-sm tracking-wider transition"
          >
            <X className="w-4 h-4 text-neutral-400" />
            <span>[ CANCEL ]</span>
          </button>
          <button
            onClick={() => onConfirm(request.id)}
            className="flex items-center justify-center space-x-2 py-2.5 px-4 rounded bg-[#ff3344]/20 hover:bg-[#ff3344]/30 border border-[#ff3344] text-[#ff3344] hover:text-white font-rajdhani font-bold text-sm tracking-wider transition shadow-[0_0_20px_rgba(255,50,70,0.3)]"
          >
            <Check className="w-4 h-4 text-[#ff3344]" />
            <span>[ AUTHORIZE ]</span>
          </button>
        </div>
      </div>
    </div>
  );
};
