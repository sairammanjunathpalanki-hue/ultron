import { GestureType } from '../../../shared/types';

export interface Landmark3D {
  x: number;
  y: number;
  z: number;
}

export interface HandSample {
  landmarks: Landmark3D[];
  timestamp: number;
  center: { x: number; y: number; z: number };
}

export interface GestureTelemetry {
  gesture: GestureType;
  confidence: number;
  handDetected: boolean;
  handCount: number;
  pinchDistance: number;
  isPinching: boolean;
  handPos: { x: number; y: number };
  velocity: { vx: number; vy: number };
  continuousZoom: number; // Cumulative or incremental zoom
  continuousPan: { x: number; y: number }; // Drag offset
  continuousRotation: number; // Angle in radians
  fps: number;
  holdProgress: number; // 0.0 to 1.0 for PALM HOLD
}

export interface GestureCallbacks {
  onGestureTrigger?: (gesture: GestureType, confidence: number) => void;
  onContinuousTransform?: (transform: {
    zoomDelta: number;
    panDelta: { x: number; y: number };
    rotationDelta: number;
    handPos: { x: number; y: number };
  }) => void;
  onTelemetryUpdate?: (telemetry: GestureTelemetry) => void;
}

export class GestureController {
  private callbacks: GestureCallbacks;

  // History buffer for Hand 1 (Primary)
  private history: HandSample[] = [];
  private maxHistoryFrames = 15;

  // History buffer for Hand 2 (Secondary, for Two-Hand Gestures)
  private historySecondary: HandSample[] = [];

  // Gesture state tracking
  private activeGesture: GestureType = 'NONE';
  private gestureConfidence: number = 0;
  private lastTriggerTime: Record<string, number> = {};

  // Pinch & Drag virtual controller
  private isPinching: boolean = false;
  private pinchStartPos: { x: number; y: number } | null = null;
  private lastPinchDistance: number = 0;
  private smoothedPinchDist: number = 0;

  // Open Palm Hold state
  private palmHoldStartTime: number = 0;
  private palmHoldTriggered: boolean = false;

  // Wave detection
  private xReversals: number = 0;
  private lastDirX: number = 0;
  private waveStartTime: number = 0;

  // Two-hand state
  private lastTwoHandDist: number = 0;
  private lastTwoHandAngle: number = 0;

  // Telemetry
  private lastTimestamp: number = performance.now();
  private frameCount: number = 0;
  private currentFps: number = 30;

  constructor(callbacks: GestureCallbacks = {}) {
    this.callbacks = callbacks;
  }

