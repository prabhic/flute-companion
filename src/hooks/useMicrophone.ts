import { useState, useEffect, useRef, useCallback } from 'react';

export interface MicrophoneState {
  isAccessGranted: boolean;
  isListening: boolean;
  stream: MediaStream | null;
  audioContext: AudioContext | null;
  analyser: AnalyserNode | null;
  error: string | null;
}

export const useMicrophone = () => {
  const [state, setState] = useState<MicrophoneState>({
    isAccessGranted: false,
    isListening: false,
    stream: null,
    audioContext: null,
    analyser: null,
    error: null,
  });

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const requestMicrophoneAccess = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, error: null }));
      
      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Your browser does not support microphone access. Please use a modern browser like Chrome, Firefox, or Safari.');
      }

      // Check if we're on localhost or HTTPS
      const isSecureContext = window.location.protocol === 'https:' || 
                              window.location.hostname === 'localhost' || 
                              window.location.hostname === '127.0.0.1';
      
      if (!isSecureContext) {
        throw new Error('Microphone access requires HTTPS or localhost. Please access via localhost or use HTTPS.');
      }
      
      console.log("Requesting microphone access...");
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 44100
        } 
      });

      streamRef.current = stream;
      console.log("Microphone access granted!");

      // Create audio context and analyser
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      
      // Configure analyser for pitch detection
      analyser.fftSize = 4096;
      analyser.minDecibels = -90;
      analyser.maxDecibels = -10;
      analyser.smoothingTimeConstant = 0.85;
      
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      setState(prev => ({
        ...prev,
        isAccessGranted: true,
        stream,
        audioContext,
        analyser,
      }));

    } catch (err) {
      let errorMessage = 'Unknown error occurred';
      
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'object' && err !== null) {
        const error = err as any;
        if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
          errorMessage = 'Microphone access was denied. Please click the microphone icon in your browser\'s address bar and allow access, then try again.';
        } else if (error.name === 'NotFoundError') {
          errorMessage = 'No microphone found. Please check that your microphone is connected and try again.';
        } else if (error.name === 'NotReadableError') {
          errorMessage = 'Your microphone is being used by another application. Please close other apps using the microphone and try again.';
        } else if (error.name === 'OverconstrainedError') {
          errorMessage = 'The requested microphone settings are not supported. Trying with default settings...';
        }
      }
      
      console.error("Microphone access denied:", err);
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isAccessGranted: false,
      }));
    }
  }, []);

  const startListening = useCallback(async () => {
    if (!state.audioContext || !state.stream) {
      await requestMicrophoneAccess();
      return;
    }

    try {
      if (state.audioContext.state === 'suspended') {
        await state.audioContext.resume();
      }

      setState(prev => ({ ...prev, isListening: true }));
      console.log("Started listening to microphone");
    } catch (err) {
      console.error("Failed to start listening:", err);
      setState(prev => ({
        ...prev,
        error: 'Failed to start listening to microphone',
      }));
    }
  }, [state.audioContext, state.stream, requestMicrophoneAccess]);

  const stopListening = useCallback(() => {
    setState(prev => ({ ...prev, isListening: false }));
    console.log("Stopped listening to microphone");
  }, []);

  const cleanup = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyserRef.current = null;

    setState({
      isAccessGranted: false,
      isListening: false,
      stream: null,
      audioContext: null,
      analyser: null,
      error: null,
    });

    console.log("Microphone resources cleaned up");
  }, []);

  const getAudioLevel = useCallback((): number => {
    if (!analyserRef.current) return 0;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteFrequencyData(dataArray);

    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i];
    }
    const average = sum / bufferLength;
    return average / 255; // Normalize to 0-1
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    ...state,
    requestMicrophoneAccess,
    startListening,
    stopListening,
    cleanup,
    getAudioLevel,
  };
};