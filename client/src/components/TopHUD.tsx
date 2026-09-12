import React, { useState, useEffect } from 'react';
import { Shield, Cpu, Mic, Eye, Hand, Wrench, Database, Settings, Activity } from 'lucide-react';
import { UltronState, SystemStatusState } from '../../../shared/types';

interface TopHUDProps {
  systemStatus: SystemStatusState;
  modelName: string;
  ultronState: UltronState;
  onOpenSettings: () => void;
}

export const TopHUD: React.FC<TopHUDProps> = ({
  systemStatus,
  modelName,
  ultronState,
  onOpenSettings,
}) => {
  const [timeStr, setTimeStr] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toTimeString().split(' ')[0] + '.' + Math.floor(now.getMilliseconds() / 100));
    };
    updateTime();
    const interval = setInterval(updateTime, 100);
    return () => clearInterval(interval);
  }, []);

  const getStateBadge = (state: UltronState) => {
    switch (state) {
      case 'IDLE':
        return { label: 'CORE STANDBY', col: 'text-[#ffaa00]', bg: 'bg-[#ffaa00]/10', border: 'border-[#ffaa00]/30' };
      case 'LISTENING':
        return { label: 'VOICE LISTENING', col: 'text-[#00ffaa]', bg: 'bg-[#00ffaa]/10', border: 'border-[#00ffaa]/40 animate-pulse' };
      case 'THINKING':
        return { label: 'COGNITIVE REASONING', col: 'text-[#00d4ff]', bg: 'bg-[#00d4ff]/10', border: 'border-[#00d4ff]/40 animate-pulse' };
      case 'EXECUTING':
        return { label: 'DISPATCHING TOOL', col: 'text-[#ffaa00]', bg: 'bg-[#ffaa00]/20', border: 'border-[#ffaa00]/60 animate-pulse' };
      case 'WAITING_FOR_CONFIRMATION':
        return { label: 'AUTH REQUIRED (LVL 3)', col: 'text-[#ffcc00]', bg: 'bg-[#ffcc00]/20', border: 'border-[#ffcc00]/60 animate-bounce' };
      case 'SPEAKING':
        return { label: 'SYNTHESIZING AUDIO', col: 'text-[#ff8800]', bg: 'bg-[#ff8800]/10', border: 'border-[#ff8800]/40' };
      case 'STOPPED':
        return { label: 'EMERGENCY HALT', col: 'text-[#ff3344]', bg: 'bg-[#ff3344]/20', border: 'border-[#ff3344]/50' };
      case 'ERROR':
        return { label: 'SYSTEM WARNING', col: 'text-[#ff3344]', bg: 'bg-[#ff3344]/20', border: 'border-[#ff3344]/50' };
    }
  };

  const badge = getStateBadge(ultronState);

  return (
    <header className="absolute top-0 left-0 right-0 z-30 px-6 py-3 flex items-center justify-between pointer-events-auto bg-gradient-to-b from-[#030306]/90 via-[#030306]/40 to-transparent backdrop-blur-sm border-b border-[#ff9900]/15">
      {/* Left Brand & Identification */}
      <div className="flex items-center space-x-3">
        <div className="relative flex items-center justify-center w-8 h-8 rounded-full border border-[#ffaa00]/40 bg-black/60 shadow-[0_0_15px_rgba(255,170,0,0.3)]">
          <div className="w-2.5 h-2.5 rounded-full bg-[#ffaa00] animate-pulse" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-sm font-orbitron font-bold tracking-widest text-[#ffaa00] text-glow-orange">
              ULTRON
            </h1>
            <span className="text-[10px] font-mono-tech px-1.5 py-0.5 rounded bg-[#ff9900]/20 text-[#ffaa00] border border-[#ff9900]/30">
              MK-VI
            </span>
          </div>
          <div className="flex items-center space-x-2 text-[10px] font-mono-tech text-neutral-400">
            <span className="text-[#00ffaa]">● ACTIVE</span>
            <span>|</span>
            <span>MODEL: {modelName}</span>
          </div>
        </div>
      </div>

      {/* Center Dynamic State Banner */}
      <div className="hidden md:flex items-center space-x-3">
        <div className={`px-4 py-1 rounded border ${badge.border} ${badge.bg} flex items-center space-x-2 transition-all duration-300`}>
          <Activity className={`w-3.5 h-3.5 ${badge.col} animate-spin`} />
          <span className={`text-xs font-orbitron tracking-widest font-semibold ${badge.col}`}>
            {badge.label}
          </span>
        </div>
      </div>

      {/* Right HUD Status Indicators & Telemetry */}
      <div className="flex items-center space-x-4">
        {/* Status Indicators Pill */}
        <div className="hidden lg:flex items-center space-x-3 text-[10px] font-mono-tech px-3 py-1 bg-black/50 border border-[#ffaa00]/20 rounded">
          <div className="flex items-center space-x-1" title="AI Core Engine">
            <Cpu className="w-3 h-3 text-[#ffaa00]" />
            <span className="text-neutral-300">CORE</span>
            <span className="text-[#00ffaa]">●</span>
          </div>

          <div className="flex items-center space-x-1" title="Voice Subsystem">
            <Mic className="w-3 h-3 text-[#ffaa00]" />
            <span className="text-neutral-300">VOICE</span>
            <span className="text-[#00ffaa]">●</span>
          </div>

          <div className="flex items-center space-x-1" title="Computer Vision">
            <Eye className="w-3 h-3 text-[#ffaa00]" />
            <span className="text-neutral-300">VISION</span>
            <span className="text-[#00ffaa]">●</span>
          </div>

          <div className="flex items-center space-x-1" title="Gesture Tracking">
            <Hand className="w-3 h-3 text-[#ffaa00]" />
            <span className="text-neutral-300">GESTURE</span>
            <span className="text-[#00ffaa]">●</span>
          </div>

          <div className="flex items-center space-x-1" title="Tools & Document Synthesis">
            <Wrench className="w-3 h-3 text-[#ffaa00]" />
            <span className="text-neutral-300">TOOLS</span>
            <span className="text-[#00ffaa]">●</span>
          </div>

          <div className="flex items-center space-x-1" title="Memory Store">
            <Database className="w-3 h-3 text-[#ffaa00]" />
            <span className="text-neutral-300">MEM</span>
            <span className="text-[#00ffaa]">●</span>
          </div>
        </div>

        {/* Real-time Clock */}
        <div className="text-[11px] font-mono-tech text-[#ffaa00] px-2.5 py-1 bg-black/50 border border-[#ffaa00]/20 rounded">
          {timeStr}
        </div>

        {/* Settings Trigger */}
        <button
          onClick={onOpenSettings}
          className="p-1.5 rounded border border-[#ffaa00]/30 hover:border-[#ffaa00] text-neutral-400 hover:text-[#ffaa00] transition bg-black/40"
          title="Command Center Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
