import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AudioVisualizer } from './AudioVisualizer';
import { Mic, MicOff, Play, Pause, Volume2 } from 'lucide-react';

export const FluteTrainer: React.FC = () => {
  const [isListening, setIsListening] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isResponding, setIsResponding] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [sessionTime, setSessionTime] = useState(0);

  // Initialize audio context and media recorder
  const initializeAudio = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        } 
      });
      
      const audioCtx = new AudioContext();
      const analyserNode = audioCtx.createAnalyser();
      analyserNode.fftSize = 256;
      
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyserNode);
      
      setAudioContext(audioCtx);
      setAnalyser(analyserNode);

      const recorder = new MediaRecorder(stream);
      setMediaRecorder(recorder);

      // Set up audio level monitoring
      const dataArray = new Uint8Array(analyserNode.frequencyBinCount);
      
      const monitorAudio = () => {
        if (!analyserNode) return;
        
        analyserNode.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
        const normalizedLevel = average / 255;
        
        setAudioLevel(normalizedLevel);
        
        if (isListening) {
          requestAnimationFrame(monitorAudio);
        }
      };

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          // Here we would process the audio and generate AI response
          handleAudioResponse();
        }
      };

      recorder.onstop = () => {
        setIsListening(false);
      };

      if (isListening) {
        monitorAudio();
      }

    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  }, [isListening]);

  // Simulate AI musical response
  const handleAudioResponse = useCallback(async () => {
    setIsResponding(true);
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
    
    // Simulate response playback
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
    
    setIsResponding(false);
  }, []);

  // Toggle listening state
  const toggleListening = useCallback(async () => {
    if (!isListening) {
      await initializeAudio();
      setIsListening(true);
      if (mediaRecorder && mediaRecorder.state === 'inactive') {
        mediaRecorder.start(1000); // Collect data every second
      }
    } else {
      setIsListening(false);
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }
      if (audioContext) {
        audioContext.close();
      }
    }
  }, [isListening, mediaRecorder, audioContext, initializeAudio]);

  // Session timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isListening) {
      interval = setInterval(() => {
        setSessionTime(prev => prev + 1);
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isListening]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
            Your AI musical companion - Play, listen, flow together
          </p>
        </div>

        {/* Main Control Panel */}
        <Card className="backdrop-glass border-border/50 p-8">
          <div className="space-y-6">
            
            {/* Session Stats */}
            <div className="flex justify-between items-center text-sm text-muted-foreground">
              <div className="flex items-center gap-4">
                <span>Session: {formatTime(sessionTime)}</span>
                <div className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4" />
                  <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-100"
                      style={{ width: `${audioLevel * 100}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className={`px-3 py-1 rounded-full text-xs transition-flow ${
                isListening 
                  ? 'bg-primary/20 text-primary border border-primary/30' 
                  : 'bg-muted/50 text-muted-foreground'
              }`}>
                {isListening ? 'Active Session' : 'Ready to Begin'}
              </div>
            </div>

            {/* Audio Visualizer */}
            <AudioVisualizer 
              isListening={isListening}
              audioLevel={audioLevel}
              isResponding={isResponding}
            />

            {/* Control Buttons */}
            <div className="flex justify-center gap-4">
              <Button
                variant={isListening ? "response" : "flow"}
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

              {isResponding && (
                <Button variant="pulse" size="lg" disabled>
                  <Play className="w-5 h-5 animate-pulse" />
                  AI Responding...
                </Button>
              )}
            </div>

            {/* Instructions */}
            <div className="text-center text-sm text-muted-foreground space-y-2">
              <p>🎵 Play your flute and I'll listen, then play back with you</p>
              <p>✨ Let the music flow - no words needed, just beautiful sound</p>
            </div>

          </div>
        </Card>

        {/* Practice Tips */}
        <div className="grid md:grid-cols-3 gap-4">
          {[
            {
              title: "Listen & Flow",
              description: "Play freely, I'll follow your musical phrases and respond",
              icon: "🎼"
            },
            {
              title: "Natural Rhythm",
              description: "Don't worry about perfection - focus on musical expression",
              icon: "🌊"
            },
            {
              title: "Musical Conversation", 
              description: "We'll trade phrases back and forth like jazz musicians",
              icon: "💫"
            }
          ].map((tip, index) => (
            <Card key={index} className="backdrop-glass border-border/30 p-6 text-center space-y-3">
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