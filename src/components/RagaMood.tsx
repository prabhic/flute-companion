import React from 'react';
import { Card } from '@/components/ui/card';
import { RagaResponse } from '@/services/ragaAI';
import { Music, Sparkles, Sunrise, Sun, Sunset, Moon } from 'lucide-react';

interface RagaMoodProps {
  analysis: RagaResponse | null;
  isAnalyzing: boolean;
}

const getTimeIcon = (timeOfDay: string) => {
  if (timeOfDay.includes('morning')) return <Sunrise className="w-4 h-4" />;
  if (timeOfDay.includes('afternoon')) return <Sun className="w-4 h-4" />;
  if (timeOfDay.includes('evening')) return <Sunset className="w-4 h-4" />;
  if (timeOfDay.includes('night')) return <Moon className="w-4 h-4" />;
  return <Music className="w-4 h-4" />;
};

const getMoodColor = (mood: string) => {
  if (mood.includes('devotional') || mood.includes('spiritual')) return 'text-violet-400';
  if (mood.includes('joyful') || mood.includes('energetic')) return 'text-orange-400';
  if (mood.includes('peaceful') || mood.includes('contemplative')) return 'text-blue-400';
  if (mood.includes('romantic') || mood.includes('longing')) return 'text-pink-400';
  return 'text-primary';
};

export const RagaMood: React.FC<RagaMoodProps> = ({ analysis, isAnalyzing }) => {
  if (isAnalyzing) {
    return (
      <Card className="backdrop-glass border-border/30 p-6">
        <div className="flex items-center justify-center gap-3 text-primary">
          <Sparkles className="w-5 h-5 animate-pulse" />
          <span className="text-sm">Listening to your raga mood...</span>
        </div>
      </Card>
    );
  }

  if (!analysis || !analysis.ragaMood) {
    return (
      <Card className="backdrop-glass border-border/30 p-6 text-center">
        <div className="text-muted-foreground text-sm">
          Play a phrase to discover the raga mood
        </div>
      </Card>
    );
  }

  const { ragaMood } = analysis;

  return (
    <Card className="backdrop-glass border-border/30 p-6 space-y-4">
      {/* Raga Header */}
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-full bg-primary/10 ${getMoodColor(ragaMood.mood)}`}>
          {getTimeIcon(ragaMood.timeOfDay)}
        </div>
        <div>
          <h3 className="font-semibold text-lg text-primary">{ragaMood.ragaName}</h3>
          <p className="text-xs text-muted-foreground">
            {ragaMood.timeOfDay} • {(ragaMood.confidence * 100).toFixed(0)}% confidence
          </p>
        </div>
      </div>

      {/* Mood Description */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {ragaMood.mood.split(', ').map((moodWord, index) => (
            <span 
              key={index}
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                index === 0 ? 'bg-primary/20 text-primary' : 'bg-muted/50 text-muted-foreground'
              }`}
            >
              {moodWord}
            </span>
          ))}
        </div>

        <div className={`text-sm ${getMoodColor(ragaMood.mood)} font-medium`}>
          Expressing: {ragaMood.emotion}
        </div>
      </div>

      {/* Traditional Phrase */}
      {analysis.traditionalPhrase && (
        <div className="border-l-2 border-primary/30 pl-4">
          <div className="text-xs text-muted-foreground mb-1">Traditional phrase:</div>
          <div className="font-mono text-sm text-primary">
            {analysis.traditionalPhrase}
          </div>
        </div>
      )}

      {/* Encouraging Advice */}
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
          <div className="text-sm text-primary/90 leading-relaxed">
            {analysis.advice}
          </div>
        </div>
      </div>
    </Card>
  );
};