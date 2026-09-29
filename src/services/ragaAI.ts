import { PitchData } from '@/hooks/usePitchDetector';

export interface RagaMood {
  primaryRaga: string;
  ragaName: string;
  confidence: number;
  mood: string;
  timeOfDay: string;
  emotion: string;
}

export interface RagaPhrase {
  notes: PitchData[];
  duration: number;
  ragaMood: RagaMood;
  ornaments: string[];
}

export interface RagaResponse {
  notes: { frequency: number; duration: number; }[];
  ragaMood: RagaMood;
  advice: string;
  traditionalPhrase: string;
}

// Traditional raga knowledge from Indian classical music
export const RAGA_KNOWLEDGE = {
  'anandabhairavi': {
    name: 'Ānandabhairavi',
    swaras: ['Sa', 'Re', 'Ga', 'Ma', 'Pa', 'Dha', 'Ni'],
    komalSwaras: ['Re', 'Ga', 'Dha', 'Ni'], // Flat notes
    mood: 'devotional, contemplative',
    timeOfDay: 'early morning',
    emotion: 'peace, spirituality',
    pakadPhrase: [261.63, 277.18, 293.66, 329.63], // Sa Re Ga Ma in Hz (approx)
    responsePatterns: [
      { notes: [261.63, 277.18, 293.66, 329.63, 369.99], phrase: 'Sa Re Ga Ma Pa' },
      { notes: [369.99, 329.63, 293.66, 277.18], phrase: 'Pa Ma Ga Re' },
      { notes: [261.63, 293.66, 329.63, 369.99, 392.00], phrase: 'Sa Ga Ma Pa Dha' }
    ]
  },
  'madhyamavati': {
    name: 'Madhyamāvati',
    swaras: ['Sa', 'Re', 'Ga', 'Pa', 'Dha'], // Pentatonic
    komalSwaras: [],
    mood: 'peaceful, balanced',
    timeOfDay: 'evening',
    emotion: 'harmony, satisfaction',
    pakadPhrase: [261.63, 293.66, 329.63, 392.00], // Sa Re Ga Pa
    responsePatterns: [
      { notes: [261.63, 293.66, 329.63, 392.00, 440.00], phrase: 'Sa Re Ga Pa Dha' },
      { notes: [440.00, 392.00, 329.63, 293.66], phrase: 'Dha Pa Ga Re' },
      { notes: [329.63, 392.00, 440.00, 523.25], phrase: 'Ga Pa Dha Sa\'' }
    ]
  },
  'kambhoji': {
    name: 'Kāṁbhōji',
    swaras: ['Sa', 'Re', 'Ga', 'Ma', 'Pa', 'Dha', 'Ni'],
    komalSwaras: ['Ni'],
    mood: 'joyful, energetic',
    timeOfDay: 'afternoon',
    emotion: 'happiness, celebration',
    pakadPhrase: [261.63, 293.66, 329.63, 392.00], // Sa Re Ga Pa
    responsePatterns: [
      { notes: [261.63, 293.66, 329.63, 369.99, 392.00], phrase: 'Sa Re Ga Ma Pa' },
      { notes: [392.00, 369.99, 329.63, 293.66], phrase: 'Pa Ma Ga Re' },
      { notes: [440.00, 392.00, 369.99, 329.63], phrase: 'Dha Pa Ma Ga' }
    ]
  },
  // Add more ragas as detected by the model
  'surati': {
    name: 'Suraṭi',
    mood: 'gentle, flowing',
    timeOfDay: 'morning',
    emotion: 'serenity, grace'
  },
  'mukhari': {
    name: 'Mukhāri', 
    mood: 'serious, contemplative',
    timeOfDay: 'evening',
    emotion: 'depth, introspection'
  }
} as const;

export class RagaAIService {
  private apiEndpoint: string | null = null;
  private isModelLoaded = false;

  constructor() {
    // Check if we have a raga detection server endpoint
    this.apiEndpoint = import.meta.env.VITE_RAGA_DETECTION_ENDPOINT || 'http://localhost:5000';
  }