  public setCallbacks(callbacks: GestureCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Process landmarks for up to 2 hands from MediaPipe HandLandmarker
   */
  public processHands(handsLandmarks: Landmark3D[][], timestampMs: number) {
    // 1. FPS calculation
    this.frameCount++;
    if (timestampMs - this.lastTimestamp >= 1000) {
      this.currentFps = Math.round((this.frameCount * 1000) / (timestampMs - this.lastTimestamp));
      this.frameCount = 0;
      this.lastTimestamp = timestampMs;
    }

    if (!handsLandmarks || handsLandmarks.length === 0) {
      this.resetTracking();
      this.emitTelemetry('NONE', 0, false, 0, 0, false, { x: 0.5, y: 0.5 }, { vx: 0, vy: 0 }, 0, { x: 0, y: 0 }, 0, 0);
      return;
    }

    // 2. Extract Primary Hand (Hand 1)
    const primaryLandmarks = handsLandmarks[0];
    const primaryCenter = this.calculateHandCenter(primaryLandmarks);
    const primarySample: HandSample = {
      landmarks: primaryLandmarks,
      timestamp: timestampMs,
      center: primaryCenter,
    };

    this.history.push(primarySample);
    if (this.history.length > this.maxHistoryFrames) {
      this.history.shift();
    }

    // 3. Extract Secondary Hand if present (Hand 2)
    let secondarySample: HandSample | null = null;
    if (handsLandmarks.length >= 2) {
      const secondaryLandmarks = handsLandmarks[1];
      secondarySample = {
        landmarks: secondaryLandmarks,
        timestamp: timestampMs,
        center: this.calculateHandCenter(secondaryLandmarks),
      };
      this.historySecondary.push(secondarySample);
      if (this.historySecondary.length > this.maxHistoryFrames) {
        this.historySecondary.shift();
      }
    } else {
      this.historySecondary = [];
      this.lastTwoHandDist = 0;
      this.lastTwoHandAngle = 0;
    }

    // 4. Kinematics (Velocity)
    const velocity = this.calculateVelocity();

    // 5. Detect Continuous Transformations (Pinch zoom, drag, two-hand zoom/rotation)
    const continuousData = this.processContinuousInteractions(primarySample, secondarySample);

    // 6. Detect Discrete Gestures (Swipe, Fist, Wave, Thumbs Up/Down, Palm Hold)
    const discreteGesture = this.classifyDiscreteGestures(primarySample, velocity, timestampMs);

    // 7. Update Telemetry and emit
    this.activeGesture = discreteGesture.gesture;
    this.gestureConfidence = discreteGesture.confidence;

    this.emitTelemetry(
      this.activeGesture,
      this.gestureConfidence,
      true,
      handsLandmarks.length,
      this.smoothedPinchDist,
      this.isPinching,
      { x: primaryCenter.x, y: primaryCenter.y },
      velocity,
      continuousData.zoomDelta,
      continuousData.panDelta,
      continuousData.rotationDelta,
      this.calculateHoldProgress(discreteGesture.gesture, timestampMs)
    );
  }

  /**
   * Process Continuous Interactions: Pinch Zoom, Pinch Drag, Two-Hand Zoom, Two-Hand Rotation
   */
  private processContinuousInteractions(
    primary: HandSample,
    secondary: HandSample | null
  ): {
    zoomDelta: number;
    panDelta: { x: number; y: number };
    rotationDelta: number;
  } {
    let zoomDelta = 0;
    let panDelta = { x: 0, y: 0 };
    let rotationDelta = 0;

    const thumbTip = primary.landmarks[4];
    const indexTip = primary.landmarks[8];
    const rawPinch = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y, thumbTip.z - indexTip.z);

    // Exponential Moving Average (EMA) for smooth pinch distance
    this.smoothedPinchDist = this.smoothedPinchDist === 0 ? rawPinch : this.smoothedPinchDist * 0.65 + rawPinch * 0.35;

    const PINCH_ENGAGE_THRESHOLD = 0.055;
    const PINCH_RELEASE_THRESHOLD = 0.085;

    // --- A. SINGLE HAND PINCH & DRAG ---
    if (!this.isPinching && this.smoothedPinchDist < PINCH_ENGAGE_THRESHOLD) {
      this.isPinching = true;
      this.pinchStartPos = { x: (thumbTip.x + indexTip.x) / 2, y: (thumbTip.y + indexTip.y) / 2 };
      this.lastPinchDistance = this.smoothedPinchDist;
      this.triggerGesture('PINCH', 0.95);
    } else if (this.isPinching && this.smoothedPinchDist > PINCH_RELEASE_THRESHOLD) {
      this.isPinching = false;
      this.pinchStartPos = null;
    }

    if (this.isPinching && this.pinchStartPos) {
      const currentPinchMid = { x: (thumbTip.x + indexTip.x) / 2, y: (thumbTip.y + indexTip.y) / 2 };
      // Pan delta relative to previous position
      panDelta = {
        x: (currentPinchMid.x - this.pinchStartPos.x) * 3.5,
        y: (currentPinchMid.y - this.pinchStartPos.y) * 3.5,
      };
      this.pinchStartPos = currentPinchMid;

      // Continuous Pinch Zoom: distance change between thumb & index
      const pinchDiff = this.smoothedPinchDist - this.lastPinchDistance;
      if (Math.abs(pinchDiff) > 0.002) {
        // Finger moving apart -> zoom in (>0), moving together -> zoom out (<0)
        zoomDelta += pinchDiff * 8.0;
      }
      this.lastPinchDistance = this.smoothedPinchDist;
    }

    // --- B. TWO-HAND INTERACTIONS ---
    if (secondary) {
      const pCenter = primary.center;
      const sCenter = secondary.center;

      const currentDist = Math.hypot(sCenter.x - pCenter.x, sCenter.y - pCenter.y);
      const currentAngle = Math.atan2(sCenter.y - pCenter.y, sCenter.x - pCenter.x);

      if (this.lastTwoHandDist > 0) {
        const distDiff = currentDist - this.lastTwoHandDist;
        // Two-hand distance change
        if (Math.abs(distDiff) > 0.004) {
          zoomDelta += distDiff * 4.0;
        }

        // Two-hand rotation change
        let angleDiff = currentAngle - this.lastTwoHandAngle;
        // Normalize angle wrap
        if (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        if (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        if (Math.abs(angleDiff) > 0.02) {
          rotationDelta = angleDiff * 1.5;
        }
      }

      this.lastTwoHandDist = currentDist;
      this.lastTwoHandAngle = currentAngle;
    } else {
      this.lastTwoHandDist = 0;
      this.lastTwoHandAngle = 0;
    }

    // Emit continuous transform callback
    if (
      (Math.abs(zoomDelta) > 0.0001 ||
        Math.abs(panDelta.x) > 0.0001 ||
        Math.abs(panDelta.y) > 0.0001 ||
        Math.abs(rotationDelta) > 0.0001) &&
      this.callbacks.onContinuousTransform
    ) {
      this.callbacks.onContinuousTransform({
        zoomDelta,
        panDelta,
        rotationDelta,
        handPos: { x: primary.center.x, y: primary.center.y },
      });
    }

    return { zoomDelta, panDelta, rotationDelta };
  }

  /**
   * Classify Discrete Gestures based on landmarks, finger states, and velocity vectors
   */
  private classifyDiscreteGestures(
    sample: HandSample,
    velocity: { vx: number; vy: number },
    timestampMs: number
  ): { gesture: GestureType; confidence: number } {
    const lm = sample.landmarks;
    const wrist = lm[0];

    const thumbTip = lm[4];
    const thumbMcp = lm[2];

    const indexTip = lm[8];
    const indexPip = lm[6];
    const indexMcp = lm[5];

    const middleTip = lm[12];
    const middlePip = lm[10];

    const ringTip = lm[16];
    const ringPip = lm[14];

    const pinkyTip = lm[20];
    const pinkyPip = lm[18];

    // Extended finger tests (tip higher/further than PIP knuckle relative to wrist)
    const isThumbExtended = Math.hypot(thumbTip.x - wrist.x, thumbTip.y - wrist.y) > 0.16;
    const isIndexExtended = indexTip.y < indexPip.y;
    const isMiddleExtended = middleTip.y < middlePip.y;
    const isRingExtended = ringTip.y < ringPip.y;
    const isPinkyExtended = pinkyTip.y < pinkyPip.y;

    const extendedCount =
      (isIndexExtended ? 1 : 0) +
      (isMiddleExtended ? 1 : 0) +
      (isRingExtended ? 1 : 0) +
      (isPinkyExtended ? 1 : 0);

    // --- 1. SWIPE DETECTION (Temporal Velocity & Distance over 8-12 frames) ---
    const swipeResult = this.detectSwipeGesture(timestampMs);
    if (swipeResult) {
      this.triggerGesture(swipeResult, 0.94);
      return { gesture: swipeResult, confidence: 0.94 };
    }

    // --- 2. WAVE DETECTION (Horizontal Reversals) ---
    const isWaving = this.detectWaveGesture(sample.center.x, timestampMs);
    if (isWaving && extendedCount >= 3) {
      this.triggerGesture('WAVE', 0.89);
      return { gesture: 'WAVE', confidence: 0.89 };
    }

    // --- 3. THUMBS UP ---
    // Thumb pointed UP, all 4 other fingers completely curled
    if (thumbTip.y < thumbMcp.y - 0.07 && extendedCount === 0) {
      this.triggerGesture('THUMBS_UP', 0.96);
      return { gesture: 'THUMBS_UP', confidence: 0.96 };
    }

    // --- 4. THUMBS DOWN ---
    // Thumb pointed DOWN, all 4 other fingers completely curled
    if (thumbTip.y > thumbMcp.y + 0.07 && extendedCount === 0) {
      this.triggerGesture('THUMBS_DOWN', 0.96);
      return { gesture: 'THUMBS_DOWN', confidence: 0.96 };
    }

    // --- 5. FIST ---
    // All fingers curled tight
    if (extendedCount === 0 && !isThumbExtended) {
      this.triggerGesture('FIST', 0.93);
      return { gesture: 'FIST', confidence: 0.93 };
    }

    // --- 6. PINCH ---
    if (this.isPinching) {
      return { gesture: 'PINCH', confidence: 0.95 };
    }

    // --- 7. OPEN PALM / PALM HOLD ---
    if (extendedCount >= 4 && isThumbExtended) {
      // Check for PALM HOLD (open hand held stationary for > 500ms)
      if (Math.abs(velocity.vx) < 0.08 && Math.abs(velocity.vy) < 0.08) {
        if (this.palmHoldStartTime === 0) {
          this.palmHoldStartTime = timestampMs;
        } else if (timestampMs - this.palmHoldStartTime >= 500 && !this.palmHoldTriggered) {
          this.palmHoldTriggered = true;
          this.triggerGesture('OPEN_PALM', 0.95);
        }
      } else {
        this.palmHoldStartTime = 0;
        this.palmHoldTriggered = false;
      }
      return { gesture: 'OPEN_PALM', confidence: 0.92 };
    } else {
      this.palmHoldStartTime = 0;
      this.palmHoldTriggered = false;
    }

    // --- 8. POINTING (Index extended only) ---
    if (isIndexExtended && extendedCount === 1) {
      const dx = indexTip.x - indexMcp.x;
      const dy = indexTip.y - indexMcp.y;
      if (Math.abs(dx) > Math.abs(dy)) {
        const pGesture = dx < -0.05 ? 'POINT_LEFT' : 'POINT_RIGHT';
        return { gesture: pGesture, confidence: 0.9 };
      } else {
        const pGesture = dy < -0.05 ? 'POINT_UP' : 'POINT_DOWN';
        return { gesture: pGesture, confidence: 0.9 };
      }
    }

    return { gesture: 'NONE', confidence: 0.4 };
  }

  /**
   * Detect Swipe Left / Right based on distance, velocity, and consistency
   */
  private detectSwipeGesture(nowMs: number): GestureType | null {
    if (this.history.length < 8) return null;

    // Cooldown check: 550ms between swipes
    const lastSwipe = Math.max(this.lastTriggerTime['SWIPE_LEFT'] || 0, this.lastTriggerTime['SWIPE_RIGHT'] || 0);
    if (nowMs - lastSwipe < 550) return null;

    const oldest = this.history[0];
    const newest = this.history[this.history.length - 1];

    const dt = (newest.timestamp - oldest.timestamp) / 1000;
    if (dt <= 0.08 || dt > 0.65) return null; // Reasonable duration window (80ms - 650ms)

    const dx = newest.center.x - oldest.center.x;
    const vx = dx / dt;

    // Distance threshold: ~16% screen width, Velocity threshold: > 0.40 units/sec
    const DISTANCE_THRESH = 0.16;
    const VELOCITY_THRESH = 0.4;

    // In mirrored selfie camera:
    // Moving hand from User's Right to Left -> dx < -DISTANCE_THRESH
    // Moving hand from User's Left to Right -> dx > DISTANCE_THRESH
    if (dx < -DISTANCE_THRESH && vx < -VELOCITY_THRESH) {
      // Verify consistency: ensure most frames were moving leftward
      let consistent = true;
      for (let i = 1; i < this.history.length; i++) {
        if (this.history[i].center.x - this.history[i - 1].center.x > 0.04) {
          consistent = false;
          break;
        }
      }
      if (consistent) {
        this.lastTriggerTime['SWIPE_LEFT'] = nowMs;
        return 'SWIPE_LEFT';
      }
    } else if (dx > DISTANCE_THRESH && vx > VELOCITY_THRESH) {
      let consistent = true;
      for (let i = 1; i < this.history.length; i++) {
        if (this.history[i].center.x - this.history[i - 1].center.x < -0.04) {
          consistent = false;
          break;
        }
      }
      if (consistent) {
        this.lastTriggerTime['SWIPE_RIGHT'] = nowMs;
        return 'SWIPE_RIGHT';
      }
    }

    return null;
  }

  /**
   * Detect Wave Motion (Horizontal Reversals)
   */
  private detectWaveGesture(currentX: number, nowMs: number): boolean {
    if (this.waveStartTime === 0 || nowMs - this.waveStartTime > 1000) {
      this.waveStartTime = nowMs;
      this.xReversals = 0;
      this.lastDirX = 0;
    }

    if (this.history.length < 2) return false;
    const prevX = this.history[this.history.length - 2].center.x;
    const dx = currentX - prevX;

    if (Math.abs(dx) > 0.02) {
      const dir = dx > 0 ? 1 : -1;
      if (this.lastDirX !== 0 && dir !== this.lastDirX) {
        this.xReversals++;
      }
      this.lastDirX = dir;
    }

    const lastWave = this.lastTriggerTime['WAVE'] || 0;
    if (this.xReversals >= 3 && nowMs - lastWave > 1200) {
      this.lastTriggerTime['WAVE'] = nowMs;
      this.xReversals = 0;
      return true;
    }

    return false;
  }

  private triggerGesture(gesture: GestureType, confidence: number) {
    const now = performance.now();
    const lastTime = this.lastTriggerTime[gesture] || 0;

    // Default debounce cooldown per gesture
    const cooldown = gesture === 'PINCH' ? 100 : gesture.startsWith('SWIPE') ? 500 : 700;
    if (now - lastTime < cooldown) return;

    this.lastTriggerTime[gesture] = now;
    if (this.callbacks.onGestureTrigger) {
      this.callbacks.onGestureTrigger(gesture, confidence);
    }
  }

  private calculateHoldProgress(gesture: GestureType, nowMs: number): number {
    if (gesture !== 'OPEN_PALM' || this.palmHoldStartTime === 0) return 0;
    return Math.min(1.0, (nowMs - this.palmHoldStartTime) / 500);
  }

  private calculateHandCenter(landmarks: Landmark3D[]): { x: number; y: number; z: number } {
    // Average wrist (0), MCPs (5, 9, 13, 17)
    const indices = [0, 5, 9, 13, 17];
    let sx = 0,
      sy = 0,
      sz = 0;
    for (const idx of indices) {
      sx += landmarks[idx].x;
      sy += landmarks[idx].y;
      sz += landmarks[idx].z;
    }
    return {
      x: sx / indices.length,
      y: sy / indices.length,
      z: sz / indices.length,
    };
  }

  private calculateVelocity(): { vx: number; vy: number } {
    if (this.history.length < 3) return { vx: 0, vy: 0 };
    const newest = this.history[this.history.length - 1];
    const prev = this.history[this.history.length - 3];
    const dt = (newest.timestamp - prev.timestamp) / 1000;
    if (dt <= 0) return { vx: 0, vy: 0 };

    return {
      vx: (newest.center.x - prev.center.x) / dt,
      vy: (newest.center.y - prev.center.y) / dt,
    };
  }

  private resetTracking() {
    this.history = [];
    this.historySecondary = [];
    this.isPinching = false;
    this.pinchStartPos = null;
    this.smoothedPinchDist = 0;
    this.palmHoldStartTime = 0;
    this.palmHoldTriggered = false;
    this.lastTwoHandDist = 0;
    this.lastTwoHandAngle = 0;
  }

  private emitTelemetry(
    gesture: GestureType,
    confidence: number,
    handDetected: boolean,
    handCount: number,
    pinchDistance: number,
    isPinching: boolean,
    handPos: { x: number; y: number },
    velocity: { vx: number; vy: number },
    continuousZoom: number,
    continuousPan: { x: number; y: number },
    continuousRotation: number,
    holdProgress: number
  ) {
    if (this.callbacks.onTelemetryUpdate) {
      this.callbacks.onTelemetryUpdate({
        gesture,
        confidence,
        handDetected,
        handCount,
        pinchDistance,
        isPinching,
        handPos,
        velocity,
        continuousZoom,
        continuousPan,
        continuousRotation,
        fps: this.currentFps,
        holdProgress,
      });
    }
  }
}
