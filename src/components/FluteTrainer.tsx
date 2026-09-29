import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { AudioVisualizer } from './AudioVisualizer';
import { PitchIndicator } from './PitchIndicator';
import { RagaMood } from './RagaMood';
import { useRagaAnalysis } from '@/hooks/useRagaAnalysis';
import { ragaAI } from '@/services/ragaAI';
import { Mic, MicOff, Play, Volume2, AlertTriangle, Settings, Key } from 'lucide-react';

export const FluteTrainer: React.FC = () => {
  const [isListening, setIsListening] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isResponding, setIsResponding] = useState(false);
  const [sessionTime, setSessionTime] = useState(0);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  
  const { feedback, analyzeLiveAudio, startPhrase, endPhrase, clearAnalysis } = useRagaAnalysis();

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

    // Simple phrase gate with enhanced detection and logging
    const now = performance.now();
    const onThresh = 0.04; // Lower threshold for easier triggering
    const offThresh = 0.02; // Lower silence threshold

    // Debug logging every 2 seconds
    if (now % 2000 < 16) {
      console.log(`Audio level: ${rms.toFixed(3)}, Playing: ${isPlayingPhrase}, Cooldown: ${cooldownRef.current}`);
    }

    if (rms > onThresh) {
      if (!isPlayingPhrase) {
        console.log('🎵 Phrase started! RMS:', rms.toFixed(3));
        setIsPlayingPhrase(true);
        startPhrase();
      }
      silenceStartRef.current = null;
    } else {
      if (isPlayingPhrase) {
        if (!silenceStartRef.current) {
          silenceStartRef.current = now;
          console.log('🔇 Silence detected, starting timer...');
        }
        const silenceDuration = now - silenceStartRef.current;
        if (silenceStartRef.current && silenceDuration > 500) { // Shorter silence detection
          // Phrase ended → trigger AI response once, with cooldown
          console.log('🎼 Phrase ended after', silenceDuration, 'ms silence. Triggering response...');
          setIsPlayingPhrase(false);
          if (!cooldownRef.current) {
            cooldownRef.current = true;
            handleAudioResponse().finally(() => {
              setTimeout(() => {
                cooldownRef.current = false;
                console.log('✅ Cooldown ended, ready for next phrase');
              }, 2000);
            });
          } else {
            console.log('⏱️ In cooldown, skipping response');
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
    
    try {
      // Get AI analysis of the phrase
      const analysis = await endPhrase();
      
      if (analysis && analysis.notes.length > 0) {
        // Create separate AudioContext for playback to avoid conflicts
        const playbackCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        // Ensure context is running
        if (playbackCtx.state === 'suspended') {
          await playbackCtx.resume();
        }

        // Play Raga-appropriate response using the analysis
        const notes = analysis.notes;
        console.log(`🎋 Playing ${analysis.ragaMood?.ragaName || 'traditional'} response with ${notes.length} notes`);
        
        if (analysis.ragaMood) {
          console.log(`🎵 Raga: ${analysis.ragaMood.ragaName} (${analysis.ragaMood.mood}) - ${(analysis.ragaMood.confidence * 100).toFixed(1)}% confidence`);
        }
        const startT = playbackCtx.currentTime + 0.1;
        let t = startT;

        console.log(`Playing ${notes.length} notes:`, notes);

        for (const note of notes) {
          try {
            const osc = playbackCtx.createOscillator();
            const gain = playbackCtx.createGain();
            
            // Use a more pleasant sound
            osc.type = 'sine';
            osc.frequency.setValueAtTime(note.frequency, t);
            
            // Increase volume and improve envelope
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.3, t + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.1, t + note.duration * 0.7);
            gain.gain.exponentialRampToValueAtTime(0.001, t + note.duration);
            
            osc.connect(gain).connect(playbackCtx.destination);
            osc.start(t);
            osc.stop(t + note.duration);
            
            t += note.duration;
          } catch (error) {
            console.error('Error creating oscillator:', error);
          }
        }

        // Wait for playback to finish
        const totalDuration = (t - startT + 0.2) * 1000;
        console.log(`Waiting ${totalDuration}ms for playback to complete`);
        await new Promise((resolve) => setTimeout(resolve, totalDuration));
        
        // Clean up playback context
        await playbackCtx.close();
      } else {
        console.log('No notes to play - using fallback delay');
        // Fallback for simple response
        await new Promise((resolve) => setTimeout(resolve, 1800));
      }
    } catch (error) {
      console.error('Audio response error:', error);
      // Fallback for any error
      await new Promise((resolve) => setTimeout(resolve, 1800));
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
    // Store for potential OpenAI integration with raga responses
    localStorage.setItem('openai_api_key', key);
  };

  // Test playback function to verify audio system
  const testPlayback = useCallback(async () => {
    console.log('🧪 Testing playback system...');
    try {
      const testCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      if (testCtx.state === 'suspended') {
        await testCtx.resume();
      }

      // Play a simple test melody
      const testNotes = [
        { frequency: 440, duration: 0.5 }, // A4
        { frequency: 493.88, duration: 0.5 }, // B4
        { frequency: 523.25, duration: 0.5 }, // C5
        { frequency: 587.33, duration: 0.7 }  // D5
      ];

      const startT = testCtx.currentTime + 0.1;
      let t = startT;

      console.log('Playing test notes:', testNotes);

      for (const note of testNotes) {
        const osc = testCtx.createOscillator();
        const gain = testCtx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(note.frequency, t);
        
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.3, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.1, t + note.duration * 0.7);
        gain.gain.exponentialRampToValueAtTime(0.001, t + note.duration);
        
        osc.connect(gain).connect(testCtx.destination);
        osc.start(t);
        osc.stop(t + note.duration);
        
        t += note.duration;
      }

      await new Promise((resolve) => setTimeout(resolve, (t - startT + 0.2) * 1000));
      await testCtx.close();
      
      console.log('✅ Test playback completed');
    } catch (error) {
      console.error('❌ Test playback failed:', error);
    }
  }, []);

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-6xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent animate-gentle-pulse">
            Echo Flute Flow
          </h1>
          <p className="text-xl text-muted-foreground">
            Your Bansuri companion - Play a phrase, I'll respond with raga wisdom
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

              {/* Test Playback Button */}
              <Button
                variant="outline"
                size="lg"
                onClick={testPlayback}
                disabled={isResponding}
                className="px-4"
                title="Test audio playback system"
              >
                <Play className="w-5 h-5" />
                Test Audio
              </Button>

              {/* Manual AI Response Trigger */}
              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  if (!cooldownRef.current && !isResponding) {
                    console.log('🔧 Manual AI response trigger');
                    cooldownRef.current = true;
                    handleAudioResponse().finally(() => {
                      setTimeout(() => {
                        cooldownRef.current = false;
                      }, 2000);
                    });
                  }
                }}
                disabled={isResponding || cooldownRef.current}
                className="px-4"
                title="Force AI response (for testing)"
              >
                <Volume2 className="w-5 h-5" />
                Force Response
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
              <p>🎋 Play a phrase on your bansuri, then pause — I'll respond in the same raga mood.</p>
              <p>✨ Let your musical expression flow naturally, I'll follow your lead.</p>
            </div>
          </div>
        </Card>

        {/* Musical Feedback */}
        <div className="grid md:grid-cols-2 gap-6">
          <PitchIndicator 
            pitch={feedback.currentPitch} 
            accuracy={feedback.pitchAccuracy} 
          />
          <RagaMood 
            analysis={feedback.ragaResponse} 
            isAnalyzing={feedback.isAnalyzing} 
          />
        </div>

        {/* Practice Philosophy */}
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { title: 'Raga Response', description: "I'll recognize your raga mood and respond accordingly", icon: '🎋' },
            { title: 'Musical Dialogue', description: 'Express freely - I follow your emotional intent', icon: '💫' },
            { title: 'Traditional Wisdom', description: 'Learn through musical conversation, not rules', icon: '🕉️' },
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