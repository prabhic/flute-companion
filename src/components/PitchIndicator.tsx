import React from 'react';
import { PitchData } from '@/hooks/usePitchDetector';
import { Card } from '@/components/ui/card';

interface PitchIndicatorProps {
  pitch: PitchData | null;
  accuracy: number;
}

export const PitchIndicator: React.FC<PitchIndicatorProps> = ({ pitch, accuracy }) => {
  if (!pitch || !pitch.note) {
    return (
      <Card className="backdrop-glass border-border/30 p-4 text-center">
        <div className="text-muted-foreground text-sm">Play to see pitch</div>
      </Card>
    );
  }

  const getAccuracyColor = (acc: number) => {
    if (acc > 0.8) return 'text-emerald-400';
    if (acc > 0.6) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getCentsIndicator = (cents: number) => {
    const maxCents = 50;
    const position = Math.max(-maxCents, Math.min(maxCents, cents));
    const percentage = ((position + maxCents) / (maxCents * 2)) * 100;
    
    return (
      <div className="relative w-32 h-2 bg-muted rounded-full mx-auto">
        {/* Center line */}
        <div className="absolute left-1/2 top-0 w-0.5 h-full bg-border transform -translate-x-0.5" />
        
        {/* Pitch indicator */}
        <div 
          className={`absolute top-0 w-1 h-full rounded-full transform -translate-x-0.5 transition-all duration-150 ${
            Math.abs(cents) < 10 ? 'bg-emerald-400' : 
            Math.abs(cents) < 25 ? 'bg-yellow-400' : 'bg-red-400'
          }`}
          style={{ left: `${percentage}%` }}
        />
      </div>
    );
  };

  return (
    <Card className="backdrop-glass border-border/30 p-4 space-y-3">
      <div className="text-center">
        <div className={`text-2xl font-bold ${getAccuracyColor(accuracy)}`}>
          {pitch.note}{pitch.octave}
        </div>
        <div className="text-sm text-muted-foreground">
          {pitch.frequency.toFixed(1)} Hz
        </div>
      </div>
      
      <div className="space-y-2">
        <div className="text-xs text-center text-muted-foreground">
          {pitch.cents > 0 ? `+${pitch.cents}` : pitch.cents} cents
        </div>
        {getCentsIndicator(pitch.cents)}
      </div>
      
      <div className="flex justify-center">
        <div className={`text-xs px-2 py-1 rounded-full ${
          accuracy > 0.8 ? 'bg-emerald-400/20 text-emerald-400' :
          accuracy > 0.6 ? 'bg-yellow-400/20 text-yellow-400' :
          'bg-red-400/20 text-red-400'
        }`}>
          {accuracy > 0.8 ? 'Perfect!' : accuracy > 0.6 ? 'Good' : 'Adjust'}
        </div>
      </div>
    </Card>
  );
};