import React, { useState } from 'react';
import { Mic, MicOff, Send, Square, Play, Sparkles, Volume2, VolumeX, ShieldAlert } from 'lucide-react';
import { UltronState } from '../../../shared/types';

interface BottomControlProps {
  onSendCommand: (command: string) => void;
  onEmergencyStop: () => void;
  isListening: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
  onPushToTalkStart: () => void;
  onPushToTalkEnd: () => void;
  audioAmplitude: number;
  ultronState: UltronState;
}

export const BottomControl: React.FC<BottomControlProps> = ({
  onSendCommand,
  onEmergencyStop,
  isListening,
  isMuted,
  onToggleMute,
  onPushToTalkStart,
  onPushToTalkEnd,
  audioAmplitude,
  ultronState,
}) => {
  const [inputText, setInputText] = useState('');
  const [showDemoMenu, setShowDemoMenu] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendCommand(inputText.trim());
    setInputText('');
  };

  const demoCommands = [
    { label: 'System Activation', cmd: 'Ultron, activate system and report status.' },
    { label: 'Web Research', cmd: 'Ultron, search the web for Smart India Hackathon 2026.' },
    { label: 'Create Presentation', cmd: 'Ultron, create a presentation on Smart India Hackathon 2026.' },
    { label: 'Create Document', cmd: 'Ultron, create a document summarizing project telemetry.' },
    { label: 'Vision Telemetry', cmd: 'Ultron, what do you see in the optical sensor?' },
    { label: 'Explicit Memory', cmd: 'Ultron, remember that user designation is Commander.' },
    { label: 'Level 3 Action (Delete)', cmd: 'Ultron, delete temporary_files.' },
    { label: 'Emergency Abort', cmd: 'Ultron, stop.' },
  ];

  return (
    <footer className="absolute bottom-0 left-0 right-0 z-30 p-4 flex flex-col items-center pointer-events-auto bg-gradient-to-t from-[#030306]/95 via-[#030306]/70 to-transparent">
      {/* Audio Reactive Waveform Bars */}
      <div className="flex items-center justify-center space-x-1 mb-2.5 h-6">
        {[...Array(24)].map((_, i) => {
          // Dynamic height calculated from audio amplitude and frequency variation
          const baseHeight = 4;
          const factor = Math.sin((i / 24) * Math.PI) * (audioAmplitude * 28);
          const height = Math.min(24, Math.max(baseHeight, baseHeight + factor + (isListening ? Math.random() * 4 : 0)));
          const isHigh = height > 16;
          return (
            <div
              key={i}
              className={`w-1 rounded-full transition-all duration-75 ${
                isHigh
                  ? 'bg-[#00ffaa] shadow-[0_0_8px_#00ffaa]'
                  : isListening
                  ? 'bg-[#ffaa00] shadow-[0_0_6px_#ffaa00]'
                  : 'bg-[#ffaa00]/30'
              }`}
              style={{ height: `${height}px` }}
            />
          );
        })}
      </div>

      {/* Main Command Bar Container */}
      <div className="w-full max-w-3xl flex items-center space-x-3">
        {/* Mic Mute Toggle */}
        <button
          onClick={onToggleMute}
          className={`p-3 rounded-full border transition backdrop-blur-md ${
            isMuted
              ? 'bg-red-950/40 border-red-500/50 text-red-400'
              : 'bg-black/60 border-[#ffaa00]/30 text-[#ffaa00] hover:border-[#ffaa00]'
          }`}
          title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        {/* Push-To-Talk Voice Trigger */}
        <button
          onMouseDown={onPushToTalkStart}
          onMouseUp={onPushToTalkEnd}
          onTouchStart={onPushToTalkStart}
          onTouchEnd={onPushToTalkEnd}
          className={`px-4 py-2.5 rounded-full border text-xs font-orbitron font-bold tracking-wider flex items-center space-x-2 transition select-none ${
            isListening
              ? 'bg-[#00ffaa]/20 border-[#00ffaa] text-[#00ffaa] shadow-[0_0_20px_rgba(0,255,170,0.4)] animate-pulse'
              : 'bg-black/60 border-[#ffaa00]/40 text-[#ffaa00] hover:bg-[#ffaa00]/20'
          }`}
          title="Press & hold or say 'Ultron...'"
        >
          <div className={`w-2 h-2 rounded-full ${isListening ? 'bg-[#00ffaa] animate-ping' : 'bg-[#ffaa00]'}`} />
          <span>{isListening ? 'LISTENING...' : 'HOLD TO TALK'}</span>
        </button>

        {/* Text Input Form */}
        <form onSubmit={handleSubmit} className="flex-1 relative flex items-center">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder='Type command or say "Ultron..."'
            className="w-full bg-black/60 border border-[#ffaa00]/35 rounded-full px-5 py-2.5 text-sm font-rajdhani text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-[#ffaa00] focus:ring-1 focus:ring-[#ffaa00] backdrop-blur-md transition"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="absolute right-1.5 p-2 rounded-full bg-[#ffaa00]/20 hover:bg-[#ffaa00]/40 text-[#ffaa00] disabled:opacity-30 disabled:pointer-events-none transition"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

        {/* Demo Commands Launcher */}
        <div className="relative">
          <button
            onClick={() => setShowDemoMenu(!showDemoMenu)}
            className="p-3 rounded-full bg-black/60 border border-[#ffaa00]/35 text-[#ffaa00] hover:bg-[#ffaa00]/20 transition"
            title="Demonstration Commands"
          >
            <Sparkles className="w-5 h-5" />
          </button>

          {showDemoMenu && (
            <div className="absolute bottom-14 right-0 w-72 bg-[#08080f] border border-[#ffaa00]/40 rounded-lg p-2.5 shadow-2xl backdrop-blur-md space-y-1.5 z-40">
              <div className="text-[10px] font-mono-tech text-[#ffaa00] px-2 py-1 border-b border-[#ffaa00]/20 flex items-center justify-between">
                <span>DEMO COMMAND PROTOCOLS</span>
                <span className="text-neutral-500">CLICK TO EXECUTE</span>
              </div>
              <div className="max-h-60 overflow-y-auto space-y-1">
                {demoCommands.map((d, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      onSendCommand(d.cmd);
                      setShowDemoMenu(false);
                    }}
                    className="w-full text-left p-2 rounded hover:bg-[#ffaa00]/15 transition border border-transparent hover:border-[#ffaa00]/30 flex flex-col"
                  >
                    <span className="text-xs font-rajdhani font-semibold text-neutral-200">
                      {d.label}
                    </span>
                    <span className="text-[10px] font-mono-tech text-neutral-500 truncate">
                      "{d.cmd}"
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* EMERGENCY STOP BUTTON */}
        <button
          onClick={onEmergencyStop}
          className="px-4 py-2.5 rounded-full bg-[#ff3344]/20 hover:bg-[#ff3344]/40 border-2 border-[#ff3344] text-[#ff3344] hover:text-white font-orbitron font-bold text-xs tracking-wider flex items-center space-x-2 transition shadow-[0_0_20px_rgba(255,50,70,0.4)] hover:shadow-[0_0_30px_rgba(255,50,70,0.7)] active:scale-95"
          title="Emergency Abort All Tool Executions"
        >
          <Square className="w-3.5 h-3.5 fill-current" />
          <span>STOP</span>
        </button>
      </div>
    </footer>
  );
};
