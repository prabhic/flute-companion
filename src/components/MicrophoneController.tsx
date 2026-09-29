import React, { useEffect, useRef, useCallback } from 'react';
import { useMicrophone } from '../hooks/useMicrophone';
import { usePitchDetector } from '../hooks/usePitchDetector';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Mic, MicOff, Volume2 } from 'lucide-react';

export const MicrophoneController: React.FC = () => {
  const {
    isAccessGranted,
    isListening,
    analyser,
    error,
    requestMicrophoneAccess,
    startListening,
    stopListening,
    getAudioLevel,
  } = useMicrophone();

  const { detectPitch } = usePitchDetector();
  const animationFrameRef = useRef<number>();
  const [pitchData, setPitchData] = React.useState<any>(null);
  const [audioLevel, setAudioLevel] = React.useState(0);

  // Simple test function as requested
  const getMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      alert("✅ Microphone access granted!");
      // Stop the stream after testing
      stream.getTracks().forEach(track => track.stop());
    } catch (err: any) {
      alert("❌ Error: " + err.name + " - " + err.message);
      console.error(err);
    }
  };

  const updatePitchAndLevel = useCallback(() => {
    if (!isListening || !analyser) {
      animationFrameRef.current = requestAnimationFrame(updatePitchAndLevel);
      return;
    }

    // Update audio level
    const level = getAudioLevel();
    setAudioLevel(level);

    // Detect pitch
    const detectedPitch = detectPitch(analyser);
    setPitchData(detectedPitch);

    animationFrameRef.current = requestAnimationFrame(updatePitchAndLevel);
  }, [isListening, analyser, detectPitch, getAudioLevel]);

  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(updatePitchAndLevel);
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [updatePitchAndLevel]);

  const handleToggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const formatFrequency = (freq: number) => {
    return freq.toFixed(1) + ' Hz';
  };

  const formatCents = (cents: number) => {
    if (cents > 0) return `+${cents} cents`;
    return `${cents} cents`;
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Volume2 className="w-5 h-5" />
          Microphone Controller
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* Status Indicators */}
        <div className="flex gap-2 flex-wrap">
          <Badge variant={isAccessGranted ? "default" : "secondary"}>
            {isAccessGranted ? "Access Granted" : "No Access"}
          </Badge>
          <Badge variant={isListening ? "default" : "outline"}>
            {isListening ? "Listening" : "Not Listening"}
          </Badge>
        </div>

        {/* Control Buttons */}
        <div className="flex gap-2 flex-col space-y-2">
          {/* Simple test button */}
          <Button 
            onClick={getMic} 
            variant="outline"
            className="w-full"
          >
            🧪 Quick Mic Test
          </Button>
          
          <div className="flex gap-2">
            {!isAccessGranted && (
              <Button 
                onClick={requestMicrophoneAccess} 
                className="flex-1"
              >
                <Mic className="w-4 h-4 mr-2" />
                Request Access
              </Button>
            )}
            
            {isAccessGranted && (
              <Button 
                onClick={handleToggleListening} 
                variant={isListening ? "destructive" : "default"}
                className="flex-1"
              >
                {isListening ? (
                  <>
                    <MicOff className="w-4 h-4 mr-2" />
                    Stop Listening
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4 mr-2" />
                    Start Listening
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Audio Level Indicator */}
        {isListening && (
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span>Audio Level</span>
              <span>{(audioLevel * 100).toFixed(0)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-75"
                style={{ width: `${audioLevel * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Pitch Detection Display */}
        {isListening && pitchData && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md space-y-2">
            <h4 className="font-medium text-blue-900">Detected Pitch</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-600">Note:</span>
                <span className="font-mono ml-2">{pitchData.note}{pitchData.octave}</span>
              </div>
              <div>
                <span className="text-gray-600">Frequency:</span>
                <span className="font-mono ml-2">{formatFrequency(pitchData.frequency)}</span>
              </div>
              <div>
                <span className="text-gray-600">Cents:</span>
                <span className={`font-mono ml-2 ${Math.abs(pitchData.cents) < 10 ? 'text-green-600' : 'text-orange-600'}`}>
                  {formatCents(pitchData.cents)}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Confidence:</span>
                <span className="font-mono ml-2">{(pitchData.confidence * 100).toFixed(0)}%</span>
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        {!isAccessGranted && !error && (
          <div className="text-sm text-gray-600 space-y-2">
            <p><strong>To enable microphone access:</strong></p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Make sure you're accessing via <code className="bg-gray-100 px-1 rounded">localhost</code> (not 127.0.0.1)</li>
              <li>Click "Request Access" below</li>
              <li>When prompted, click "Allow" in your browser</li>
              <li>If blocked, click the microphone icon in your address bar and select "Allow"</li>
            </ol>
          </div>
        )}

        {!isAccessGranted && error && (
          <div className="text-sm text-gray-600 space-y-2">
            <p><strong>Troubleshooting tips:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Refresh the page and try again</li>
              <li>Check browser settings: ensure microphone access is allowed</li>
              <li>Make sure no other apps are using your microphone</li>
              <li>Try accessing via <code className="bg-gray-100 px-1 rounded">http://localhost:8080</code></li>
            </ul>
          </div>
        )}
        
        {isAccessGranted && !isListening && (
          <div className="text-sm text-gray-600">
            <p>✅ Microphone access granted! Click "Start Listening" to begin pitch detection and audio level monitoring.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};