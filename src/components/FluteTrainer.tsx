import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { AudioVisualizer } from './AudioVisualizer';
import { PitchIndicator } from './PitchIndicator';
import { MusicalAdvice } from './MusicalAdvice';
import { useMusicalAnalysis } from '@/hooks/useMusicalAnalysis';
import { musicAI } from '@/services/musicAI';
import { Mic, MicOff, Play, Volume2, AlertTriangle, Settings, Key } from 'lucide-react';

export const FluteTrainer: React.FC = () => {
  const [isListening, setIsListening] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isResponding, setIsResponding] = useState(false);
  const [sessionTime, setSessionTime] = useState(0);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  
  const { feedback, analyzeLiveAudio, startPhrase, endPhrase, clearAnalysis } = useMusicalAnalysis();

  // Audio engine refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>();
  const isListeningRef = useRef(false);

  // Phrase detection refs
  const [isPlayingPhrase, setIsPlayingPhrase] = useState(false);
  const silenceStartRef = useRef<number | null>(null);
  const cooldownRef = useRef(false);

  const computeRMS = (data: Uint8Array) => {
    // Convert [0..255] to [-1..1] and compute RMS (perceived loudness)
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128;
      sum += v * v;
    }
    return Math.sqrt(sum / data.length);
  };

  const monitorAudio = () => {
    const analyser = analyserRef.current;
    if (!analyser) return;

    const buffer = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(buffer);

    const rms = computeRMS(buffer);
    // Scale a bit for UI
    setAudioLevel(Math.min(1, rms * 3));

    // Perform live pitch analysis
    analyzeLiveAudio(analyser);

    // Simple phrase gate with enhanced detection
    const now = performance.now();
    const onThresh = 0.06; // start phrase
    const offThresh = 0.03; // likely silence

    if (rms > onThresh) {
      if (!isPlayingPhrase) {
        setIsPlayingPhrase(true);
        startPhrase();
      }
      silenceStartRef.current = null;
    } else {
      if (isPlayingPhrase) {
        if (!silenceStartRef.current) silenceStartRef.current = now;
        if (silenceStartRef.current && now - silenceStartRef.current > 700) {
          // Phrase ended → trigger AI response once, with cooldown
          setIsPlayingPhrase(false);
          if (!cooldownRef.current) {
            cooldownRef.current = true;
            handleAudioResponse().finally(() => {
              setTimeout(() => (cooldownRef.current = false), 1200);
            });
          }
        }
      }
    }

    if (isListeningRef.current) {
      rafRef.current = requestAnimationFrame(monitorAudio);
    }
  };

  const startListening = useCallback(async () => {
    setPermissionError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      const audioCtx: AudioContext = new Ctx();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.85;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      streamRef.current = stream;
      audioCtxRef.current = audioCtx;
      analyserRef.current = analyser;
      sourceRef.current = source;

      // Begin monitoring
      isListeningRef.current = true;
      setIsListening(true);
      monitorAudio();
    } catch (err: any) {
      console.error('Microphone error:', err);
      setPermissionError(
        err?.name === 'NotAllowedError' || err?.name === 'SecurityError'
          ? 'Microphone access was denied. Please allow access and try again.'
          : 'Unable to access the microphone. Check your device and permissions.'
      );
      setIsListening(false);
      isListeningRef.current = false;
    }
  }, []);

  const stopListening = useCallback(async () => {
    isListeningRef.current = false;
    setIsListening(false);

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    try {
      sourceRef.current?.disconnect();
      analyserRef.current?.disconnect();
    } catch {}

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (audioCtxRef.current) {
      try {
        await audioCtxRef.current.close();
      } catch {}
      audioCtxRef.current = null;
    }

    setIsPlayingPhrase(false);
    silenceStartRef.current = null;
    clearAnalysis();
  }, [clearAnalysis]);

  // Enhanced AI musical response with analysis
  const handleAudioResponse = useCallback(async () => {
    setIsResponding(true);
    
    // Get AI analysis of the phrase
    const analysis = await endPhrase();
    
    const ctx = audioCtxRef.current;
    if (ctx && analysis) {
      // Ensure context is running
      if (ctx.state === 'suspended') {
        try { await ctx.resume(); } catch {}
      }

      // Play AI-generated response using the analysis
      const notes = analysis.notes;
      if (notes.length > 0) {
        const startT = ctx.currentTime + 0.1;
        let t = startT;

        for (const note of notes) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          
          osc.type = 'sine';
          osc.frequency.setValueAtTime(note.frequency, t);
          
          gain.gain.setValueAtTime(0.0001, t);
          gain.gain.linearRampToValueAtTime(0.1, t + 0.05);
          gain.gain.linearRampToValueAtTime(0.0001, t + note.duration - 0.05);
          
          osc.connect(gain).connect(ctx.destination);
          osc.start(t);
          osc.stop(t + note.duration);
          
          t += note.duration;
        }

        await new Promise((r) => setTimeout(r, (t - startT + 0.2) * 1000));
      }
    } else {
      // Fallback for simple response
      await new Promise((r) => setTimeout(r, 1800));
    }

    setIsResponding(false);
  }, [endPhrase]);

  const toggleListening = useCallback(async () => {
    if (!isListening) {
      await startListening();
    } else {
      await stopListening();
    }
  }, [isListening, startListening, stopListening]);

  // Session timer
  useEffect(() => {
    let interval: number | undefined;
    if (isListening) {
      interval = window.setInterval(() => setSessionTime((p) => p + 1), 1000);
    }
    return () => {
      if (interval) window.clearInterval(interval);
    };
  }, [isListening]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleApiKeyChange = (key: string) => {
    setApiKey(key);
    musicAI.setApiKey(key);
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-6xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent animate-gentle-pulse">
            FlowFlute
          </h1>
          <p className="text-xl text-muted-foreground">
            Your AI musical companion - Play, pause, and hear me flow back
          </p>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <Card className="backdrop-glass border-border/50 p-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-primary">OpenAI API Key (Optional)</h3>
              </div>
              <div className="space-y-2">
                <Input
                  type="password"
                  placeholder="sk-..."
                  value={apiKey}
                  onChange={(e) => handleApiKeyChange(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Add your OpenAI API key for enhanced AI musical responses. Without it, you'll get simple intelligent responses.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Main Control Panel */}
        <Card className="backdrop-glass border-border/50 p-8">
          <div className="space-y-6">
            {/* Session Stats */}
            <div className="flex justify-between items-center text-sm text-muted-foreground">
              <div className="flex items-center gap-4">
                <span>Session: {formatTime(sessionTime)}</span>
                <div className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4" />
                  <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-100"
                      style={{ width: `${audioLevel * 100}%` }}
                    />
                  </div>
                </div>
              </div>
              <div
                className={`px-3 py-1 rounded-full text-xs transition-flow ${
                  isListening
                    ? 'bg-primary/20 text-primary border border-primary/30'
                    : 'bg-muted/50 text-muted-foreground'
                }`}
              >
                {isListening ? (isPlayingPhrase ? 'You’re Playing' : 'Listening') : 'Ready to Begin'}
              </div>
            </div>

            {/* Audio Visualizer */}
            <AudioVisualizer isListening={isListening} audioLevel={audioLevel} isResponding={isResponding} />

            {permissionError && (
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm">{permissionError}</span>
              </div>
            )}

            {/* Control Buttons */}
            <div className="flex justify-center gap-4">
              <Button
                variant={isListening ? 'response' : 'flow'}
                size="lg"
                onClick={toggleListening}
                disabled={isResponding}
                className="px-8 py-4 text-lg"
              >
                {isListening ? (
                  <>
                    <MicOff className="w-5 h-5" />
                    Stop Session
                  </>
                ) : (
                  <>
                    <Mic className="w-5 h-5" />
                    Start Playing
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                size="lg"
                onClick={() => setShowSettings(!showSettings)}
                className="px-4"
              >
                <Settings className="w-5 h-5" />
              </Button>

              {isResponding && (
                <Button variant="pulse" size="lg" disabled>
                  <Play className="w-5 h-5 animate-pulse" />
                  AI Responding...
                </Button>
              )}
            </div>

            {/* Instructions */}
            <div className="text-center text-sm text-muted-foreground space-y-2">
              <p>🎵 Play a short phrase, then pause — I’ll answer musically.</p>
              <p>✨ Best results with a quiet room and mic access allowed.</p>
            </div>
          </div>
        </Card>

        {/* Musical Feedback */}
        <div className="grid md:grid-cols-2 gap-6">
          <PitchIndicator 
            pitch={feedback.currentPitch} 
            accuracy={feedback.pitchAccuracy} 
          />
          <MusicalAdvice 
            analysis={feedback.phraseAnalysis} 
            isAnalyzing={feedback.isAnalyzing} 
          />
        </div>

        {/* Practice Tips */}
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { title: 'Listen & Flow', description: "I'll follow your phrases and respond", icon: '🎼' },
            { title: 'Natural Rhythm', description: 'Focus on expression, not perfection', icon: '🌊' },
            { title: 'Conversation', description: 'We trade ideas like musicians', icon: '💫' },
          ].map((tip, i) => (
            <Card key={i} className="backdrop-glass border-border/30 p-6 text-center space-y-3">
              <div className="text-3xl">{tip.icon}</div>
              <h3 className="font-semibold text-primary">{tip.title}</h3>
              <p className="text-sm text-muted-foreground">{tip.description}</p>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};