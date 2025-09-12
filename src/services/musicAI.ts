import { PitchData } from '@/hooks/usePitchDetector';

export interface MusicalPhrase {
  notes: PitchData[];
  duration: number;
  tempo: number;
  key?: string;
  scale?: string;
}

export interface AIResponse {
  notes: { frequency: number; duration: number; }[];
  analysis: {
    detectedKey?: string;
    suggestedScale?: string;
    rhythmPattern?: string;
    musicalAdvice?: string;
  };
}

export class MusicAIService {
  private apiKey: string | null = null;

  setApiKey(key: string) {
    this.apiKey = key;
  }

  async analyzePhrase(phrase: MusicalPhrase): Promise<AIResponse> {
    if (!this.apiKey) {
      return this.generateSimpleResponse(phrase);
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: `You are a master flute teacher and musical companion. Analyze the musical phrase and respond with complementary musical ideas. 
              
              Respond with JSON in this format:
              {
                "notes": [{"frequency": 440, "duration": 0.5}],
                "analysis": {
                  "detectedKey": "C major",
                  "suggestedScale": "pentatonic",
                  "rhythmPattern": "syncopated",
                  "musicalAdvice": "Beautiful phrasing! Try extending that last note."
                }
              }`
            },
            {
              role: 'user',
              content: `I played these notes: ${this.formatPhraseForAI(phrase)}. Please respond musically and provide gentle guidance.`
            }
          ],
          temperature: 0.8,
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;
      
      if (content) {
        return JSON.parse(content);
      }
    } catch (error) {
      console.warn('AI service error, falling back to simple response:', error);
    }

    return this.generateSimpleResponse(phrase);
  }

  private formatPhraseForAI(phrase: MusicalPhrase): string {
    return phrase.notes
      .map(note => `${note.note}${note.octave} (${note.frequency.toFixed(1)}Hz)`)
      .join(' → ');
  }

  private generateSimpleResponse(phrase: MusicalPhrase): AIResponse {
    // Intelligent simple response based on input
    const lastNote = phrase.notes[phrase.notes.length - 1];
    const avgFreq = phrase.notes.reduce((sum, note) => sum + note.frequency, 0) / phrase.notes.length;
    
    // Generate a complementary response
    const responseNotes = this.generateComplementaryNotes(avgFreq, phrase.notes.length);
    
    return {
      notes: responseNotes,
      analysis: {
        detectedKey: this.detectSimpleKey(phrase.notes),
        suggestedScale: 'pentatonic',
        rhythmPattern: phrase.duration < 2 ? 'quick' : 'flowing',
        musicalAdvice: this.generateSimpleAdvice(phrase)
      }
    };
  }

  private generateComplementaryNotes(avgFreq: number, phraseLength: number): { frequency: number; duration: number; }[] {
    // Create a response that complements the input phrase
    const pentatonic = [1, 1.125, 1.25, 1.5, 1.667]; // Pentatonic ratios
    const baseDuration = 0.4;
    
    return Array.from({ length: Math.min(phraseLength + 1, 5) }, (_, i) => ({
      frequency: avgFreq * pentatonic[i % pentatonic.length] * (0.8 + Math.random() * 0.4),
      duration: baseDuration * (0.8 + Math.random() * 0.4)
    }));
  }

  private detectSimpleKey(notes: PitchData[]): string {
    // Simple key detection based on note frequencies
    const noteHistogram = new Map<string, number>();
    
    notes.forEach(note => {
      if (note.note) {
        noteHistogram.set(note.note, (noteHistogram.get(note.note) || 0) + 1);
      }
    });

    const mostCommon = Array.from(noteHistogram.entries())
      .sort((a, b) => b[1] - a[1])[0];

    return mostCommon ? `${mostCommon[0]} major` : 'C major';
  }

  private generateSimpleAdvice(phrase: MusicalPhrase): string {
    const advices = [
      "Beautiful phrasing! Keep that flowing expression.",
      "Nice tone quality. Try varying your dynamics.",
      "Lovely musical conversation! I enjoyed that phrase.",
      "Great breath control. Feel the rhythm between us.",
      "Your expression is developing nicely."
    ];
    
    return advices[Math.floor(Math.random() * advices.length)];
  }
}

export const musicAI = new MusicAIService();