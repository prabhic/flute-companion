import { useState, useCallback, useRef } from 'react';
import { PitchData, usePitchDetector } from './usePitchDetector';
import { ragaAI, RagaMood, RagaPhrase, RagaResponse } from '@/services/ragaAI';

export interface RagaFeedback {
  currentPitch: PitchData | null;
  detectedRaga: RagaMood | null;
  ragaResponse: RagaResponse | null;
  isAnalyzing: boolean;
  confidence: number;
  pitchAccuracy: number; // Add for compatibility with PitchIndicator
}

export const useRagaAnalysis = () => {
  const [feedback, setFeedback] = useState<RagaFeedback>({
    currentPitch: null,
    detectedRaga: null,
    ragaResponse: null,
    isAnalyzing: false,
    confidence: 0,
    pitchAccuracy: 0
  });

  const { detectPitch } = usePitchDetector();
  const phraseRef = useRef<PitchData[]>([]);
  const phraseStartRef = useRef<number>(0);
  const lastRagaRef = useRef<RagaMood | null>(null);

  const analyzeLiveAudio = useCallback((analyser: AnalyserNode) => {
    const pitch = detectPitch(analyser);
    
    if (pitch && pitch.confidence > 0.5) {
      // Calculate pitch accuracy (how close to perfect pitch)
      const accuracy = Math.max(0, 1 - Math.abs(pitch.cents) / 50); // 50 cents = half accuracy
      
      setFeedback(prev => ({
        ...prev,
        currentPitch: pitch,
        confidence: pitch.confidence,
        pitchAccuracy: accuracy
      }));

      // Collect phrase data for raga analysis
      phraseRef.current.push(pitch);
      
      // Keep only recent notes for analysis (sliding window)
      if (phraseRef.current.length > 50) {
        phraseRef.current = phraseRef.current.slice(-30); // Keep last 30 notes
      }
    } else {
      setFeedback(prev => ({
        ...prev,
        currentPitch: null
      }));
    }
  }, [detectPitch]);

  const startPhrase = useCallback(() => {
    phraseStartRef.current = Date.now();
    phraseRef.current = [];
    console.log('🎵 Started raga phrase analysis');
  }, []);

  const endPhrase = useCallback(async (): Promise<RagaResponse | null> => {
    const duration = (Date.now() - phraseStartRef.current) / 1000;
    
    if (phraseRef.current.length === 0) {
      console.log('⚠️ No notes captured for raga analysis');
      return null;
    }

    console.log(`🎼 Analyzing phrase: ${phraseRef.current.length} notes, ${duration.toFixed(1)}s duration`);

    const ragaPhrase: RagaPhrase = {
      notes: [...phraseRef.current],
      duration,
      ragaMood: lastRagaRef.current || {
        primaryRaga: 'unknown',
        ragaName: 'Unknown',
        confidence: 0,
        mood: 'exploratory',
        timeOfDay: 'any time',
        emotion: 'curious'
      },
      ornaments: [] // TODO: Detect meend, gamak, etc.
    };

    setFeedback(prev => ({ ...prev, isAnalyzing: true }));

    try {
      // Detect the raga from the phrase
      const detectedRaga = await ragaAI.detectRaga(ragaPhrase);
      console.log(`🎋 Detected raga: ${detectedRaga.ragaName} (${(detectedRaga.confidence * 100).toFixed(1)}% confidence)`);
      
      // Generate a raga-appropriate response
      const response = await ragaAI.generateRagaResponse(ragaPhrase, detectedRaga);
      
      // Store for context in next phrase
      lastRagaRef.current = detectedRaga;
      
      setFeedback(prev => ({
        ...prev,
        detectedRaga,
        ragaResponse: response,
        isAnalyzing: false
      }));

      return response;
    } catch (error) {
      console.error('❌ Raga analysis error:', error);
      setFeedback(prev => ({ ...prev, isAnalyzing: false }));
      return null;
    }
  }, []);

  const clearAnalysis = useCallback(() => {
    setFeedback({
      currentPitch: null,
      detectedRaga: null,
      ragaResponse: null,
      isAnalyzing: false,
      confidence: 0,
      pitchAccuracy: 0
    });
    phraseRef.current = [];
    lastRagaRef.current = null;
  }, []);

  // Helper to get the current raga context
  const getCurrentRagaContext = useCallback((): RagaMood | null => {
    return lastRagaRef.current;
  }, []);

  // Check if we've detected a raga shift
  const detectRagaShift = useCallback((newRaga: RagaMood): boolean => {
    const currentRaga = lastRagaRef.current;
    if (!currentRaga) return false;
    
    const isShift = currentRaga.primaryRaga !== newRaga.primaryRaga && 
                   newRaga.confidence > 0.7;
    
    if (isShift) {
      console.log(`🔄 Raga shift detected: ${currentRaga.ragaName} → ${newRaga.ragaName}`);
    }
    
    return isShift;
  }, []);

  return {
    feedback,
    analyzeLiveAudio,
    startPhrase,
    endPhrase,
    clearAnalysis,
    getCurrentRagaContext,
    detectRagaShift
  };
};