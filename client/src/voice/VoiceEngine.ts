export interface VoiceEngineCallbacks {
  onWakeWordDetected: (phrase: string) => void;
  onTranscript: (transcript: string, isFinal: boolean) => void;
  onAudioAmplitude: (amplitude: number) => void;
  onStateChange: (state: 'idle' | 'wake_detected' | 'listening' | 'speaking' | 'error') => void;
  onError: (error: string) => void;
}

export class VoiceEngine {
  private recognition: any = null;
  private isListening: boolean = false;
  private isMuted: boolean = false;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private micStream: MediaStream | null = null;
  private animFrameId: number | null = null;
  private callbacks: VoiceEngineCallbacks;
  private currentUtterance: SpeechSynthesisUtterance | null = null;

  public wakeWordEnabled: boolean = true;
  public conversationalMode: boolean = true; // Auto-listen for follow-up turns
  private isWakeTriggered: boolean = false;
  private silenceTimer: any = null;
  private lastSpokenText: string = '';

  constructor(callbacks: VoiceEngineCallbacks) {
    this.callbacks = callbacks;
    this.initSpeechRecognition();
  }

  private initSpeechRecognition() {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('[VoiceEngine] Web Speech API not supported in this browser environment.');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';

    this.recognition.onstart = () => {
      this.isListening = true;
      if (this.isWakeTriggered) {
        this.callbacks.onStateChange('listening');
      } else {
        this.callbacks.onStateChange('idle');
      }
    };

    this.recognition.onresult = (event: any) => {
      // Barge-in: if Ultron is currently speaking, user speech interrupts Ultron!
      if (window.speechSynthesis && window.speechSynthesis.speaking) {
        this.stopSpeaking();
      }

      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const item = event.results[i];
        const text = item[0].transcript;
        if (item.isFinal) {
          finalTranscript += text;
        } else {
          interimTranscript += text;
        }
      }

      const rawText = (finalTranscript || interimTranscript).trim();
      const lower = rawText.toLowerCase();

      // Check for Universal STOP keyword
      if (lower === 'stop' || lower === 'stop ultron' || lower === 'cancel' || lower === 'abort') {
        this.stopSpeaking();
        this.isWakeTriggered = false;
        this.callbacks.onTranscript(rawText, true);
        return;
      }

      // Check for Wake Words: "ultron", "hey ultron", "ok ultron"
      if (!this.isWakeTriggered && this.wakeWordEnabled) {
        const hasWakeWord =
          lower.startsWith('ultron') ||
          lower.startsWith('hey ultron') ||
          lower.startsWith('ok ultron') ||
          lower.includes('hey ultron') ||
          lower === 'ultron';

        if (hasWakeWord) {
          this.isWakeTriggered = true;
          this.playWakeChime();
          this.callbacks.onWakeWordDetected('ultron');
          this.callbacks.onStateChange('wake_detected');

          // Extract any immediate trailing prompt: e.g. "Ultron, what is the weather?"
          const cleanedPrompt = rawText
            .replace(/^(hey\s+)?ultron[,.\s]*/i, '')
            .replace(/^ok\s+ultron[,.\s]*/i, '')
            .trim();

          if (cleanedPrompt.length > 2) {
            // Immediate command included with wake word
            this.callbacks.onTranscript(cleanedPrompt, !!finalTranscript);
          }
          return;
        }
      }

      // If active and listening
      if (this.isWakeTriggered || !this.wakeWordEnabled) {
        this.lastSpokenText = rawText;
        this.callbacks.onTranscript(rawText, !!finalTranscript);

        // Reset silence timer on interim speech
        if (this.silenceTimer) clearTimeout(this.silenceTimer);

        // If speech pauses for >1400ms on continuous speech, treat as turn complete
        if (!finalTranscript && rawText.length > 3) {
          this.silenceTimer = setTimeout(() => {
            if (this.lastSpokenText.trim()) {
              this.callbacks.onTranscript(this.lastSpokenText.trim(), true);
              this.lastSpokenText = '';
            }
          }, 1500);
        }
      }
    };

    this.recognition.onerror = (event: any) => {
      if (event.error !== 'no-speech') {
        console.warn('[VoiceEngine] Recognition error:', event.error);
        if (event.error === 'not-allowed') {
          this.callbacks.onError('Microphone permission denied.');
        }
      }
    };

