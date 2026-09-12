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
  const [isActivityOpen, setIsActivityOpen] = useState<boolean>(false);
  const [isMemoryOpen, setIsMemoryOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Real-Time Gesture Continuous Transforms & Interactive 3D State
  const [gestureZoomDelta, setGestureZoomDelta] = useState<number>(0);
  const [gesturePanOffset, setGesturePanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [gestureRotationDelta, setGestureRotationDelta] = useState<number>(0);
  const [energyPulse, setEnergyPulse] = useState<number>(0);
  const [handPos, setHandPos] = useState<{ x: number; y: number } | undefined>(undefined);
  const [gestureFeedback, setGestureFeedback] = useState<string | null>(null);

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

  // Main Command Pipeline
  const handleSendCommand = async (commandText: string) => {
    setLastUserMsg(commandText);
    setUltronState('THINKING');

    const trimmed = commandText.trim().toUpperCase();
    if (trimmed === 'STOP' || trimmed === 'CANCEL' || trimmed === 'ABORT' || trimmed === 'ULTRON STOP') {
      handleEmergencyStop();
      return;
    }

    try {
      const response = await fetch(apiUrl('/api/command'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: commandText }),
      });

      const data = await response.json();

      if (data.status === 'STOPPED') {
        setUltronState('STOPPED');
        setLastAssistantMsg(data.textResponse);
        setTimeout(() => setUltronState('IDLE'), 2000);
        return;
      }

      setLastAssistantMsg(data.textResponse);

      if (data.pendingConfirmation) {
        setPendingConfirmation(data.pendingConfirmation);
        setUltronState('WAITING_FOR_CONFIRMATION');
        voiceEngineRef.current?.speak(data.textResponse);
        fetchAuditRecords();
        return;
      }

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
      await res.json();
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

    // Reset all continuous interactive transforms
    setGestureZoomDelta(0);
    setGesturePanOffset({ x: 0, y: 0 });
    setGestureRotationDelta(0);
    setGestureFeedback('EMERGENCY STOP TRIGGERED');

    try {
      await fetch(apiUrl('/api/stop'), { method: 'POST' });
    } catch (_) {}

    setLastAssistantMsg('EMERGENCY STOP EXECUTED. All active processes halted.');
    fetchAuditRecords();

    setTimeout(() => {
      setUltronState('IDLE');
      setGestureFeedback(null);
    }, 2500);
  };

  /**
   * Multimodal Real-Time Hand Gesture Dispatcher
   */
  const handleGestureDetected = (gesture: GestureType) => {
    if (gesture === 'NONE') return;

    // Trigger visual energy pulse on 3D core
    setEnergyPulse(Date.now());

    // 1. Gesture approval / rejection for pending Level 3 modal
    if (pendingConfirmation) {
      if (gesture === 'THUMBS_UP') {
        handleConfirmAction(pendingConfirmation.id);
        setGestureFeedback('THUMBS UP // ACTION AUTHORIZED');
        setTimeout(() => setGestureFeedback(null), 2500);
        return;
      }
      if (gesture === 'THUMBS_DOWN') {
        handleRejectAction(pendingConfirmation.id);
        setGestureFeedback('THUMBS DOWN // ACTION CANCELLED');
        setTimeout(() => setGestureFeedback(null), 2500);
        return;
      }
    }

    // 2. SWIPE LEFT (Move interface toward the left, navigate to Activity Panel)
    if (gesture === 'SWIPE_LEFT') {
      setIsActivityOpen(true);
      setIsMemoryOpen(false);
      setGestureRotationDelta(-0.6);
      setGestureFeedback('SWIPE LEFT // OPEN AUDIT PANEL');
      setTimeout(() => setGestureFeedback(null), 2000);
      return;
    }

    // 3. SWIPE RIGHT (Move interface toward the right, navigate to Memory Panel)
    if (gesture === 'SWIPE_RIGHT') {
      setIsMemoryOpen(true);
      setIsActivityOpen(false);
      setGestureRotationDelta(0.6);
      setGestureFeedback('SWIPE RIGHT // OPEN MEMORY PANEL');
      setTimeout(() => setGestureFeedback(null), 2000);
      return;
    }

    // 4. FIST (Pause interaction / release virtual drag control)
    if (gesture === 'FIST') {
      setGesturePanOffset({ x: 0, y: 0 });
      setGestureZoomDelta(0);
      setGestureFeedback('FIST // VIRTUAL CONTROL RELEASED');
      setTimeout(() => setGestureFeedback(null), 1500);
      return;
    }

    // 5. OPEN PALM HOLD (Activate Ultron scanning mode)
    if (gesture === 'OPEN_PALM') {
      if (ultronState === 'EXECUTING') {
        handleEmergencyStop();
        return;
      }
      setGestureFeedback('OPEN PALM // HOLOGRAPHIC SCAN ACTIVE');
      setTimeout(() => setGestureFeedback(null), 1500);
      return;
    }

    // 6. WAVE (Wake Ultron greeting)
    if (gesture === 'WAVE' && ultronState === 'IDLE') {
      voiceEngineRef.current?.speak('Ultron online. Standing by for command.');
      setLastAssistantMsg('Optical gesture recognized: Ultron activated.');
      setGestureFeedback('WAVE // ULTRON ACTIVATED');
      setTimeout(() => setGestureFeedback(null), 2500);
    }
  };

  /**
   * Handle Continuous Transform from GestureController (Continuous Pinch Zoom, Drag, Two-Hand Zoom/Rot)
   */
  const handleContinuousTransform = (transform: {
    zoomDelta: number;
    panDelta: { x: number; y: number };
    rotationDelta: number;
    handPos: { x: number; y: number };
  }) => {
    setGestureZoomDelta(transform.zoomDelta);
    setGesturePanOffset((prev) => ({
      x: prev.x + transform.panDelta.x * 0.05,
      y: prev.y + transform.panDelta.y * 0.05,
    }));
    setGestureRotationDelta(transform.rotationDelta);
    setHandPos(transform.handPos);
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

      {/* 3. Central Three.js 3D Holographic AI Core with Gesture Reactivity */}
      <UltronCore
        state={ultronState}
        audioAmplitude={audioAmplitude}
        quality={graphicsQuality}
        zoomDelta={gestureZoomDelta}
        panOffset={gesturePanOffset}
        rotationDelta={gestureRotationDelta}
        energyPulse={energyPulse}
        handPos={handPos}
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

      {/* 5. Holographic Gesture Toast / Feedback Banner */}
      {gestureFeedback && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 px-4 py-1.5 rounded-full bg-black/80 border border-[#ffaa00] text-[#ffaa00] font-orbitron text-xs tracking-wider shadow-[0_0_20px_rgba(255,170,0,0.5)] animate-in fade-in zoom-in-95 duration-200">
          {gestureFeedback}
        </div>
      )}

      {/* 6. Left Side: Camera & Vision Telemetry */}
      <aside
        className="fixed left-4 top-16 z-20 transition-all duration-300 pointer-events-auto"
        style={{ width: '290px' }}
      >
        <VisionTracker
          isActive={isCameraActive}
          onToggleActive={() => setIsCameraActive(!isCameraActive)}
          onGesture={handleGestureDetected}
          onContinuousTransform={handleContinuousTransform}
          onFrameCaptured={() => {
            handleSendCommand('Analyze this optical frame');
          }}
        />
      </aside>

      {/* 7. Right Side: Real-time Command Audit & Tool Execution Feed */}
      <ActivityPanel
        records={auditRecords}
        onClear={() => setAuditRecords([])}
        isOpen={isActivityOpen}
        onToggle={() => setIsActivityOpen(!isActivityOpen)}
      />

      {/* 8. Memory Drawer (Collapsible) */}
      <MemoryPanel
        isOpen={isMemoryOpen}
        onToggle={() => setIsMemoryOpen(!isMemoryOpen)}
      />

      {/* 9. Bottom HUD Command & Audio Interface */}
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

      {/* 10. Visual Confirmation Card for Level 2 & 3 Actions */}
      <ConfirmationModal
        request={pendingConfirmation}
        onConfirm={handleConfirmAction}
        onReject={handleRejectAction}
      />

      {/* 11. Settings Configuration Modal */}
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
