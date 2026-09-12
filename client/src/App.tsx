import React, { useState, useEffect, useRef } from 'react';
import { UltronCore } from './core/UltronCore';
import { VisionTracker } from './vision/VisionTracker';
import { VoiceEngine } from './voice/VoiceEngine';
import { TopHUD } from './components/TopHUD';
import { BottomControl } from './components/BottomControl';
import { ActivityPanel } from './components/ActivityPanel';
import { ConfirmationModal } from './components/ConfirmationModal';
import { TranscriptView } from './components/TranscriptView';
import { SettingsModal } from './components/SettingsModal';
import { MemoryPanel } from './components/MemoryPanel';
import { UltronState, SystemStatusState, ToolExecutionRecord, ConfirmationRequest, GestureType } from '../../shared/types';
import { apiUrl } from './config/api';

export const App: React.FC = () => {
  // Master Ultron State Machine
  const [ultronState, setUltronState] = useState<UltronState>('IDLE');
  const [audioAmplitude, setAudioAmplitude] = useState<number>(0.0);
  const [lastUserMsg, setLastUserMsg] = useState<string>('');
  const [lastAssistantMsg, setLastAssistantMsg] = useState<string>('Ultron Command Core initialized. System online.');

  // Subsystems & Panels
  const [isCameraActive, setIsCameraActive] = useState<boolean>(true);
  const [isActivityOpen, setIsActivityOpen] = useState<boolean>(true);
  const [isMemoryOpen, setIsMemoryOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Configuration
  const [apiKey, setApiKey] = useState<string>('');
  const [modelName, setModelName] = useState<string>('gpt-6-astra');
  const [graphicsQuality, setGraphicsQuality] = useState<'high' | 'medium' | 'low'>('high');

  // Audit Records & Pending Confirmations
  const [auditRecords, setAuditRecords] = useState<ToolExecutionRecord[]>([]);
  const [pendingConfirmation, setPendingConfirmation] = useState<ConfirmationRequest | null>(null);

  // Voice States
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);

  const voiceEngineRef = useRef<VoiceEngine | null>(null);

  // Network offline listener
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // System Status
  const [systemStatus, setSystemStatus] = useState<SystemStatusState>({
    aiCore: 'ONLINE',
    voice: 'ONLINE',
    vision: 'ONLINE',
    gestures: 'ONLINE',
    web: 'ONLINE',
    tools: 'ONLINE',
    memory: 'ONLINE',
  });

  // Fetch initial system status & audit log
  const fetchAuditRecords = async () => {
    try {
      const res = await fetch(apiUrl('/api/audit'));
      if (res.ok) {
        const data = await res.json();
        setAuditRecords(data);
      }
    } catch (_) {}
  };

  const fetchStatus = async () => {
    try {
      const res = await fetch(apiUrl('/api/status'));
      if (res.ok) {
        const data = await res.json();
        if (data.pendingConfirmations && data.pendingConfirmations.length > 0) {
          setPendingConfirmation(data.pendingConfirmations[0]);
          setUltronState('WAITING_FOR_CONFIRMATION');
        }
      }
    } catch (_) {}
  };

  useEffect(() => {
    fetchAuditRecords();
    fetchStatus();
    const interval = setInterval(fetchAuditRecords, 3000);
    return () => clearInterval(interval);
  }, []);

  // Initialize Voice Engine
  useEffect(() => {
    const voiceEngine = new VoiceEngine({
      onTranscript: (transcript: string, isFinal: boolean) => {
        setLastUserMsg(transcript);

        // Wake phrase check: e.g. "Ultron search for..." or "Ultron activate"
        const lower = transcript.toLowerCase();
        if (lower.startsWith('ultron') || isFinal) {
          handleSendCommand(transcript);
        }
      },
      onAudioAmplitude: (amp: number) => {
        setAudioAmplitude(amp);
      },
      onStateChange: (vState) => {
        if (vState === 'listening') {
          setIsListening(true);
          if (ultronState === 'IDLE') setUltronState('LISTENING');
        } else if (vState === 'speaking') {
          setUltronState('SPEAKING');
        } else if (vState === 'idle') {
          setIsListening(false);
          if (ultronState === 'SPEAKING' || ultronState === 'LISTENING') {
            setUltronState('IDLE');
          }
        }
      },
      onError: (err) => {
        console.warn('[App] Voice error:', err);
      },
    });

    voiceEngineRef.current = voiceEngine;
    voiceEngine.initAudioAnalyser();

    return () => {
      voiceEngine.dispose();
    };
  }, [ultronState]);

  // Command Execution Handler
  const handleSendCommand = async (command: string) => {
    setLastUserMsg(command);
    setUltronState('THINKING');

    // Emergency STOP keyword check in user speech
    const trimmed = command.trim().toUpperCase();
    if (trimmed === 'STOP' || trimmed === 'CANCEL' || trimmed === 'ABORT' || trimmed === 'ULTRON STOP') {
      handleEmergencyStop();
      return;
    }

    try {
      const response = await fetch(apiUrl('/api/command'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      });

      const data = await response.json();

      if (data.status === 'STOPPED') {
        setUltronState('STOPPED');
        setLastAssistantMsg(data.textResponse);
        setTimeout(() => setUltronState('IDLE'), 2000);
        return;
      }

      setLastAssistantMsg(data.textResponse);

      // Check if confirmation is required (Level 2/3)
      if (data.pendingConfirmation) {
        setPendingConfirmation(data.pendingConfirmation);
        setUltronState('WAITING_FOR_CONFIRMATION');
        voiceEngineRef.current?.speak(data.textResponse);
        fetchAuditRecords();
        return;
      }

      // Completed safely
      setUltronState('SPEAKING');
      voiceEngineRef.current?.speak(data.textResponse, () => {
        setUltronState('IDLE');
      });

      fetchAuditRecords();
    } catch (err: any) {
      console.error('[App] Command execution error:', err);
      setUltronState('ERROR');
      setLastAssistantMsg(`Operational error: ${err.message}`);
      setTimeout(() => setUltronState('IDLE'), 3000);
    }
  };

  // Confirmation resolution (Button, Voice, or Hand Gesture)
  const handleConfirmAction = async (approvalId: string) => {
    try {
      setUltronState('EXECUTING');
      const res = await fetch(apiUrl('/api/confirm'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalId, approved: true }),
      });
      const data = await res.json();
      setPendingConfirmation(null);
      setLastAssistantMsg('Action authorized and executed successfully.');
      voiceEngineRef.current?.speak('Action authorized and executed.');
      fetchAuditRecords();
      setTimeout(() => setUltronState('IDLE'), 1500);
    } catch (err) {
      setPendingConfirmation(null);
      setUltronState('IDLE');
    }
  };

  const handleRejectAction = async (approvalId: string) => {
    try {
      await fetch(apiUrl('/api/confirm'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalId, approved: false }),
      });
      setPendingConfirmation(null);
      setLastAssistantMsg('Action authorization cancelled by user command.');
      voiceEngineRef.current?.speak('Authorization rejected. Operation cancelled.');
      fetchAuditRecords();
      setUltronState('IDLE');
    } catch (err) {
      setPendingConfirmation(null);
      setUltronState('IDLE');
    }
  };

  // Emergency STOP mechanism
  const handleEmergencyStop = async () => {
    console.warn('[App] EMERGENCY STOP ACTIVATED');
    voiceEngineRef.current?.stopSpeaking();
    setUltronState('STOPPED');
    setPendingConfirmation(null);

    try {
      await fetch(apiUrl('/api/stop'), { method: 'POST' });
    } catch (_) {}

    setLastAssistantMsg('EMERGENCY STOP EXECUTED. All active processes halted.');
    fetchAuditRecords();

    setTimeout(() => {
      setUltronState('IDLE');
    }, 2500);
  };

  // Multimodal Hand Gesture Dispatcher
  const handleGestureDetected = (gesture: GestureType) => {
    if (gesture === 'NONE') return;

    // Gesture approval for pending Level 3 card
    if (pendingConfirmation) {
      if (gesture === 'THUMBS_UP') {
        handleConfirmAction(pendingConfirmation.id);
        return;
      }
      if (gesture === 'THUMBS_DOWN') {
        handleRejectAction(pendingConfirmation.id);
        return;
      }
    }

    // Open Palm -> Emergency Halt / Pause
    if (gesture === 'OPEN_PALM' && ultronState === 'EXECUTING') {
      handleEmergencyStop();
      return;
    }

    // Wave -> Wake Ultron
    if (gesture === 'WAVE' && ultronState === 'IDLE') {
      voiceEngineRef.current?.speak('Ultron online. Standing by for command.');
      setLastAssistantMsg('Optical gesture recognized: Ultron activated.');
    }
  };

  // Voice Push-to-Talk handlers
  const handlePushToTalkStart = () => {
    voiceEngineRef.current?.startListening();
    setIsListening(true);
    setUltronState('LISTENING');
  };

  const handlePushToTalkEnd = () => {
    setIsListening(false);
  };

  const handleToggleMute = () => {
    if (voiceEngineRef.current) {
      const muted = voiceEngineRef.current.toggleMute();
      setIsMuted(muted);
    }
  };

  // Save Settings
  const handleSaveApiKey = async (newKey: string) => {
    setApiKey(newKey);
    await fetch(apiUrl('/api/settings'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: newKey, model: modelName }),
    });
  };

  const handleSaveModel = async (newModel: string) => {
    setModelName(newModel);
    await fetch(apiUrl('/api/settings'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey, model: newModel }),
    });
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#030306] text-white flex flex-col select-none">
      {/* 1. Subtle Scanlines & Background Grid */}
      <div className="absolute inset-0 scanlines opacity-40 pointer-events-none z-10" />

      {/* 2. Top HUD Navigation */}
      <TopHUD
        systemStatus={systemStatus}
        modelName={modelName}
        ultronState={ultronState}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* 3. Central Three.js 3D Holographic AI Core */}
      <UltronCore
        state={ultronState}
        audioAmplitude={audioAmplitude}
        quality={graphicsQuality}
        onTap={() => {
          if (isListening) {
            handlePushToTalkEnd();
          } else {
            handlePushToTalkStart();
          }
        }}
      />

      {/* 4. Minimal Floating Transcript Subtitles */}
      <TranscriptView
        lastUserMsg={lastUserMsg}
        lastAssistantMsg={lastAssistantMsg}
      />

      {/* 5. Left Side: Camera & Vision Telemetry */}
      <aside
        className="fixed left-4 top-16 z-20 transition-all duration-300 pointer-events-auto"
        style={{ width: '280px' }}
      >
        <VisionTracker
          isActive={isCameraActive}
          onToggleActive={() => setIsCameraActive(!isCameraActive)}
          onGesture={handleGestureDetected}
          onFrameCaptured={(img) => {
            handleSendCommand('Analyze this optical frame');
          }}
        />
      </aside>

      {/* 6. Right Side: Real-time Command Audit & Tool Execution Feed */}
      <ActivityPanel
        records={auditRecords}
        onClear={() => setAuditRecords([])}
        isOpen={isActivityOpen}
        onToggle={() => setIsActivityOpen(!isActivityOpen)}
      />

      {/* 7. Memory Drawer (Collapsible) */}
      <MemoryPanel
        isOpen={isMemoryOpen}
        onToggle={() => setIsMemoryOpen(!isMemoryOpen)}
      />

      {/* 8. Bottom HUD Command & Audio Interface */}
      <BottomControl
        onSendCommand={handleSendCommand}
        onEmergencyStop={handleEmergencyStop}
        isListening={isListening}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        onPushToTalkStart={handlePushToTalkStart}
        onPushToTalkEnd={handlePushToTalkEnd}
        audioAmplitude={audioAmplitude}
        ultronState={ultronState}
      />

      {/* 9. Visual Confirmation Card for Level 2 & 3 Actions */}
      <ConfirmationModal
        request={pendingConfirmation}
        onConfirm={handleConfirmAction}
        onReject={handleRejectAction}
      />

      {/* 10. Settings Configuration Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        apiKey={apiKey}
        onSaveApiKey={handleSaveApiKey}
        model={modelName}
        onSaveModel={handleSaveModel}
        quality={graphicsQuality}
        onSaveQuality={setGraphicsQuality}
      />
    </main>
  );
};
export default App;
