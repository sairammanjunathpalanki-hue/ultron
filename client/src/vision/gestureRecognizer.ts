import { GestureType } from '../../../shared/types';

export interface HandLandmark {
  x: number;
  y: number;
  z: number;
}

export class GestureClassifier {
  private lastGesture: GestureType = 'NONE';
  private gestureHoldStartTime: number = 0;
  private holdDurationThresholdMs: number = 450; // Debounce threshold
  private triggeredCurrentHold: boolean = false;
  private lastXPositions: number[] = [];

  // Classify raw 21 hand landmarks from MediaPipe
  // 0: Wrist
  // 1-4: Thumb (4: Tip)
  // 5-8: Index (8: Tip)
  // 9-12: Middle (12: Tip)
  // 13-16: Ring (16: Tip)
  // 17-20: Pinky (20: Tip)
  public classify(landmarks: HandLandmark[]): { gesture: GestureType; confidence: number } {
    if (!landmarks || landmarks.length < 21) {
      return { gesture: 'NONE', confidence: 0 };
    }

    const wrist = landmarks[0];
    const thumbTip = landmarks[4];
    const thumbIp = landmarks[3];
    const thumbMcp = landmarks[2];

    const indexTip = landmarks[8];
    const indexPip = landmarks[6];
    const indexMcp = landmarks[5];

    const middleTip = landmarks[12];
    const middlePip = landmarks[10];

    const ringTip = landmarks[16];
    const ringPip = landmarks[14];

    const pinkyTip = landmarks[20];
    const pinkyPip = landmarks[18];

    // Helper: is finger extended (tip is further from wrist/pip than knuckle)
    const isIndexExtended = indexTip.y < indexPip.y;
    const isMiddleExtended = middleTip.y < middlePip.y;
    const isRingExtended = ringTip.y < ringPip.y;
    const isPinkyExtended = pinkyTip.y < pinkyPip.y;

    // Distances
    const pinchDistance = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);

    // Track horizontal movement for WAVE gesture
    this.lastXPositions.push(wrist.x);
    if (this.lastXPositions.length > 12) {
      this.lastXPositions.shift();
    }
    const isWaving = this.detectWaveMotion();

    // 1. PINCH: thumb tip close to index tip
    if (pinchDistance < 0.055 && isMiddleExtended) {
      return { gesture: 'PINCH', confidence: 0.92 };
    }

    // 2. WAVE: open hand oscillating horizontally
    if (isWaving && isIndexExtended && isMiddleExtended && isRingExtended && isPinkyExtended) {
      return { gesture: 'WAVE', confidence: 0.88 };
    }

    // 3. THUMBS UP: Thumb pointing up (tip much higher than MCP), all other fingers folded
    if (
      thumbTip.y < thumbMcp.y - 0.08 &&
      !isIndexExtended &&
      !isMiddleExtended &&
      !isRingExtended &&
      !isPinkyExtended
    ) {
      return { gesture: 'THUMBS_UP', confidence: 0.95 };
    }

    // 4. THUMBS DOWN: Thumb pointing down (tip much lower than MCP), other fingers folded
    if (
      thumbTip.y > thumbMcp.y + 0.08 &&
      !isIndexExtended &&
      !isMiddleExtended &&
      !isRingExtended &&
      !isPinkyExtended
    ) {
      return { gesture: 'THUMBS_DOWN', confidence: 0.95 };
    }

    // 5. FIST: All fingers curled into palm
    if (
      !isIndexExtended &&
      !isMiddleExtended &&
      !isRingExtended &&
      !isPinkyExtended &&
      thumbTip.x > indexMcp.x - 0.05 && thumbTip.x < indexMcp.x + 0.05
    ) {
      return { gesture: 'FIST', confidence: 0.9 };
    }

    // 6. OPEN PALM: All 4 main fingers extended
    if (isIndexExtended && isMiddleExtended && isRingExtended && isPinkyExtended) {
      return { gesture: 'OPEN_PALM', confidence: 0.94 };
    }

    // 7. POINTING (Index extended, others curled)
    if (isIndexExtended && !isMiddleExtended && !isRingExtended && !isPinkyExtended) {
      const dx = indexTip.x - indexMcp.x;
      const dy = indexTip.y - indexMcp.y;

      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx < -0.06) return { gesture: 'POINT_LEFT', confidence: 0.9 };
        if (dx > 0.06) return { gesture: 'POINT_RIGHT', confidence: 0.9 };
      } else {
        if (dy < -0.06) return { gesture: 'POINT_UP', confidence: 0.9 };
        if (dy > 0.06) return { gesture: 'POINT_DOWN', confidence: 0.9 };
      }
    }

    return { gesture: 'NONE', confidence: 0.5 };
  }

  private detectWaveMotion(): boolean {
    if (this.lastXPositions.length < 10) return false;
    let reversals = 0;
    let lastDir = 0;
    for (let i = 1; i < this.lastXPositions.length; i++) {
      const diff = this.lastXPositions[i] - this.lastXPositions[i - 1];
      if (Math.abs(diff) > 0.015) {
        const dir = diff > 0 ? 1 : -1;
        if (lastDir !== 0 && dir !== lastDir) {
          reversals++;
        }
        lastDir = dir;
      }
    }
    return reversals >= 2;
  }

  // Debounced gesture trigger: ensures a gesture is held for threshold before firing
  public processStableGesture(
    rawGesture: GestureType,
    confidence: number,
    onTrigger: (gesture: GestureType) => void
  ): void {
    const now = Date.now();

    if (rawGesture === 'NONE' || confidence < 0.75) {
      this.lastGesture = 'NONE';
      this.triggeredCurrentHold = false;
      return;
    }

    if (rawGesture !== this.lastGesture) {
      this.lastGesture = rawGesture;
      this.gestureHoldStartTime = now;
      this.triggeredCurrentHold = false;
      return;
    }

    // Gesture is maintained
    if (!this.triggeredCurrentHold && now - this.gestureHoldStartTime >= this.holdDurationThresholdMs) {
      this.triggeredCurrentHold = true;
      onTrigger(rawGesture);
    }
  }
}
