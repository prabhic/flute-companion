import { useState, useCallback, useRef } from 'react';
import { PitchData, usePitchDetector } from './usePitchDetector';
import { musicAI, MusicalPhrase, AIResponse } from '@/services/musicAI';

export interface MusicalFeedback {
  currentPitch: PitchData | null;
  pitchAccuracy: number; // 0-1, how close to perfect pitch
  phraseAnalysis: AIResponse | null;
  isAnalyzing: boolean;
}

export const useMusicalAnalysis = () => {
  const [feedback, setFeedback] = useState<MusicalFeedback>({
    currentPitch: null,
    pitchAccuracy: 0,
    phraseAnalysis: null,
    isAnalyzing: false
  });

  const { detectPitch } = usePitchDetector();
  const phraseRef = useRef<PitchData[]>([]);
  const phraseStartRef = useRef<number>(0);

  const analyzeLiveAudio = useCallback((analyser: AnalyserNode) => {
    const pitch = detectPitch(analyser);
    
    if (pitch && pitch.confidence > 0.5) {
      // Calculate pitch accuracy (how close to perfect pitch)
      const accuracy = Math.max(0, 1 - Math.abs(pitch.cents) / 50); // 50 cents = half accuracy
      
      setFeedback(prev => ({
        ...prev,
        currentPitch: pitch,
        pitchAccuracy: accuracy
      }));

      // Collect phrase data
      phraseRef.current.push(pitch);
    } else {
      setFeedback(prev => ({
        ...prev,
        currentPitch: null,
        pitchAccuracy: 0
      }));
    }
  }, [detectPitch]);

  const startPhrase = useCallback(() => {
    phraseRef.current = [];
    phraseStartRef.current = performance.now();
  }, []);

  const endPhrase = useCallback(async () => {
    if (phraseRef.current.length === 0) return null;

    const duration = (performance.now() - phraseStartRef.current) / 1000;
    const phrase: MusicalPhrase = {
      notes: [...phraseRef.current],
      duration,
      tempo: (phraseRef.current.length / duration) * 60 // rough tempo estimation
    };

    setFeedback(prev => ({ ...prev, isAnalyzing: true }));

    try {
      const analysis = await musicAI.analyzePhrase(phrase);
      
      setFeedback(prev => ({
        ...prev,
        phraseAnalysis: analysis,
        isAnalyzing: false
      }));

      return analysis;
    } catch (error) {
      console.error('Analysis error:', error);
      setFeedback(prev => ({ ...prev, isAnalyzing: false }));
      return null;
    }
  }, []);

  const clearAnalysis = useCallback(() => {
    setFeedback(prev => ({
      ...prev,
      phraseAnalysis: null,
      currentPitch: null,
      pitchAccuracy: 0
    }));
    phraseRef.current = [];
  }, []);

  return {
    feedback,
    analyzeLiveAudio,
    startPhrase,
    endPhrase,
    clearAnalysis
  };
};