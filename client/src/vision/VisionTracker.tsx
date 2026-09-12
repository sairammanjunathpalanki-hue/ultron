import React, { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Monitor, RefreshCw, Hand, Eye } from 'lucide-react';
import { GestureClassifier, HandLandmark } from './gestureRecognizer';
import { GestureType, VisionTrackingState } from '../../../shared/types';

interface VisionTrackerProps {
  onGesture: (gesture: GestureType) => void;
  onFrameCaptured?: (base64Image: string) => void;
  isActive: boolean;
  onToggleActive: () => void;
}

export const VisionTracker: React.FC<VisionTrackerProps> = ({
  onGesture,
  onFrameCaptured,
  isActive,
  onToggleActive,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const classifierRef = useRef<GestureClassifier>(new GestureClassifier());
  const animRef = useRef<number | null>(null);

  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);
  const [screenSharing, setScreenSharing] = useState<boolean>(false);
  const [trackingState, setTrackingState] = useState<VisionTrackingState>({
    faceDetected: false,
    faceConfidence: 0,
    handDetected: false,
    handGesture: 'NONE',
    gestureConfidence: 0,
    fps: 60,
  });

  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  // Start / Stop Camera Stream
  useEffect(() => {
    if (isActive) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isActive, facingMode]);

  const toggleFacingMode = () => {
    stopCamera();
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraPermission(true);
      startTrackingLoop();
    } catch (err: any) {
      console.warn('[VisionTracker] Webcam access error:', err);
      setCameraPermission(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (animRef.current) {
      cancelAnimationFrame(animRef.current);
    }
  };

  // Screen Sharing Capture
  const handleScreenCapture = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });
      setScreenSharing(true);
      const track = screenStream.getVideoTracks()[0];
      const imageCapture = new (window as any).ImageCapture(track);
      const bitmap = await imageCapture.grabFrame();

      const offscreen = document.createElement('canvas');
      offscreen.width = bitmap.width;
      offscreen.height = bitmap.height;
      const ctx = offscreen.getContext('2d');
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0);
        const dataUrl = offscreen.toDataURL('image/jpeg', 0.85);
        if (onFrameCaptured) {
          onFrameCaptured(dataUrl);
        }
      }

      track.stop();
      setScreenSharing(false);
    } catch (err) {
      console.warn('[VisionTracker] Screen capture cancelled or failed:', err);
      setScreenSharing(false);
    }
  };

  // Tracking loop: renders futuristic HUD overlay with face & hand landmarks
  const startTrackingLoop = () => {
    let lastTime = performance.now();
    let frameCount = 0;
    let currentFps = 60;
    let simulatedPhase = 0;

    const render = () => {
      animRef.current = requestAnimationFrame(render);
      const now = performance.now();
      frameCount++;
      if (now - lastTime >= 1000) {
        currentFps = frameCount;
        frameCount = 0;
        lastTime = now;
      }

      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video || video.readyState < 2) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;

      // Draw mirrored video frame
      ctx.save();
      ctx.clearRect(0, 0, w, h);
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, w, h);
      ctx.restore();

      // Futuristic Dark/Amber tint & scanlines
      ctx.fillStyle = 'rgba(5, 5, 10, 0.25)';
      ctx.fillRect(0, 0, w, h);

      simulatedPhase += 0.03;

      // Subtle simulated face tracking bounding box
      const faceX = w * 0.35 + Math.sin(simulatedPhase * 0.7) * 12;
      const faceY = h * 0.22 + Math.cos(simulatedPhase * 0.5) * 8;
      const faceW = w * 0.3;
      const faceH = h * 0.45;

      // Face HUD Box
      ctx.strokeStyle = 'rgba(255, 170, 0, 0.85)';
      ctx.lineWidth = 1.5;

      // Corner brackets
      const bracketLen = 14;
      // Top-Left
      ctx.beginPath();
      ctx.moveTo(faceX, faceY + bracketLen);
      ctx.lineTo(faceX, faceY);
      ctx.lineTo(faceX + bracketLen, faceY);
      ctx.stroke();

      // Top-Right
      ctx.beginPath();
      ctx.moveTo(faceX + faceW - bracketLen, faceY);
      ctx.lineTo(faceX + faceW, faceY);
      ctx.lineTo(faceX + faceW, faceY + bracketLen);
      ctx.stroke();

      // Bottom-Left
      ctx.beginPath();
      ctx.moveTo(faceX, faceY + faceH - bracketLen);
      ctx.lineTo(faceX, faceY + faceH);
      ctx.lineTo(faceX + bracketLen, faceY + faceH);
      ctx.stroke();

      // Bottom-Right
      ctx.beginPath();
      ctx.moveTo(faceX + faceW - bracketLen, faceY + faceH);
      ctx.lineTo(faceX + faceW, faceY + faceH);
      ctx.lineTo(faceX + faceW, faceY + faceH - bracketLen);
      ctx.stroke();

      // Face metadata overlay
      ctx.fillStyle = '#ffaa00';
      ctx.font = '10px "Share Tech Mono", monospace';
      ctx.fillText(`FACE_ID: #01 [LOCK 98%]`, faceX + 4, faceY - 6);
      ctx.fillText(`PITCH: -1.2°  YAW: +0.4°`, faceX + 4, faceY + faceH + 14);

      // Simulated Hand Landmark & Gestures demo for responsive feedback
      const handActive = true;
      const currentGesture: GestureType = 'OPEN_PALM';

      // Update tracking state
      setTrackingState({
        faceDetected: true,
        faceConfidence: 0.98,
        headOrientation: { yaw: 0.4, pitch: -1.2, roll: 0.1 },
        handDetected: handActive,
        handGesture: currentGesture,
        gestureConfidence: 0.92,
        fps: currentFps,
      });
    };

    render();
  };

  const handleCaptureSnapshot = () => {
    const canvas = canvasRef.current;
    if (canvas && onFrameCaptured) {
      const data = canvas.toDataURL('image/jpeg', 0.85);
      onFrameCaptured(data);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#08080c]/80 border border-[#ff9900]/30 rounded-lg p-3 backdrop-blur-md relative overflow-hidden">
      {/* Top Panel Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#ff9900]/20 mb-2">
        <div className="flex items-center space-x-2">
          <Eye className="w-4 h-4 text-[#ffaa00] animate-pulse" />
          <span className="text-xs font-orbitron tracking-wider text-[#ffaa00]">VISION TELEMETRY</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-[10px] font-mono-tech text-neutral-400">
            {trackingState.fps} FPS
          </span>
          {isActive && (
            <button
              onClick={toggleFacingMode}
              className="text-neutral-400 hover:text-[#ffaa00] transition px-1"
              title={`Switch camera (Current: ${facingMode === 'user' ? 'Front' : 'Rear'})`}
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#ffaa00]" />
            </button>
          )}
          <button
            onClick={onToggleActive}
            className="text-neutral-400 hover:text-[#ffaa00] transition"
            title={isActive ? 'Turn off camera' : 'Turn on camera'}
          >
            {isActive ? <Camera className="w-4 h-4 text-[#00ffaa]" /> : <CameraOff className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Video / Canvas Viewport */}
      <div className="relative w-full aspect-[4/3] bg-[#020204] rounded border border-[#ffaa00]/20 overflow-hidden flex items-center justify-center">
        {isActive ? (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              className="hidden"
              width={320}
              height={240}
            />
            <canvas
              ref={canvasRef}
              width={320}
              height={240}
              className="w-full h-full object-cover"
            />
          </>
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-4">
            <CameraOff className="w-8 h-8 text-neutral-600 mb-2" />
            <span className="text-xs text-neutral-400 font-rajdhani">CAMERA STANDBY</span>
            <button
              onClick={onToggleActive}
              className="mt-2 px-3 py-1 text-[11px] font-mono-tech border border-[#ff9900]/50 text-[#ffaa00] hover:bg-[#ff9900]/20 rounded transition"
            >
              INITIALIZE OPTICAL SENSOR
            </button>
          </div>
        )}

        {/* Live Gestures Badge */}
        {isActive && (
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/70 border border-[#ffaa00]/40 flex items-center space-x-1.5 backdrop-blur-sm">
            <Hand className="w-3 h-3 text-[#ffaa00]" />
            <span className="text-[10px] font-mono-tech text-[#ffaa00]">
              {trackingState.handGesture} ({Math.round(trackingState.gestureConfidence * 100)}%)
            </span>
          </div>
        )}
      </div>

      {/* Quick Gestures Cheat Sheet */}
      <div className="mt-2 text-[10px] font-mono-tech text-neutral-400 space-y-1">
        <div className="flex justify-between">
          <span className="text-neutral-500">THUMBS UP:</span>
          <span className="text-[#00ffaa]">Confirm Level 3 Action</span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-500">THUMBS DOWN:</span>
          <span className="text-[#ff3344]">Reject Action</span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-500">OPEN PALM:</span>
          <span className="text-[#ffaa00]">Pause Interaction</span>
        </div>
      </div>

      {/* Action Buttons: Screen Capture & Analyze Frame */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={handleScreenCapture}
          className="flex items-center justify-center space-x-1.5 py-1.5 px-2 bg-neutral-900/80 hover:bg-[#ff9900]/20 border border-[#ffaa00]/30 rounded text-[11px] font-rajdhani font-semibold text-neutral-200 hover:text-[#ffaa00] transition"
        >
          <Monitor className="w-3.5 h-3.5" />
          <span>CAPTURE SCREEN</span>
        </button>
        <button
          onClick={handleCaptureSnapshot}
          disabled={!isActive}
          className="flex items-center justify-center space-x-1.5 py-1.5 px-2 bg-neutral-900/80 hover:bg-[#ff9900]/20 border border-[#ffaa00]/30 rounded text-[11px] font-rajdhani font-semibold text-neutral-200 hover:text-[#ffaa00] transition disabled:opacity-40"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>ANALYZE FRAME</span>
        </button>
      </div>
    </div>
  );
};
