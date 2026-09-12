import { FilesetResolver, HandLandmarker, HandLandmarkerResult } from '@mediapipe/tasks-vision';

export class HandLandmarkerService {
  private static instance: HandLandmarkerService | null = null;
  private landmarker: HandLandmarker | null = null;
  private isInitializing: boolean = false;
  private initError: string | null = null;

  public static getInstance(): HandLandmarkerService {
    if (!HandLandmarkerService.instance) {
      HandLandmarkerService.instance = new HandLandmarkerService();
    }
    return HandLandmarkerService.instance;
  }

  public async initialize(): Promise<boolean> {
    if (this.landmarker) return true;
    if (this.isInitializing) {
      // Wait if already initializing
      while (this.isInitializing) {
        await new Promise((r) => setTimeout(r, 100));
      }
      return !!this.landmarker;
    }

    this.isInitializing = true;
    this.initError = null;

    try {
      // Load MediaPipe WASM binaries from high-performance CDN
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
      );

      // Model asset: Google MediaPipe float16 Hand Landmarker bundle
      const modelAssetPath =
        'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

      try {
        // Preferred GPU acceleration
        this.landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath,
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 2,
          minHandDetectionConfidence: 0.45,
          minHandPresenceConfidence: 0.45,
          minTrackingConfidence: 0.45,
        });
      } catch (gpuError) {
        console.warn('[HandLandmarker] GPU delegate initialization failed, falling back to CPU:', gpuError);
        // Fallback to CPU delegate if device WebGL has strict limits
        this.landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath,
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          numHands: 2,
          minHandDetectionConfidence: 0.45,
          minHandPresenceConfidence: 0.45,
          minTrackingConfidence: 0.45,
        });
      }

      console.log('[HandLandmarker] MediaPipe Hand Landmarker initialized successfully.');
      this.isInitializing = false;
      return true;
    } catch (err: any) {
      console.error('[HandLandmarker] Failed to initialize MediaPipe:', err);
      this.initError = err?.message || 'MediaPipe initialization error';
      this.isInitializing = false;
      return false;
    }
  }

  public detectVideoFrame(video: HTMLVideoElement, timestampMs: number): HandLandmarkerResult | null {
    if (!this.landmarker || !video || video.readyState < 2) {
      return null;
    }

    try {
      return this.landmarker.detectForVideo(video, timestampMs);
    } catch (err) {
      console.warn('[HandLandmarker] Frame detection error:', err);
      return null;
    }
  }

  public isReady(): boolean {
    return !!this.landmarker;
  }

  public getError(): string | null {
    return this.initError;
  }

  public dispose(): void {
    if (this.landmarker) {
      this.landmarker.close();
      this.landmarker = null;
    }
  }
}

export const handLandmarkerService = HandLandmarkerService.getInstance();
