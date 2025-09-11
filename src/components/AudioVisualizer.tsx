import React, { useEffect, useRef, useState } from 'react';

interface AudioVisualizerProps {
  isListening: boolean;
  audioLevel: number;
  isResponding: boolean;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  isListening,
  audioLevel,
  isResponding,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const [waveData, setWaveData] = useState<number[]>(Array(50).fill(0));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Create flowing wave visualization
      const centerY = canvas.height / 2;
      const amplitude = isListening ? audioLevel * 100 : 10;
      const responseAmplitude = isResponding ? 60 : 0;

      // Draw user's audio wave (blue)
      if (isListening) {
        ctx.beginPath();
        ctx.strokeStyle = 'hsl(210, 80%, 55%)';
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.8;

        for (let i = 0; i < canvas.width; i++) {
          const x = i;
          const wave1 = Math.sin((i + Date.now() * 0.003) * 0.02) * amplitude;
          const wave2 = Math.sin((i + Date.now() * 0.005) * 0.03) * amplitude * 0.5;
          const y = centerY + wave1 + wave2;

          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Draw AI response wave (purple)
      if (isResponding) {
        ctx.beginPath();
        ctx.strokeStyle = 'hsl(280, 60%, 65%)';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.6;

        for (let i = 0; i < canvas.width; i++) {
          const x = i;
          const wave = Math.sin((i + Date.now() * 0.008) * 0.025) * responseAmplitude;
          const y = centerY + wave + 40;

          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Draw background flow lines
      ctx.globalAlpha = 0.2;
      ctx.strokeStyle = 'hsl(190, 70%, 45%)';
      ctx.lineWidth = 1;

      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        for (let x = 0; x < canvas.width; x++) {
          const y = centerY + Math.sin((x + Date.now() * 0.001 + i * 100) * 0.01) * 20;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isListening, audioLevel, isResponding]);

  return (
    <div className="relative w-full h-40 backdrop-glass rounded-2xl overflow-hidden border border-border/50">
      <canvas
        ref={canvasRef}
        width={800}
        height={160}
        className="w-full h-full"
      />
      
      {/* Overlay indicators */}
      <div className="absolute top-4 left-4 flex gap-3">
        {isListening && (
          <div className="flex items-center gap-2 text-sm text-wave-active">
            <div className="w-2 h-2 bg-wave-active rounded-full animate-pulse" />
            Listening
          </div>
        )}
        {isResponding && (
          <div className="flex items-center gap-2 text-sm text-wave-response">
            <div className="w-2 h-2 bg-wave-response rounded-full animate-pulse" />
            Responding
          </div>
        )}
      </div>

      {/* Flow state indicator */}
      <div className="absolute bottom-4 right-4">
        <div className={`px-3 py-1 rounded-full text-xs transition-flow ${
          isListening && isResponding 
            ? 'bg-flow-responsive/20 text-flow-responsive border border-flow-responsive/30' 
            : isListening 
            ? 'bg-flow-active/20 text-flow-active border border-flow-active/30'
            : 'bg-flow-calm/20 text-flow-calm border border-flow-calm/30'
        }`}>
          {isListening && isResponding ? 'In Flow' : isListening ? 'Active' : 'Ready'}
        </div>
      </div>
    </div>
  );
};