export interface VoiceEngineCallbacks {
  onTranscript: (transcript: string, isFinal: boolean) => void;
  onAudioAmplitude: (amplitude: number) => void;
  onStateChange: (state: 'idle' | 'listening' | 'speaking' | 'error') => void;
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

  public wakeWord: string = 'ultron';
  public wakeMode: boolean = true; // Automatically triggers when starting with "Ultron..."

  constructor(callbacks: VoiceEngineCallbacks) {
    this.callbacks = callbacks;
    this.initSpeechRecognition();
  }

  private initSpeechRecognition() {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('[VoiceEngine] Web Speech API not supported in this browser.');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';

    this.recognition.onstart = () => {
      this.isListening = true;
      this.callbacks.onStateChange('listening');
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

      const activeText = finalTranscript || interimTranscript;
      if (activeText.trim()) {
        this.callbacks.onTranscript(activeText.trim(), !!finalTranscript);
      }
    };

    this.recognition.onerror = (event: any) => {
      console.warn('[VoiceEngine] Recognition error:', event.error);
      if (event.error !== 'no-speech') {
        this.callbacks.onError(`Voice recognition error: ${event.error}`);
      }
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.callbacks.onStateChange('idle');
      // If not manually stopped and not muted, keep listening in wake mode
      if (this.wakeMode && !this.isMuted) {
        try {
          this.recognition.start();
        } catch (_) {}
      }
    };
  }

  // Initialize Microphone & Audio Analysis for Core reactivity
  public async initAudioAnalyser(): Promise<boolean> {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return false;
      }
      this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioCtx();
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

      // Compute average RMS
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

  // Start Voice Listening
  public startListening() {
    if (this.isMuted) return;
    if (this.recognition && !this.isListening) {
      try {
        this.recognition.start();
      } catch (_) {}
    }
  }

  // Stop Voice Listening
  public stopListening() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (_) {}
    }
    this.isListening = false;
  }

  // Toggle Mute
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

    if (!cleanText) return;

    this.currentUtterance = new SpeechSynthesisUtterance(cleanText);
    this.currentUtterance.rate = 1.05;
    this.currentUtterance.pitch = 0.95; // Slightly deeper, authoritative Ultron tone

    // Try to pick an English voice
    const voices = window.speechSynthesis.getVoices();
    const deepVoice = voices.find(
      (v) => v.lang.includes('en') && (v.name.includes('Male') || v.name.includes('David') || v.name.includes('Google UK English Male'))
    );
    if (deepVoice) {
      this.currentUtterance.voice = deepVoice;
    }

    this.callbacks.onStateChange('speaking');

    this.currentUtterance.onend = () => {
      this.callbacks.onStateChange('idle');
      if (onEnd) onEnd();
    };

    this.currentUtterance.onerror = () => {
      this.callbacks.onStateChange('idle');
    };

    window.speechSynthesis.speak(this.currentUtterance);
  }

  // Emergency STOP / Barge-in
  public stopSpeaking(): void {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.callbacks.onStateChange('idle');
  }

  public dispose() {
    this.stopListening();
    this.stopSpeaking();
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
