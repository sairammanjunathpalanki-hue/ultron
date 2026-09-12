import React, { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, RefreshCw, Hand, Activity, Sparkles, Sliders, ShieldCheck } from 'lucide-react';
import { handLandmarkerService } from './handLandmarkerService';
import { GestureController, GestureTelemetry, Landmark3D } from './GestureController';
import { GestureType } from '../../../shared/types';

interface VisionTrackerProps {
  onGesture: (gesture: GestureType) => void;
  onContinuousTransform?: (transform: {
    zoomDelta: number;
    panDelta: { x: number; y: number };
    rotationDelta: number;
    handPos: { x: number; y: number };
  }) => void;
  onFrameCaptured?: (base64Image: string) => void;
  isActive: boolean;
  onToggleActive: () => void;
}

export const VisionTracker: React.FC<VisionTrackerProps> = ({
  onGesture,
  onContinuousTransform,
  onFrameCaptured,
  isActive,
  onToggleActive,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef = useRef<number | null>(null);
  const controllerRef = useRef<GestureController | null>(null);

  // States
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isAiLoading, setIsAiLoading] = useState<boolean>(true);
  const [showDebug, setShowDebug] = useState<boolean>(false);
  const [telemetry, setTelemetry] = useState<GestureTelemetry>({
    gesture: 'NONE',
    confidence: 0,
    handDetected: false,
    handCount: 0,
    pinchDistance: 0,
    isPinching: false,
    handPos: { x: 0.5, y: 0.5 },
    velocity: { vx: 0, vy: 0 },
    continuousZoom: 0,
    continuousPan: { x: 0, y: 0 },
    continuousRotation: 0,
    fps: 30,
    holdProgress: 0,
  });

  // Particles for holographic hand movement
  const particlesRef = useRef<Array<{ x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string }>>([]);

  // Reticle rotation angle
  const reticleAngleRef = useRef<number>(0);

  // Initialize GestureController & MediaPipe
  useEffect(() => {
    const controller = new GestureController({
      onGestureTrigger: (gesture, confidence) => {
        onGesture(gesture);
      },
      onContinuousTransform: (transform) => {
        if (onContinuousTransform) {
          onContinuousTransform(transform);
        }
      },
      onTelemetryUpdate: (data) => {
        setTelemetry(data);
      },
    });
    controllerRef.current = controller;

    // Load MediaPipe Models
    handLandmarkerService.initialize().then((ready) => {
      setIsAiLoading(!ready);
    });

    return () => {
      stopCamera();
    };
  }, []);

  // Sync callbacks when props change
  useEffect(() => {
    if (controllerRef.current) {
      controllerRef.current.setCallbacks({
        onGestureTrigger: (gesture) => onGesture(gesture),
        onContinuousTransform: (transform) => onContinuousTransform && onContinuousTransform(transform),
        onTelemetryUpdate: (data) => setTelemetry(data),
      });
    }
  }, [onGesture, onContinuousTransform]);

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
        await videoRef.current.play();
      }
      setCameraPermission(true);
      startRenderLoop();
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
      animRef.current = null;
    }
  };

  /**
   * Main Holographic Canvas Render Loop
   */
  const startRenderLoop = () => {
    const render = (time: number) => {
      animRef.current = requestAnimationFrame(render);

      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video || video.readyState < 2) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;

      // 1. Draw Mirrored Camera Feed
      ctx.save();
      ctx.clearRect(0, 0, w, h);
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, w, h);
      ctx.restore();

      // 2. Futuristic Cyber Dark Tint
      ctx.fillStyle = 'rgba(5, 5, 10, 0.40)';
      ctx.fillRect(0, 0, w, h);

      // 3. Scanline grid overlay
      ctx.strokeStyle = 'rgba(255, 170, 0, 0.04)';
      ctx.lineWidth = 1;
      for (let y = 0; y < h; y += 8) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // 4. Run Real-Time MediaPipe Hand Landmark Detection
      const detection = handLandmarkerService.detectVideoFrame(video, time);
      const handsLandmarks = (detection?.landmarks || []) as Landmark3D[][];

      // Pass raw landmarks to GestureController
      if (controllerRef.current) {
        controllerRef.current.processHands(handsLandmarks, time);
      }

      // 5. Draw Futuristic Holographic Skeletons for detected hands
      if (handsLandmarks && handsLandmarks.length > 0) {
        handsLandmarks.forEach((landmarks, handIndex) => {
          drawHolographicHand(ctx, landmarks, w, h, handIndex, time);
        });
      }

      // 6. Update & Draw Energy Particles
      updateAndDrawParticles(ctx, w, h);
    };

    animRef.current = requestAnimationFrame(render);
  };

  /**
   * Render glowing holographic hand skeleton & scanning HUD
   */
  const drawHolographicHand = (
    ctx: CanvasRenderingContext2D,
    landmarks: Landmark3D[],
    w: number,
    h: number,
    handIndex: number,
    time: number
  ) => {
    // Note: Video was drawn mirrored (translate w, scale -1, 1).
    // In normalized coords, x=0 is left of camera frame.
    // For mirrored display: pixelX = (1 - lm.x) * w, pixelY = lm.y * h.
    const toPx = (lm: Landmark3D) => ({
      x: (1 - lm.x) * w,
      y: lm.y * h,
    });

    const isPrimary = handIndex === 0;
    const baseColor = isPrimary ? '#ffaa00' : '#00d4ff';
    const glowColor = isPrimary ? 'rgba(255, 170, 0, 0.8)' : 'rgba(0, 212, 255, 0.8)';
    const lineColor = isPrimary ? 'rgba(255, 170, 0, 0.65)' : 'rgba(0, 212, 255, 0.65)';

    // Hand Skeletal Joint Connections
    const connections = [
      // Palm Base
      [0, 1], [1, 5], [5, 9], [9, 13], [13, 17], [17, 0],
      // Thumb
      [1, 2], [2, 3], [3, 4],
      // Index
      [5, 6], [6, 7], [7, 8],
      // Middle
      [9, 10], [10, 11], [11, 12],
      // Ring
      [13, 14], [14, 15], [15, 16],
      // Pinky
      [17, 18], [18, 19], [19, 20],
    ];

    // A. Draw Glowing Laser Connection Lines
    ctx.save();
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2.0;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 8;

    connections.forEach(([i, j]) => {
      const p1 = toPx(landmarks[i]);
      const p2 = toPx(landmarks[j]);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    });
    ctx.restore();

    // B. Draw Landmark Nodes
    landmarks.forEach((lm, idx) => {
      const p = toPx(lm);
      const isTip = idx === 4 || idx === 8 || idx === 12 || idx === 16 || idx === 20;
      const radius = isTip ? 4.5 : 2.5;

      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = isTip ? '#ffffff' : baseColor;
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 10;
      ctx.fill();

      if (isTip) {
        // Outer pulsing ring around fingertips
        ctx.beginPath();
        const tipPulse = radius + Math.sin(time * 0.01 + idx) * 2;
        ctx.arc(p.x, p.y, tipPulse, 0, Math.PI * 2);
        ctx.strokeStyle = glowColor;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.restore();
    });

    // C. Palm Center Circular Scanning Reticle
    const palmIndices = [0, 5, 9, 13, 17];
    let palmX = 0, palmY = 0;
    palmIndices.forEach((idx) => {
      const p = toPx(landmarks[idx]);
      palmX += p.x;
      palmY += p.y;
    });
    palmX /= palmIndices.length;
    palmY /= palmIndices.length;

    reticleAngleRef.current += 0.025;
    const angle = reticleAngleRef.current;
    const reticleRadius = 26;

    ctx.save();
    ctx.translate(palmX, palmY);
    ctx.rotate(angle);

    // Segmented outer ring
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 12;

    ctx.beginPath();
    ctx.arc(0, 0, reticleRadius, 0, Math.PI * 0.4);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, reticleRadius, Math.PI * 0.6, Math.PI);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, reticleRadius, Math.PI * 1.2, Math.PI * 1.6);
    ctx.stroke();

    // Center targeting crosshair
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.lineTo(6, 0);
    ctx.moveTo(0, -6);
    ctx.lineTo(0, 6);
    ctx.stroke();

    ctx.restore();

    // D. Emit holographic particles from index tip and wrist
    if (Math.random() < 0.35) {
      const tipP = toPx(landmarks[8]);
      particlesRef.current.push({
        x: tipP.x,
        y: tipP.y,
        vx: (Math.random() - 0.5) * 1.5,
        vy: (Math.random() - 0.5) * 1.5 - 1.0,
        life: 1.0,
        maxLife: 1.0,
        color: baseColor,
      });
    }

    // E. Floating Holographic HUD Label
    const wristP = toPx(landmarks[0]);
    ctx.save();
    ctx.fillStyle = '#0a0a14';
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = 1;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 6;

    const labelText = isPrimary
      ? `HAND #01 [TRACK: ACTIVE] // ${telemetry.gesture}`
      : `HAND #02 [SECONDARY]`;

    ctx.font = '10px "Share Tech Mono", monospace';
    const textMetrics = ctx.measureText(labelText);
    const boxW = textMetrics.width + 12;
    const boxH = 18;
    const boxX = wristP.x - boxW / 2;
    const boxY = wristP.y + 14;

    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    ctx.fillStyle = baseColor;
    ctx.fillText(labelText, boxX + 6, boxY + 12);
    ctx.restore();
  };

  /**
   * Update and draw trailing holographic particles
   */
  const updateAndDrawParticles = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const particles = particlesRef.current;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.035;

      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.5 * p.life, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life * 0.8;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.fill();
      ctx.restore();
    }
  };

  const handleCaptureSnapshot = () => {
    const canvas = canvasRef.current;
    if (canvas && onFrameCaptured) {
      const data = canvas.toDataURL('image/jpeg', 0.85);
      onFrameCaptured(data);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#08080c]/85 border border-[#ff9900]/30 rounded-lg p-3 backdrop-blur-md relative overflow-hidden shadow-2xl">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#ff9900]/20 mb-2">
        <div className="flex items-center space-x-2">
          <Activity className="w-4 h-4 text-[#ffaa00] animate-pulse" />
          <span className="text-xs font-orbitron tracking-wider text-[#ffaa00]">
            VISION TELEMETRY
          </span>
          {isAiLoading && (
            <span className="text-[9px] font-mono-tech px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
              LOADING MP...
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-[10px] font-mono-tech text-neutral-400">
            {telemetry.fps} FPS
          </span>
          <button
            onClick={() => setShowDebug(!showDebug)}
            className={`p-1 rounded text-xs transition border ${
              showDebug
                ? 'bg-[#ffaa00]/20 border-[#ffaa00] text-[#ffaa00]'
                : 'border-transparent text-neutral-400 hover:text-[#ffaa00]'
            }`}
            title="Toggle Debug Telemetry"
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>
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
            {isActive ? (
              <Camera className="w-4 h-4 text-[#00ffaa]" />
            ) : (
              <CameraOff className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Video / Canvas Viewport */}
      <div className="relative w-full aspect-[4/3] bg-[#020204] rounded border border-[#ffaa00]/25 overflow-hidden flex items-center justify-center">
        {isActive ? (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              className="hidden"
              width={640}
              height={480}
            />
            <canvas
              ref={canvasRef}
              width={640}
              height={480}
              className="w-full h-full object-cover"
            />
          </>
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-4">
            <CameraOff className="w-8 h-8 text-neutral-600 mb-2" />
            <span className="text-xs text-neutral-400 font-rajdhani">
              OPTICAL SENSOR OFF
            </span>
            <button
              onClick={onToggleActive}
              className="mt-2 px-3 py-1 text-[11px] font-mono-tech border border-[#ff9900]/50 text-[#ffaa00] hover:bg-[#ff9900]/20 rounded transition"
            >
              ACTIVATE CAMERA
            </button>
          </div>
        )}

        {/* Live Detected Gesture Badge */}
        {isActive && telemetry.handDetected && (
          <div className="absolute top-2 left-2 px-2.5 py-1 rounded bg-black/75 border border-[#ffaa00]/50 flex items-center space-x-2 backdrop-blur-md">
            <Hand className="w-3.5 h-3.5 text-[#ffaa00]" />
            <span className="text-[11px] font-mono-tech text-[#ffaa00] font-bold">
              {telemetry.gesture} ({Math.round(telemetry.confidence * 100)}%)
            </span>
            {telemetry.isPinching && (
              <span className="text-[9px] font-mono-tech px-1 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 animate-pulse">
                PINCH
              </span>
            )}
          </div>
        )}

        {/* Hold Progress Bar for Palm Hold */}
        {telemetry.holdProgress > 0 && (
          <div className="absolute bottom-2 left-4 right-4 h-1.5 bg-black/60 rounded-full overflow-hidden border border-[#ffaa00]/30">
            <div
              className="h-full bg-gradient-to-r from-[#ffaa00] to-[#00ffaa] transition-all duration-75"
              style={{ width: `${telemetry.holdProgress * 100}%` }}
            />
          </div>
        )}
      </div>

      {/* Debug Telemetry HUD Overlay (Toggleable) */}
      {showDebug && (
        <div className="mt-2 p-2 bg-black/80 rounded border border-[#ffaa00]/30 text-[10px] font-mono-tech text-neutral-300 space-y-1">
          <div className="flex justify-between border-b border-neutral-800 pb-1 text-[#ffaa00]">
            <span>DEBUG TELEMETRY:</span>
            <span>MP HANDS: {telemetry.handCount}</span>
          </div>
          <div className="grid grid-cols-2 gap-x-2">
            <div>POS: ({telemetry.handPos.x.toFixed(2)}, {telemetry.handPos.y.toFixed(2)})</div>
            <div>VEL: ({telemetry.velocity.vx.toFixed(2)}, {telemetry.velocity.vy.toFixed(2)})</div>
            <div>PINCH: {telemetry.pinchDistance.toFixed(3)}</div>
            <div>CONF: {Math.round(telemetry.confidence * 100)}%</div>
          </div>
        </div>
      )}

      {/* Supported Gestures Guide */}
      <div className="mt-2.5 text-[10px] font-mono-tech text-neutral-400 space-y-1">
        <div className="flex justify-between">
          <span className="text-neutral-500">SWIPE L/R:</span>
          <span className="text-[#ffaa00]">Rotate / Switch Panels</span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-500">PINCH / 2-HAND:</span>
          <span className="text-cyan-400">Continuous Zoom & Drag</span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-500">THUMBS UP / DOWN:</span>
          <span className="text-[#00ffaa]">Approve / Reject Level 3</span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-500">FIST / WAVE:</span>
          <span className="text-[#ff3344]">Release Drag / Wake Ultron</span>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-3 flex items-center space-x-2">
        <button
          onClick={handleCaptureSnapshot}
          disabled={!isActive}
          className="flex-1 flex items-center justify-center space-x-1.5 py-1.5 px-2 bg-neutral-900/80 hover:bg-[#ff9900]/20 border border-[#ffaa00]/30 rounded text-[11px] font-rajdhani font-semibold text-neutral-200 hover:text-[#ffaa00] transition disabled:opacity-40"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>ANALYZE SCENE</span>
        </button>
      </div>
    </div>
  );
};
