import React from 'react';
import { Card } from '@/components/ui/card';
import { AIResponse } from '@/services/musicAI';
import { Music, Sparkles, TrendingUp } from 'lucide-react';

interface MusicalAdviceProps {
  analysis: AIResponse | null;
  isAnalyzing: boolean;
}

export const MusicalAdvice: React.FC<MusicalAdviceProps> = ({ analysis, isAnalyzing }) => {
  if (isAnalyzing) {
    return (
      <Card className="backdrop-glass border-border/30 p-6">
        <div className="flex items-center justify-center gap-3 text-primary">
          <Sparkles className="w-5 h-5 animate-pulse" />
          <span className="text-sm">Analyzing your musical phrase...</span>
        </div>
      </Card>
    );
  }

  if (!analysis) {
    return (
      <Card className="backdrop-glass border-border/30 p-6 text-center">
        <div className="text-muted-foreground text-sm">
          Play a phrase to receive musical insights
        </div>
      </Card>
    );
  }

  return (
    <Card className="backdrop-glass border-border/30 p-6 space-y-4">
      <div className="flex items-center gap-2 text-primary">
        <Music className="w-5 h-5" />
        <span className="font-semibold">Musical Analysis</span>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        {analysis.analysis.detectedKey && (
          <div className="space-y-1">
            <div className="text-muted-foreground">Detected Key</div>
            <div className="text-primary font-medium">{analysis.analysis.detectedKey}</div>
          </div>
        )}
        
        {analysis.analysis.suggestedScale && (
          <div className="space-y-1">
            <div className="text-muted-foreground">Suggested Scale</div>
            <div className="text-primary font-medium">{analysis.analysis.suggestedScale}</div>
          </div>
        )}
        
        {analysis.analysis.rhythmPattern && (
          <div className="space-y-1">
            <div className="text-muted-foreground">Rhythm Pattern</div>
            <div className="text-primary font-medium">{analysis.analysis.rhythmPattern}</div>
          </div>
        )}
      </div>
      
      {analysis.analysis.musicalAdvice && (
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <TrendingUp className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <div className="text-sm text-primary font-medium">
              {analysis.analysis.musicalAdvice}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};