  async loadModel(): Promise<boolean> {
    if (this.apiEndpoint) {
      try {
        const response = await fetch(`${this.apiEndpoint}/health`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        if (response.ok) {
          this.isModelLoaded = true;
          console.log('✅ Raga AI Model loaded successfully');
          return true;
        }
      } catch (error) {
        console.log('⚠️ Raga AI server not available, using traditional patterns');
        console.log('📍 Expected server at:', this.apiEndpoint);
        // Set endpoint to null to use fallback mode
        this.apiEndpoint = null;
      }
    }
    
    // Fallback to traditional raga pattern recognition
    this.isModelLoaded = true;
    console.log('🎋 Using traditional raga pattern recognition');
    return true;
  }

  async detectRaga(phrase: RagaPhrase): Promise<RagaMood> {
    if (!this.isModelLoaded) {
      await this.loadModel();
    }

    // If we have the AI model endpoint, use it
    if (this.apiEndpoint) {
      try {
        return await this.detectWithAI(phrase);
      } catch (error) {
        console.log('AI detection failed, falling back to traditional patterns');
      }
    }

    // Traditional pattern-based raga detection
    return this.detectWithPatterns(phrase);
  }

  private async detectWithAI(phrase: RagaPhrase): Promise<RagaMood> {
    const audioFeatures = this.extractAudioFeatures(phrase.notes);
    
    const response = await fetch(`${this.apiEndpoint}/predict_raga`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        features: audioFeatures,
        duration: phrase.duration
      })
    });

    if (!response.ok) {
      throw new Error('AI raga detection failed');
    }

    const result = await response.json();
    const ragaKey = result.raga.toLowerCase().replace(/[^a-z]/g, '');
    const knowledge = RAGA_KNOWLEDGE[ragaKey as keyof typeof RAGA_KNOWLEDGE];

    return {
      primaryRaga: ragaKey,
      ragaName: result.raga,
      confidence: result.confidence,
      mood: knowledge?.mood || 'contemplative',
      timeOfDay: knowledge?.timeOfDay || 'any time',
      emotion: knowledge?.emotion || 'peaceful'
    };
  }

  private detectWithPatterns(phrase: RagaPhrase): Promise<RagaMood> {
    // Analyze the pitch patterns to detect raga characteristics
    const frequencies = phrase.notes.map(note => note.frequency);
    const avgFreq = frequencies.reduce((sum, f) => sum + f, 0) / frequencies.length;
    
    // Simple pattern matching based on interval relationships
    let detectedRaga: RagaMood;

    // Check for komal (flat) notes characteristic of Bhairavi family
    const hasKomalNotes = this.detectKomalNotes(frequencies);
    
    // Check for pentatonic patterns
    const isPentatonic = this.detectPentatonicPattern(frequencies);

    if (hasKomalNotes) {
      detectedRaga = {
        primaryRaga: 'anandabhairavi',
        ragaName: 'Ānandabhairavi',
        confidence: 0.75,
        mood: 'devotional, contemplative',
        timeOfDay: 'early morning',
        emotion: 'peace, spirituality'
      };
    } else if (isPentatonic) {
      detectedRaga = {
        primaryRaga: 'madhyamavati',
        ragaName: 'Madhyamāvati',
        confidence: 0.70,
        mood: 'peaceful, balanced',
        timeOfDay: 'evening',
        emotion: 'harmony, satisfaction'
      };
    } else {
      detectedRaga = {
        primaryRaga: 'kambhoji',
        ragaName: 'Kāṁbhōji',
        confidence: 0.65,
        mood: 'joyful, energetic',
        timeOfDay: 'afternoon',
        emotion: 'happiness, celebration'
      };
    }

    return Promise.resolve(detectedRaga);
  }

  async generateRagaResponse(userPhrase: RagaPhrase, detectedRaga: RagaMood): Promise<RagaResponse> {
    const knowledge = RAGA_KNOWLEDGE[detectedRaga.primaryRaga as keyof typeof RAGA_KNOWLEDGE];
    
    if (!knowledge) {
      return this.generateGenericResponse(detectedRaga);
    }

    // Generate response based on traditional raga patterns
    const responsePattern = knowledge.responsePatterns[
      Math.floor(Math.random() * knowledge.responsePatterns.length)
    ];

    const baseDuration = 0.8; // Longer notes for traditional feel
    const notes = responsePattern.notes.map((freq, index) => ({
      frequency: freq * this.getTonicRatio(userPhrase.notes),
      duration: baseDuration * (0.8 + Math.random() * 0.4) // Natural variation
    }));

    const traditionalAdvice = this.generateTraditionalAdvice(detectedRaga, knowledge);

    return {
      notes,
      ragaMood: detectedRaga,
      advice: traditionalAdvice,
      traditionalPhrase: responsePattern.phrase
    };
  }

  private extractAudioFeatures(notes: PitchData[]): number[] {
    // Extract features compatible with the PyTorch model
    // This would need to match the preprocessing used in the original model
    const frequencies = notes.map(note => note.frequency);
    const pitchClasses = frequencies.map(freq => this.frequencyToPitchClass(freq));
    
    // Create a simplified feature vector (this would need refinement)
    return pitchClasses;
  }

  private detectKomalNotes(frequencies: number[]): boolean {
    // Detect flat (komal) notes by analyzing interval ratios
    const ratios = frequencies.slice(1).map((freq, i) => freq / frequencies[i]);
    
    // Look for characteristic small intervals (komal notes)
    return ratios.some(ratio => ratio > 1.05 && ratio < 1.12); // Komal intervals
  }

  private detectPentatonicPattern(frequencies: number[]): boolean {
    // Simple pentatonic detection - 5 distinct pitch classes
    const pitchClasses = frequencies.map(freq => this.frequencyToPitchClass(freq));
    const uniquePitches = new Set(pitchClasses);
    return uniquePitches.size <= 5;
  }

  private frequencyToPitchClass(frequency: number): number {
    // Convert frequency to pitch class (0-11 representing chromatic scale)
    const A4 = 440;
    const semitones = Math.round(12 * Math.log2(frequency / A4));
    return ((semitones % 12) + 12) % 12;
  }

  private getTonicRatio(userNotes: PitchData[]): number {
    // Estimate the user's tonic (Sa) relative to concert pitch
    if (userNotes.length === 0) return 1.0;
    
    const avgUserFreq = userNotes.reduce((sum, note) => sum + note.frequency, 0) / userNotes.length;
    const concertC = 261.63; // C4
    return avgUserFreq / concertC;
  }

  private generateGenericResponse(raga: RagaMood): RagaResponse {
    // Fallback response for unknown ragas
    const genericNotes = [
      { frequency: 261.63, duration: 0.6 },
      { frequency: 293.66, duration: 0.6 },
      { frequency: 329.63, duration: 0.8 },
      { frequency: 392.00, duration: 0.7 }
    ];

    return {
      notes: genericNotes,
      ragaMood: raga,
      advice: `Beautiful expression in ${raga.ragaName}. Feel the ${raga.emotion} in your playing.`,
      traditionalPhrase: 'Sa Re Ga Pa'
    };
  }

  private generateTraditionalAdvice(raga: RagaMood, knowledge: any): string {
    const adviceTemplates = [
      `Lovely ${raga.ragaName}! Feel the ${raga.emotion} flowing through your breath.`,
      `Beautiful phrasing in ${raga.ragaName}. This ${raga.timeOfDay} raga carries such ${raga.emotion}.`,
      `Your ${raga.ragaName} is developing nicely. Let the ${raga.mood} mood guide your expression.`,
      `Wonderful exploration of ${raga.ragaName}. The traditional ${raga.emotion} is coming through.`,
      `Keep flowing with ${raga.ragaName}. Feel how this raga captures ${raga.emotion}.`
    ];

    return adviceTemplates[Math.floor(Math.random() * adviceTemplates.length)];
  }
}

export const ragaAI = new RagaAIService();