    this.recognition.onend = () => {
      this.isListening = false;
      // In continuous wake mode, seamlessly restart speech recognition
      if (!this.isMuted) {
        try {
          this.recognition.start();
        } catch (_) {}
      }
    };
  }

  // High-Tech Synthesized Dual-Tone Wake Chime (Web Audio API)
  public playWakeChime() {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!this.audioContext) {
        this.audioContext = new AudioCtx();
      }
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }

      const now = this.audioContext.currentTime;
      const osc1 = this.audioContext.createOscillator();
      const osc2 = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(440, now);
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.12);

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(660, now + 0.04);
      osc2.frequency.exponentialRampToValueAtTime(1320, now + 0.16);

      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.25, now + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      osc1.start(now);
      osc2.start(now + 0.04);
      osc1.stop(now + 0.3);
      osc2.stop(now + 0.3);
    } catch (err) {
      console.warn('[VoiceEngine] Wake chime error:', err);
    }
  }

  // Initialize Microphone & Audio Analysis for Core visual reactivity
  public async initAudioAnalyser(): Promise<boolean> {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return false;
      }
      this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!this.audioContext) {
        this.audioContext = new AudioCtx();
      }
      const source = this.audioContext.createMediaStreamSource(this.micStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);

      this.startAnalyserLoop();
      return true;
    } catch (err: any) {
      console.warn('[VoiceEngine] AudioContext microphone error:', err);
      return false;
    }
  }

  private startAnalyserLoop() {
    if (!this.analyser) return;
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

    const checkAudio = () => {
      this.animFrameId = requestAnimationFrame(checkAudio);
      if (!this.analyser || this.isMuted) {
        this.callbacks.onAudioAmplitude(0);
        return;
      }

      this.analyser.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length;
      const normalizedAmp = Math.min(1.0, avg / 128.0);
      this.callbacks.onAudioAmplitude(normalizedAmp);
    };

    checkAudio();
  }

  public setWakeActive(active: boolean) {
    this.isWakeTriggered = active;
    if (active) {
      this.callbacks.onStateChange('listening');
    } else {
      this.callbacks.onStateChange('idle');
    }
  }

  public getIsWakeActive(): boolean {
    return this.isWakeTriggered;
  }

  public startListening() {
    if (this.isMuted) return;
    if (this.recognition && !this.isListening) {
      try {
        this.recognition.start();
      } catch (_) {}
    }
  }

  public stopListening() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (_) {}
    }
    this.isListening = false;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopListening();
      this.stopSpeaking();
    } else {
      this.startListening();
    }
    return this.isMuted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  // Natural Speech Synthesis with Barge-in
  public speak(text: string, onEnd?: () => void): void {
    if (this.isMuted || !('speechSynthesis' in window)) return;

    this.stopSpeaking();

    // Clean up markdown / technical tags for natural speech
    const cleanText = text
      .replace(/\[.*?\]/g, '')
      .replace(/[*#_`]/g, '')
      .replace(/https?:\/\/[^\s]+/g, 'link')
      .trim();

    if (!cleanText) {
      if (onEnd) onEnd();
      return;
    }

    this.currentUtterance = new SpeechSynthesisUtterance(cleanText);
    this.currentUtterance.rate = 1.05;
    this.currentUtterance.pitch = 0.95; // Calm, authoritative Ultron tone

    // Select preferred natural English voice
    const voices = window.speechSynthesis.getVoices();
    const deepVoice = voices.find(
      (v) =>
        v.lang.includes('en') &&
        (v.name.includes('Male') ||
          v.name.includes('David') ||
          v.name.includes('Google UK English Male') ||
          v.name.includes('Daniel') ||
          v.name.includes('Arthur'))
    );
    if (deepVoice) {
      this.currentUtterance.voice = deepVoice;
    }

    this.callbacks.onStateChange('speaking');

    this.currentUtterance.onend = () => {
      this.callbacks.onStateChange(this.isWakeTriggered ? 'listening' : 'idle');
      if (onEnd) onEnd();
    };

    this.currentUtterance.onerror = () => {
      this.callbacks.onStateChange('idle');
      if (onEnd) onEnd();
    };

    window.speechSynthesis.speak(this.currentUtterance);
  }

  // Emergency STOP / Barge-in
  public stopSpeaking(): void {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
    }
    this.callbacks.onStateChange('idle');
  }

  public dispose() {
    this.stopListening();
    this.stopSpeaking();
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
    }
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
    }
    if (this.audioContext) {
      this.audioContext.close();
    }
  }
}
