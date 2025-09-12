import { useCallback, useRef } from 'react';

export interface PitchData {
  frequency: number;
  note: string;
  octave: number;
  cents: number; // cents off from perfect pitch
  confidence: number;
}

export const usePitchDetector = () => {
  const pitchDetectorRef = useRef<any>(null);

  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  const frequencyToNote = useCallback((frequency: number): PitchData => {
    const A4 = 440;
    const C0 = A4 * Math.pow(2, -4.75); // C0 frequency
    
    if (frequency <= 0) {
      return { frequency: 0, note: '', octave: 0, cents: 0, confidence: 0 };
    }

    const h = Math.round(12 * Math.log2(frequency / C0));
    const octave = Math.floor(h / 12);
    const n = h % 12;
    const note = noteNames[n];
    
    // Calculate cents deviation
    const expectedFreq = C0 * Math.pow(2, h / 12);
    const cents = Math.round(1200 * Math.log2(frequency / expectedFreq));
    
    return {
      frequency,
      note,
      octave,
      cents,
      confidence: 1 // Will be enhanced with actual confidence calculation
    };
  }, []);

  const detectPitch = useCallback((analyser: AnalyserNode): PitchData | null => {
    const bufferLength = analyser.fftSize;
    const buffer = new Float32Array(bufferLength);
    analyser.getFloatTimeDomainData(buffer);

    // Autocorrelation pitch detection
    const sampleRate = analyser.context.sampleRate;
    let bestCorrelation = 0;
    let bestOffset = -1;
    const minFreq = 80; // Minimum frequency to detect (low flute notes)
    const maxFreq = 2000; // Maximum frequency
    
    const minSamples = Math.floor(sampleRate / maxFreq);
    const maxSamples = Math.floor(sampleRate / minFreq);

    for (let offset = minSamples; offset < maxSamples; offset++) {
      let correlation = 0;
      for (let i = 0; i < bufferLength - offset; i++) {
        correlation += Math.abs(buffer[i] - buffer[i + offset]);
      }
      correlation = 1 - correlation / (bufferLength - offset);
      
      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestOffset = offset;
      }
    }

    // Only return a result if we have good correlation
    if (bestCorrelation > 0.3 && bestOffset !== -1) {
      const fundamental = sampleRate / bestOffset;
      const pitchData = frequencyToNote(fundamental);
      pitchData.confidence = bestCorrelation;
      return pitchData;
    }

    return null;
  }, [frequencyToNote]);

  return { detectPitch };
};